
const bcrypt = require('bcryptjs');
const knex = require('knex');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const db = knex({
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    }
});

(async () => {
    console.log(`Connecting to ${process.env.DB_HOST}...`);
    try {
        const email = 'contato@inctec.com.br';
        const passwordPlain = 'Caio1991*';

        // Generate Bcrypt hash
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(passwordPlain, salt);

        console.log(`Updating password for ${email} to Bcrypt hash...`);

        const result = await db('users')
            .where({ email })
            .update({
                password: hash,
                updated_at: new Date()
            });

        if (result) {
            console.log('✅ Password updated successfully (Bcrypt).');
        } else {
            console.log('❌ User not found in master users table.');
        }

    } catch (e) {
        console.error('❌ Error updating password:', e);
    } finally {
        await db.destroy();
    }
})();
