
const connectionManager = require('./db/connectionManager');

async function run() {
    try {
        const db = connectionManager.getMaster();
        const schemaName = 'tenant_multirede';

        console.log(`Dropping/Creating schema ${schemaName}...`);
        await db.raw(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        await db.raw(`CREATE SCHEMA "${schemaName}"`);
        await db.raw(`GRANT ALL ON SCHEMA "${schemaName}" TO public`); // Or specific user

        console.log('Updating Tenant Record...');
        await db('tenants').where({ slug: 'multirede' }).update({
            db_name: schemaName
        });

        console.log('DONE');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
