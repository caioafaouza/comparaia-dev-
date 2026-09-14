
require('dotenv').config();
const knex = require('knex');

const DB_CONFIG = {
    client: 'pg',
    connection: {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    }
};

async function checkTenants() {
    console.log('--- CHECKING TENANTS ---');
    const db = knex(DB_CONFIG);
    try {
        const tenants = await db('tenants').select('*');
        console.table(tenants);
    } catch (e) {
        console.error(e);
    } finally {
        await db.destroy();
    }
}

checkTenants();
