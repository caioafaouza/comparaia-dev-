
const connectionManager = require('./db/connectionManager');

(async () => {
    try {
        const masterDb = connectionManager.getMaster();
        const columns = await masterDb('information_schema.columns')
            .where({ table_name: 'token_plans' })
            .select('column_name', 'data_type', 'ordinal_position')
            .orderBy('ordinal_position');

        const tenant = await masterDb('tenants').select('*');
        console.log('TENANTS:', JSON.stringify(tenant, null, 2));

        console.log(JSON.stringify(columns, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
