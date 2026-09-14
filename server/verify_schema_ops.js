
const connectionManager = require('./db/connectionManager');
(async () => {
    try {
        const db = connectionManager.getMaster();
        const tCols = await db('token_transactions').columnInfo();
        const jCols = await db('comparison_jobs').columnInfo();

        console.log('--- SCHEMA CHECK ---');
        console.log('Token Transactions:', Object.keys(tCols).includes('reference_id') && Object.keys(tCols).includes('status') ? 'PASS' : 'FAIL');
        console.log('Comparison Jobs:', Object.keys(jCols).includes('started_at') && Object.keys(jCols).includes('completed_at') ? 'PASS' : 'FAIL');

        console.log('--- COLUMNS ---');
        console.log('transactions:', Object.keys(tCols));
        console.log('jobs:', Object.keys(jCols));

        process.exit(0);
    } catch (e) { console.error(e); process.exit(1); }
})();
