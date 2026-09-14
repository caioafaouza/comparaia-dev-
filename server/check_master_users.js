
const knex = require('knex');
require('dotenv').config();

const DB_CONFIG = {
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    }
};

async function checkMaster() {
    const db = knex(DB_CONFIG);
    try {
        const users = await db('users').select('*');
        console.log('--- MASTER USERS ---');
        users.forEach(u => console.log(`- ${u.email} (${u.role})`));
    } catch (e) { console.error(e); }
    finally { db.destroy(); }
}

checkMaster();
