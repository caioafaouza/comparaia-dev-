// DB Activity Snapshot - Diagnostics for pg_stat_activity and locks
// Run: node server/scripts/db_activity_snapshot.cjs

const path = require('path');
const fs = require('fs');
require('dotenv').config({
    path: process.env.DOTENV_PATH
        ? path.resolve(process.env.DOTENV_PATH)
        : path.resolve(__dirname, '..', '.env')
});

const knex = require('knex');

async function main() {
    console.log('\n=== DB ACTIVITY SNAPSHOT ===\n');

    const dbName = process.env.DB_DATABASE || 'comparaia';

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
        pool: { min: 0, max: 1 },
    });

    const snapshot = {
        timestamp: new Date().toISOString(),
        activity: {},
        locks: []
    };

    try {
        // 1. Connection states summary
        console.log('[1/3] Querying connection states...\n');

        const states = await db.raw(`
            SELECT state, COUNT(*) as count
            FROM pg_stat_activity
            WHERE datname = '${dbName}'
            GROUP BY state
            ORDER BY count DESC
        `);

        snapshot.activity.by_state = states.rows;
        states.rows.forEach(s => console.log(`  ${s.state || 'null'}: ${s.count} connection(s)`));
        console.log('');

        // 2. Top connections detail
        console.log('[2/3] Top 10 recent connections...\n');

        const connections = await db.raw(`
            SELECT 
                pid,
                usename,
                application_name,
                client_addr,
                state,
                EXTRACT(EPOCH FROM (NOW() - state_change)) as state_age_seconds,
                LEFT(query, 80) as query_preview
            FROM pg_stat_activity
            WHERE datname = '${dbName}'
            AND pid <> pg_backend_pid()
            ORDER BY state_change DESC
            LIMIT 10
        `);

        snapshot.activity.top_connections = connections.rows;
        connections.rows.forEach(c => {
            console.log(`  PID ${c.pid}: ${c.usename}@${c.client_addr || 'local'}`);
            console.log(`    state=${c.state}, age=${Math.floor(c.state_age_seconds || 0)}s`);
            console.log(`    query=${c.query_preview || 'none'}`);
        });
        console.log('');

        // 3. Locks
        console.log('[3/3] Checking locks...\n');

        const locks = await db.raw(`
            SELECT 
                l.locktype,
                l.mode,
                l.granted,
                l.pid,
                a.usename,
                a.state,
                LEFT(a.query, 60) as query_preview
            FROM pg_locks l
            LEFT JOIN pg_stat_activity a ON l.pid = a.pid
            WHERE a.datname = '${dbName}'
            ORDER BY l.granted ASC, l.pid
            LIMIT 20
        `);

        snapshot.locks = locks.rows;

        if (locks.rows.length === 0) {
            console.log('  No locks found (good)\n');
        } else {
            locks.rows.forEach(l => {
                const icon = l.granted ? '✅' : '❌';
                console.log(`  ${icon} ${l.locktype} ${l.mode} (PID ${l.pid}, ${l.state})`);
            });
            console.log('');
        }

        // Summary
        const totalConns = snapshot.activity.by_state.reduce((sum, s) => sum + parseInt(s.count), 0);
        const idleInTxn = snapshot.activity.by_state.find(s => s.state === 'idle in transaction');
        const ungrantedLocks = snapshot.locks.filter(l => !l.granted).length;

        console.log('=== SUMMARY ===\n');
        console.log(`Total connections: ${totalConns}`);
        console.log(`Idle in transaction: ${idleInTxn ? idleInTxn.count : 0}`);
        console.log(`Ungranted locks: ${ungrantedLocks}`);
        console.log('');

        // Write snapshot
        const outputDir = path.resolve(__dirname, '..', 'test-results');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const snapshotPath = path.join(outputDir, 'db_activity_snapshot.json');
        fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

        console.log(`✅ Snapshot saved: ${snapshotPath}\n`);
        console.log('✅ SNAPSHOT_OK\n');

        await db.destroy();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Snapshot failed:', error.message);
        await db.destroy();
        process.exit(1);
    }
}

main();
