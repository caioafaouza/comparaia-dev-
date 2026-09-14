
const connectionManager = require('./db/connectionManager');

(async () => {
    console.log('--- FORCING SCHEMA UPDATE ---');
    const db = connectionManager.getMaster();

    try {
        // 1. Token Transactions (Master)
        console.log('Checking token_transactions...');
        const hasRef = await db.schema.hasColumn('token_transactions', 'reference_id');
        if (!hasRef) {
            console.log('Adding reference_id & status...');
            await db.schema.alterTable('token_transactions', (table) => {
                table.string('reference_id').nullable();
                table.string('status').defaultTo('CONFIRMED');
                table.index(['reference_id']);
            });
        } else {
            console.log('token_transactions OK.');
        }

        // 2. Comparison Jobs (Tenant Public)
        // We update the "Master Tenant" (public schema) just in case.
        // Real tenants need their own migration or this script iterating tenants.
        console.log('Checking public.comparison_jobs...');
        const hasStarted = await db.schema.hasColumn('comparison_jobs', 'started_at');
        if (!hasStarted) {
            // Check if table exists first (it might not in master)
            const hasTable = await db.schema.hasTable('comparison_jobs');
            if (hasTable) {
                console.log('Adding started_at/completed_at...');
                await db.schema.alterTable('comparison_jobs', (table) => {
                    table.timestamp('started_at').nullable();
                    table.timestamp('completed_at').nullable();
                    table.text('error_message').nullable();
                    table.json('result').nullable();
                });
            } else {
                console.log('comparison_jobs table not found in Master (Expected if tenant-only).');
            }
        } else {
            console.log('comparison_jobs OK.');
        }

        console.log('--- SUCCESS ---');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
