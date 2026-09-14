
const connectionManager = require('./db/connectionManager');
const crypto = require('crypto');

(async () => {
    try {
        console.log('--- STARTING LEDGER BACKFILL ---');
        const masterDb = connectionManager.getMaster();
        const tenants = await masterDb('tenants');

        for (const tenant of tenants) {
            console.log(`Processing Tenant: ${tenant.name} (${tenant.id})`);
            const tenantDb = connectionManager.getTenantConnection(tenant);

            // Fetch all jobs
            const jobs = await tenantDb('comparison_jobs');
            console.log(`Found ${jobs.length} jobs.`);

            let added = 0;
            for (const job of jobs) {
                // Check if transaction exists
                const existing = await masterDb('token_transactions')
                    .where({ reference_id: job.id })
                    .first();

                if (!existing) {
                    // Determine Cost
                    const cost = job.cost || 10; // Default fallback
                    const status = job.status === 'COMPLETED' ? 'CONFIRMED' : 'CANCELLED';

                    await masterDb('token_transactions').insert({
                        id: crypto.randomUUID(),
                        tenant_id: tenant.id,
                        amount: -Math.abs(cost),
                        type: job.status === 'COMPLETED' ? 'TOKEN_USAGE' : 'TOKEN_REFUND',
                        reference_id: job.id,
                        status: status,
                        description: `Backfill for Job ${job.reference_name}`,
                        created_at: job.created_at || new Date()
                    });
                    added++;
                }
            }
            console.log(`Added ${added} ledger entries.`);
        }
        await masterDb.destroy();
        console.log('--- BACKFILL COMPLETE ---');
        process.exit(0);
    } catch (err) {
        console.error('Backfill Error:', err);
        process.exit(1);
    }
})();
