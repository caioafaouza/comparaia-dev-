
const { v4: uuidv4 } = require('uuid');
const { hashPassword } = require('./utils/password');
const knex = require('knex');
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
        const existing = await db('users').where({ email: 'superadmin@comparaia.com' }).first();

        if (existing) {
            console.log('✅ Super Admin already exists:', existing.id);
        } else {
            const passwordHash = await hashPassword('admin123');
            const [id] = await db('users').insert({
                id: uuidv4(),
                name: 'Super Admin',
                email: 'superadmin@comparaia.com',
                password: passwordHash,
                role: 'SUPER_ADMIN',
                status: 'ACTIVE',
                created_at: new Date(),
                updated_at: new Date()
            }).returning('id');
            console.log('🎉 Created Super Admin:', id);
        }

        // Also check if system_config table is ready
        const config = await db('system_config').select('*');
        console.log('System Config entries:', config.length);

    } catch (e) {
        console.error('❌ Error seeding admin:', e);
    } finally {
        await db.destroy();
    }
})();
