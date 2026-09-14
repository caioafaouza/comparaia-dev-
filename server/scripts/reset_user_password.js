
require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const EMAIL = process.argv[2];
const NEW_PASSWORD = process.argv[3] || '123456';

if (!EMAIL) {
    console.error('Usage: node reset_user_password.js <email> [new_password]');
    process.exit(1);
}

// Support for both connection string and individual params
const dbConfig = {
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const client = new Client(dbConfig);

async function run() {
    try {
        await client.connect();
        console.log(`Connected to database. Resetting password for: ${EMAIL}`);

        // Check if user exists
        const res = await client.query('SELECT id, email, name FROM users WHERE email = $1', [EMAIL]);
        if (res.rows.length === 0) {
            console.error(`User with email ${EMAIL} not found.`);
            process.exit(1);
        }

        const user = res.rows[0];
        console.log(`Found user: ${user.name} (${user.id})`);

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(NEW_PASSWORD, salt);

        // Update password
        await client.query('UPDATE users SET password = $1 WHERE id = $2', [hash, user.id]);

        console.log(`✅ Password for ${EMAIL} successfully reset to: ${NEW_PASSWORD}`);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
