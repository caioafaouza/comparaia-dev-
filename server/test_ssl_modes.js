
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
    }
};

async function test(name, sslConfig) {
    console.log(`\n--- Testing ${name} ---`);
    const db = knex({ ...configBase, connection: { ...configBase.connection, ssl: sslConfig } });
    try {
        await db.raw('SELECT 1');
        console.log(`✅ ${name}: SUCCESS`);
    } catch (e) {
        console.log(`❌ ${name}: FAILED`);
        console.log(`   Error: ${e.message}`);
    } finally {
        await db.destroy();
    }
}

(async () => {
    await test('No SSL', false);
    await test('SSL (Reject Unauthorized: false)', { rejectUnauthorized: false });
})();
