
const knex = require('knex');
require('dotenv').config();

const db = knex({
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        connectTimeout: 5000 // 5 seconds timeout
    }
});

(async () => {
    console.log(`Testing connection to ${process.env.DB_HOST}...`);
    const start = Date.now();
    try {
        const result = await db.raw('SELECT 1+1 as result');
        console.log('✅ Connection Success!');
        console.log('Query Result:', result.rows[0]);
        console.log('Latency:', Date.now() - start, 'ms');
    } catch (e) {
        console.error('❌ Connection Failed:', e.message);
        if (e.code === 'ETIMEDOUT') {
            console.error('Reason: The server is not reachable. Check Firewall/IP whitelisting.');
        }
    } finally {
        await db.destroy();
    }
})();
