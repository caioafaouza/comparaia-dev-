
const knex = require('knex');
require('dotenv').config();

const configBase = {
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        ssl: { rejectUnauthorized: false }
    }
};

(async () => {
    console.log('--- Testing FORCE SSL ---');
    const db = knex(configBase);
    try {
        await db.raw('SELECT 1');
        console.log('✅ SSL: SUCCESS (Server supports SSL)');
    } catch (e) {
        console.log('❌ SSL: FAILED');
        console.log(`   Error: ${e.message}`);
        if (e.message.includes('server does not support SSL')) {
            console.log('   -> CONFIRMED: Server has ssl=off in postgresql.conf');
        }
    } finally {
        await db.destroy();
    }
})();
