
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

async function restoreUser() {
    console.log('--- RESTORING USER ---');
    const db = knex(DB_CONFIG);

    try {
        const userId = '770d0ce0-be83-485d-9f64-2de42ceb9958'; // The ID seen in logs/demo
        const tenantSlug = 'inctec-sistemas';
        const schemaName = `tenant_${tenantSlug.replace(/-/g, '_')}`;

        console.log(`Target: ${tenantSlug} (${schemaName})`);

        // Insert User
        await db.withSchema(schemaName).insert({
            id: userId,
            name: 'Admin Restaurado',
            email: 'admin@inctec.com.br', // Using a generic email for this tenant
            password: 'hashed_password_placeholder', // Should verify auth doesn't define plain text
            role: 'OWNER',
            status: 'ACTIVE',
            created_at: new Date()
        }).into('users')
            .onConflict('id')
            .ignore(); // If exists, ignore

        console.log(`✅ User ${userId} restored/verified in ${tenantSlug}.`);

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await db.destroy();
    }
}

restoreUser();
