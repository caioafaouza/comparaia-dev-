
const connectionManager = require('./db/connectionManager');

async function run() {
    try {
        const db = connectionManager.getMaster();

        console.log('--- Tenant Record ---');
        const tenant = await db('tenants').where({ slug: 'multirede' }).first();
        console.log(tenant);

        if (tenant) {
            console.log('\n--- Tenant Users (using connectionManager logic) ---');
            // Mimic connectionManager.getTenantConnection
            const tenantDb = connectionManager.getTenantConnection(tenant);
            try {
                const users = await tenantDb('users').select('*');
                console.log('Users found:', users.length);
                if (users.length > 0) {
                    const u = users[0];
                    console.log('User[0]:', u.email, u.password);
                    const bcrypt = require('bcryptjs');
                    const match = await bcrypt.compare('123456', u.password);
                    console.log('Password Match "123456":', match);
                }
            } catch (e) {
                console.error('Error querying tenant users:', e.message);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
