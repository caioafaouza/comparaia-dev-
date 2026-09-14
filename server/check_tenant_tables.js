
const connectionManager = require('./db/connectionManager');

async function run() {
    try {
        const db = connectionManager.getMaster();
        const schema = 'tenant_multirede';
        console.log(`Checking schema ${schema}...`);

        const users = await db('users')
            .withSchema(schema)
            .select('*');

        console.log('Tenant Users:', users.length);
        if (users.length > 0) console.log('User 1:', users[0].email);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
