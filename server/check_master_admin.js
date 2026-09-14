
const connectionManager = require('./db/connectionManager');

async function run() {
    try {
        const db = connectionManager.getMaster();

        console.log('--- Public Users ---');
        const users = await db('users').withSchema('public').where({ role: 'PLATFORM_ADMIN' });
        console.log('Admins found:', users.length);
        if (users.length > 0) console.log('Admin[0]:', users[0].email);
        else console.log('NO ADMIN FOUND.');

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
