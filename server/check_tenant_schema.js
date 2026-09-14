
const connectionManager = require('./db/connectionManager');

(async () => {
    try {
        console.log('[Schema Check] Connecting...');
        const masterDb = connectionManager.getMaster();

        // Target specific tenant
        const tenant = await masterDb('tenants').where('name', 'ilike', '%Multirede%').first();
        if (!tenant) {
            console.log('Tenant Multirede not found');
            process.exit(0);
        }

        console.log('[Schema Check] Tenant:', tenant.name, tenant.id);
        const tenantDb = connectionManager.getTenantConnection(tenant);

        const columns = await tenantDb('information_schema.columns')
            .where({ table_name: 'comparison_jobs' })
            .select('column_name', 'data_type')
            .orderBy('column_name');

        console.log(JSON.stringify(columns, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
