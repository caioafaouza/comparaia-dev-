
require('dotenv').config();
const connectionManager = require('./db/connectionManager');

(async () => {
    try {
        const db = connectionManager.getMaster();
        const tenant = await db('tenants').where({ slug: 'demo' }).first();
        console.log('Tenant:', tenant);

        if (tenant) {
            // Check if schema exists
            const res = await db.raw(`SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?`, [tenant.db_name]);
            console.log('Schema Exists:', res.rows.length > 0);

            // Check if table exists in schema
            if (res.rows.length > 0) {
                const tables = await db.raw(`SELECT table_name FROM information_schema.tables WHERE table_schema = ?`, [tenant.db_name]);
                console.log('Tables in Schema:', tables.rows.map(t => t.table_name));
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
})();
