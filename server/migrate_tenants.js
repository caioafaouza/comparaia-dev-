
const connectionManager = require('./db/connectionManager');
const path = require('path');

(async () => {
    try {
        console.log('[Migrator] Connecting to Master...');
        const masterDb = connectionManager.getMaster();

        const tenants = await masterDb('tenants').select('*');
        console.log(`[Migrator] Found ${tenants.length} tenants.`);

        for (const tenant of tenants) {
            console.log(`[Migrator] Migrating tenant: ${tenant.name} (${tenant.id})`);
            try {
                const tenantDb = connectionManager.getTenantConnection(tenant);

                // Run migrations using "tenant" configuration directory
                await tenantDb.migrate.latest({
                    directory: path.join(__dirname, 'migrations/tenant'),
                    tableName: 'knex_migrations_tenant'
                });

                console.log(`[Migrator] ✅ Success: ${tenant.name}`);
            } catch (err) {
                console.error(`[Migrator] ❌ Failed: ${tenant.name}`, err.message);
            }
        }

        console.log('[Migrator] All done.');
        process.exit(0);

    } catch (e) {
        console.error('[Migrator] Critical Error:', e);
        process.exit(1);
    }
})();
