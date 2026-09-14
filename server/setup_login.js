
require('dotenv').config();
const knex = require('knex');
const crypto = require('crypto');
const { hashPassword } = require('./utils/password');

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

const TARGET_EMAIL = 'contato@inctec.com.br';
const TARGET_PASS = '123456';
const TENANT_SLUG = 'demo';

async function setupLogin() {
    console.log(`--- SETTING UP LOGIN: ${TARGET_EMAIL} ---`);
    const db = knex(DB_CONFIG);

    try {
        const schemaName = `tenant_${TENANT_SLUG.replace(/-/g, '_')}`;

        // 1. Generate Hash (bcrypt)
        const passwordHash = await hashPassword(TARGET_PASS);

        // 2. Insert/Update User
        // Use a consistent ID if possible, or random.
        // Let's first check if this email exists to get ID, or insert fresh.
        const existing = await db.withSchema(schemaName).select('*').from('users').where({ email: TARGET_EMAIL }).first();

        if (existing) {
            console.log(`Updating existing user ${existing.id}...`);
            await db.withSchema(schemaName).table('users').where({ id: existing.id }).update({
                password: passwordHash,
                status: 'ACTIVE',
                role: 'OWNER'
            });
        } else {
            const newId = crypto.randomUUID();
            console.log(`Creating new user ${newId}...`);
            await db.withSchema(schemaName).table('users').insert({
                id: newId,
                name: 'Gestor INCTEC',
                email: TARGET_EMAIL,
                password: passwordHash, // bcrypt
                role: 'OWNER',
                status: 'ACTIVE',
                created_at: new Date()
            });
        }

        console.log(`✅ Login configured for ${TENANT_SLUG}.`);
        console.log(`   Email: ${TARGET_EMAIL}`);
        console.log(`   Pass:  ${TARGET_PASS}`);

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await db.destroy();
    }
}

setupLogin();
