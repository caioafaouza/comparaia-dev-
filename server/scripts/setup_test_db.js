const { Client } = require('pg');
require('dotenv').config();

const config = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres', // Connect to default DB to create new one
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

async function setupTestDb() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log('Connected to Postgres root/default DB.');

        const checkDb = await client.query("SELECT 1 FROM pg_database WHERE datname = 'comparaia_test'");
        if (checkDb.rowCount === 0) {
            console.log('Creating database comparaia_test...');
            await client.query('CREATE DATABASE comparaia_test');
            console.log('Database comparaia_test created.');
        } else {
            console.log('Database comparaia_test already exists.');
        }
    } catch (err) {
        console.error('Failed to setup test DB:', err.message);
        if (err.code === '28P01') { // invalid password
            console.error('Auth failed.');
        } else if (err.code === '42501') { // insufficient privilege
            console.error('User does not have CREATEDB privilege.');
        }
    } finally {
        await client.end();
    }
}

setupTestDb();
