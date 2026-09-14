// DML Smoke Test - Minimal Reliable DML Operations Test
// Tests INSERT/SELECT/DELETE 10 times and measures latency
// Run: node server/scripts/db_dml_smoke.cjs

const path = require('path');
const net = require('net');
require('dotenv').config({
    path: process.env.DOTENV_PATH
        ? path.resolve(process.env.DOTENV_PATH)
        : path.resolve(__dirname, '..', '.env')
});

const knex = require('knex');

// TCP Connect Test (no auth, just network layer)
async function tcpConnectTest(host, port) {
    return new Promise((resolve) => {
        const socket = net.createConnection({ host, port, timeout: 2000 });

        socket.on('connect', () => {
            socket.end();
            resolve({ ok: true, ms: Date.now() - start });
        });

        socket.on('error', (err) => {
            resolve({ ok: false, error: err.message });
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve({ ok: false, error: 'timeout' });
        });

        const start = Date.now();
    });
}

async function main() {
    console.log('\n=== DML SMOKE TEST ===\n');

    // Test TCP connectivity first
    console.log('[0/11] TCP connectivity test...');
    const tcpTest = await tcpConnectTest(process.env.DB_HOST, process.env.DB_PORT || 5432);
    console.log(`  ${tcpTest.ok ? '✅' : '❌'} TCP connect: ${tcpTest.ok ? tcpTest.ms + 'ms' : tcpTest.error}\n`);

    if (!tcpTest.ok) {
        console.error('❌ FAIL: Cannot reach DB host via TCP\n');
        process.exit(1);
    }

    // Create dedicated knex instance (NOT global)
    const db = knex({
        client: 'pg',
        connection: {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
            connectionTimeoutMillis: 10000,  // 10s to connect
            statement_timeout: 15000,  // 15s per query
        },
        pool: {
            min: 0,
            max: 2,  // Very conservative for test
            acquireTimeoutMillis: 20000,
            idleTimeoutMillis: 5000,
            createTimeoutMillis: 10000,
        },
        acquireConnectionTimeout: 20000,
    });

    const results = [];

    try {
        // Create temp diagnostic table
        console.log('[1/11] Creating temp diagnostic table...');
        const start1 = Date.now();

        const hasDiagTable = await db.schema.hasTable('diagnostic_events');
        if (!hasDiagTable) {
            await db.schema.createTable('diagnostic_events', (table) => {
                table.increments('id').primary();
                table.string('event_type');
                table.timestamp('created_at').defaultTo(db.fn.now());
            });
        }

        const elapsed1 = Date.now() - start1;
        console.log(`  ✅ OK (${elapsed1}ms)\n`);

        // Run 10 DML tests
        for (let i = 1; i <= 10; i++) {
            console.log(`[${i + 1}/11] DML test iteration ${i}...`);

            const iteration = { attempt: i, operations: [] };

            try {
                // 1. SELECT 1
                const s1 = Date.now();
                await db.raw('SELECT 1 as ping');
                iteration.operations.push({ op: 'SELECT 1', ok: true, ms: Date.now() - s1 });

                // 2. SELECT COUNT
                const s2 = Date.now();
                const count = await db('token_plans').count('* as cnt');
                iteration.operations.push({ op: 'COUNT token_plans', ok: true, ms: Date.now() - s2, result: count[0].cnt });

                // 3. INSERT into token_plans (Real table test)
                const s3 = Date.now();
                const randomSlug = `smoke_${Date.now()}_${i}`;
                await db('token_plans').insert({
                    id: crypto.randomUUID(),
                    slug: randomSlug,
                    name: `Smoke Test ${i}`,
                    token_limit: 100,
                    price: 0,
                    features: JSON.stringify({ test: true }),
                    created_at: new Date(),
                    updated_at: new Date()
                });
                iteration.operations.push({ op: 'INSERT token_plans', ok: true, ms: Date.now() - s3 });

                // 4. SELECT inserted
                const s4 = Date.now();
                const row = await db('token_plans').where({ slug: randomSlug }).first();
                iteration.operations.push({ op: 'SELECT inserted', ok: true, ms: Date.now() - s4, found: !!row });

                // 5. DELETE
                const s5 = Date.now();
                await db('token_plans').where({ slug: randomSlug }).del();
                iteration.operations.push({ op: 'DELETE', ok: true, ms: Date.now() - s5 });

                iteration.result = 'PASS';
                console.log(`  ✅ PASS (${iteration.operations.reduce((sum, op) => sum + op.ms, 0)}ms total)`);

            } catch (err) {
                iteration.result = 'FAIL';
                iteration.error = err.message.substring(0, 100);
                console.error(`  ❌ FAIL: ${err.message.substring(0, 80)}`);
            }

            results.push(iteration);
            console.log('');
        }

        // Cleanup
        console.log('[12/11] Cleanup...');
        await db.schema.dropTableIfExists('diagnostic_events');
        console.log('  ✅ OK\n');

    } catch (error) {
        console.error(`\n❌ Fatal error: ${error.message}\n`);
        results.push({ fatal: true, error: error.message });
    } finally {
        await db.destroy();
    }

    // Summary
    console.log('=== RESULTS ===\n');
    const passed = results.filter(r => r.result === 'PASS').length;
    const failed = results.filter(r => r.result === 'FAIL').length;

    console.log(`Passed: ${passed}/10`);
    console.log(`Failed: ${failed}/10`);

    if (failed > 0) {
        console.log('\nFailed attempts:');
        results.filter(r => r.result === 'FAIL').forEach(r => {
            console.log(`  - Attempt ${r.attempt}: ${r.error}`);
        });
    }

    console.log('');

    if (passed === 10) {
        console.log('✅ SMOKE_TEST_PASS\n');
        process.exit(0);
    } else {
        console.error('❌ SMOKE_TEST_FAIL\n');
        process.exit(1);
    }
}

main();
