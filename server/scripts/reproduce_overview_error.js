
const connectionManager = require('../db/connectionManager');
const billingService = require('../services/billingService');

async function reproduce() {
    try {
        console.log('1. Fetching Master DB');
        const db = connectionManager.getMaster();

        console.log('2. Fetching Tenants');
        const tenants = await db('tenants').select('id', 'name', 'slug', 'db_name', 'plan', 'status', 'created_at', 'cnpj', 'phone', 'sector', 'purchase_volume', 'custom_domain', 'brand_color', 'logo_url');
        console.log(`Found ${tenants.length} tenants`);

        let totalUsers = 0;
        let totalJobs = 0;
        let successJobs = 0;
        let totalLatencyMs = 0;
        let latencyCount = 0;
        let tokensConsumed = 0;

        const tenantsWithStats = [];

        for (const tenant of tenants) {
            console.log(`Processing tenant: ${tenant.slug} (${tenant.db_name})`);
            try {
                // Users Count
                console.log(`- Fetching Users`);
                const usersCount = await db.withSchema(tenant.db_name).count('id as count').from('users').first();
                if (usersCount) totalUsers += parseInt(usersCount.count);

                // Jobs Stats
                let tenantJobsCount = 0;
                console.log(`- Checking Jobs Table`);
                // Note: db.schema.withSchema might throw if schema doesn't exist?
                const hasFunctions = await db.schema.withSchema(tenant.db_name).hasTable('comparison_jobs');

                if (hasFunctions) {
                    console.log(`- Fetching Jobs`);
                    const jobs = await db.withSchema(tenant.db_name)
                        .select('status', 'cost', 'created_at', 'completed_at')
                        .from('comparison_jobs');

                    tenantJobsCount = jobs.length;
                    totalJobs += tenantJobsCount;

                    jobs.forEach(job => {
                        if (job.status === 'COMPLETED') {
                            successJobs++;
                            if (job.created_at && job.completed_at) {
                                const start = new Date(job.created_at).getTime();
                                const end = new Date(job.completed_at).getTime();
                                const diff = end - start;
                                if (diff > 0) {
                                    totalLatencyMs += diff;
                                    latencyCount++;
                                }
                            }
                        }
                        if (job.cost) {
                            tokensConsumed += Math.round(parseFloat(job.cost));
                        }
                    });
                } else {
                    console.log(`- Jobs Table Missing`);
                }

                console.log(`- Fetching Wallet`);
                let wallet = { balance: 0 };
                try {
                    wallet = await billingService.getTenantWalletBalance(tenant);
                    console.log(`- Wallet: ${wallet.balance}`);
                } catch (err) {
                    console.warn(`- Wallet Error: ${err.message}`);
                }

                tenantsWithStats.push({
                    id: tenant.id,
                    slug: tenant.slug,
                    hasStats: true
                });
            } catch (e) {
                console.error(`- Tenant Loop Error: ${e.message}`);
            }
        }

        console.log('3. Fetching Global Config');
        const configRow = await db('system_config').where({ key: 'GLOBAL_CONFIG' }).first();
        console.log('Config Row:', configRow ? 'Found' : 'Missing');

        console.log('Done!');
        process.exit(0);

    } catch (error) {
        console.error('CRITICAL ERROR:', error);
        process.exit(1);
    }
}

reproduce();
