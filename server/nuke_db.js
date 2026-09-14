
const connectionManager = require('./db/connectionManager');

async function nuke() {
    console.log('[NUKE] starting...');
    try {
        const db = connectionManager.getMaster();
        console.log('[NUKE] Dropping Schema public...');
        await db.raw('DROP SCHEMA public CASCADE');
        console.log('[NUKE] Recreating Schema public...');
        await db.raw('CREATE SCHEMA public');
        console.log('[NUKE] Granting permissions...');
        await db.raw('GRANT ALL ON SCHEMA public TO public');
        // Note: 'public' role usually defaults to no create in PG 15+, but 'GRANT ALL' helps.
        // Or grant to current user.
        console.log('[NUKE] DONE.');
        process.exit(0);
    } catch (e) {
        console.error('[NUKE] FATAL:', e);
        process.exit(1);
    }
}
nuke();
