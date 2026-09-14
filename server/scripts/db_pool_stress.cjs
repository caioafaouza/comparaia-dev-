// DB Pool Stress Test - Tests 30 concurrent SELECT 1 queries
// Run: node server/scripts/db_pool_stress.cjs

const path = require('path');
require('dotenv').config({
    path: process.env.DOTENV_PATH
        ? path.resolve(process.env.DOTENV_PATH)
        : path.resolve(__dirname, '..', '.env')
});

const knex = require('knex');

const CONCURRENT_QUERIES = 30;

async function main() {
    console.log('\n=== DB POOL STRESS TEST ===\n');
    console.log(`Concurrent queries: ${CONCURRENT_QUERIES}\n`);

    const db = knex({
        client: 'pg',
        connection: {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        },
        pool: {
            min: 0,
            max: 10,  // Allow up to 10 concurrent
            acquireTimeoutMillis: 20000,
        },
    });

    try {
        console.log('Launching queries...\n');

        const start = Date.now();
        const queries = Array.from({ length: CONCURRENT_QUERIES }, (_, i) =>
            db.raw('SELECT 1 as ping')
                .then(() => ({ id: i, ok: true, error: null }))
                .catch(err => ({ id: i, ok: false, error: err.message.substring(0, 60) }))
        );

        const results = await Promise.all(queries);
        const elapsed = Date.now() - start;

        const passed = results.filter(r => r.ok).length;
        const failed = results.filter(r => !r.ok).length;

        console.log('=== RESULTS ===\n');
        console.log(`Total time: ${elapsed}ms`);
        console.log(`Passed: ${passed}/${CONCURRENT_QUERIES}`);
        console.log(`Failed: ${failed}/${CONCURRENT_QUERIES}`);
        console.log('');

        if (failed > 0) {
            console.log('Failed queries:');
            results.filter(r => !r.ok).forEach(r => {
                console.log(`  Query ${r.id}: ${r.error}`);
            });
            console.log('');
        }

        await db.destroy();

        // Tolerance: allow up to 1 failure (transient network)
        if (failed <= 1) {
            console.log('✅ POOL_STRESS_PASS\n');
            process.exit(0);
        } else {
            console.error('❌ POOL_STRESS_FAIL (too many failures)\n');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Stress test failed:', error.message);
        await db.destroy();
        process.exit(1);
    }
}

main();
