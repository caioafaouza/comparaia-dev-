
const connectionManager = require('./db/connectionManager');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function run() {
    try {
        const db = connectionManager.getMaster();
        const email = 'admin@platform.com'; // Default
        const password = 'master123';

        console.log(`Seeding Admin ${email}...`);

        const hash = await bcrypt.hash(password, 10);

        // Remove existing if any
        await db('users').withSchema('public').where({ email }).del();

        await db('users').withSchema('public').insert({
            id: crypto.randomUUID(),
            name: 'Platform Admin',
            email,
            password: hash,
            role: 'PLATFORM_ADMIN',
            status: 'ACTIVE',
            created_at: new Date(),
            updated_at: new Date()
        });

        console.log('DONE');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
