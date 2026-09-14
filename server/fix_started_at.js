
const connectionManager = require('./db/connectionManager');

(async () => {
    console.log('--- FIXING STARTED_AT ---');
    const db = connectionManager.getMaster();

    try {
        const hasStarted = await db.schema.hasColumn('comparison_jobs', 'started_at');
        if (!hasStarted) {
            console.log('Adding started_at...');
            await db.schema.alterTable('comparison_jobs', (table) => {
                table.timestamp('started_at').nullable();
            });
        } else {
            console.log('started_at already exists.');
        }

        const hasCompleted = await db.schema.hasColumn('comparison_jobs', 'completed_at');
        if (!hasCompleted) {
            console.log('Adding completed_at...');
            await db.schema.alterTable('comparison_jobs', (table) => {
                table.timestamp('completed_at').nullable();
            });
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
