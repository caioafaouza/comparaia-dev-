
const connectionManager = require('./db/connectionManager');

(async () => {
    try {
        console.log('[DB] Connecting...');
        const masterDb = connectionManager.getMaster();

        // 1. Get Latest Transaction
        const txs = await masterDb('token_transactions')
            .select('id', 'tenant_id', 'amount', 'type', 'status', 'reference_id', 'created_at')
            .orderBy('created_at', 'desc')
            .limit(1);

        if (txs.length === 0) {
            console.log('No transactions found.');
            process.exit(0);
        }

        const latestTx = txs[0];
        console.log('--- LATEST TRANSACTION ---');
        console.log(JSON.stringify(latestTx, null, 2));

        // 2. Get Job Details (if reference exists)
        if (latestTx.reference_id && latestTx.tenant_id) {
            const tenant = await masterDb('tenants').where({ id: latestTx.tenant_id }).first();
            if (tenant) {
                const tenantDb = connectionManager.getTenantConnection(tenant);
                const job = await tenantDb('comparison_jobs')
                    .where({ id: latestTx.reference_id })
                    .select('id', 'status', 'error_message', 'created_at', 'completed_at')
                    .first();

                console.log('--- LINKED JOB ---');
                if (job) {
                    console.log(JSON.stringify(job, null, 2));
                } else {
                    console.log('Job not found in tenant DB.');
                }
            } else {
                console.log('Tenant not found.');
            }
        }

        process.exit(0);
    } catch (e) {
        console.error('[ERROR]', e);
        process.exit(1);
    }
})();
