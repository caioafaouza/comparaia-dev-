
const { v4: uuidv4 } = require('uuid');
const knex = require('knex');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const db = knex({
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    }
});

(async () => {
    console.log(`Connecting to ${process.env.DB_HOST} as ${process.env.DB_USER}...`);
    try {
        const email = 'contato@inctec.com.br';
        const rawPassword = 'Caio1991*';
        const passwordHash = bcrypt.hashSync(rawPassword, 10);

        // Note: Using PLATFORM_ADMIN because the frontend looks for this specific role string
        // in SaaSLayout.tsx to show the Admin button.
        const targetRole = 'PLATFORM_ADMIN';

        const existing = await db('users').where({ email }).first();

        if (existing) {
            console.log('⚠️ User already exists. Updating role to PLATFORM_ADMIN...');
            await db('users').where({ email }).update({
                name: 'Inctec Sistemas',
                password: passwordHash,
                role: targetRole,
                updated_at: new Date()
            });
            console.log('✅ User updated successfully.');
        } else {
            const [id] = await db('users').insert({
                id: uuidv4(),
                name: 'Inctec Sistemas',
                email: email,
                password: passwordHash,
                role: targetRole,
                status: 'ACTIVE',
                created_at: new Date(),
                updated_at: new Date()
            }).returning('id');
            console.log('🎉 Created Real Super Admin:', id);
        }

    } catch (e) {
        console.error('❌ Error creating/updating admin:', e);
    } finally {
        await db.destroy();
    }
})();
