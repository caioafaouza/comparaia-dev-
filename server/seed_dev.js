
const knex = require('knex');
const config = require('./knexfile');

async function seed() {
    const db = knex(config.development);

    try {
        const exists = await db('tenants').where({ slug: 'demo' }).first();
        if (!exists) {
            await db('tenants').insert({
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Demo Company',
                slug: 'demo',
                db_host: 'localhost',
                db_name: 'tenant_demo', // Will be ignored by SQLite logic but required by schema
                db_user: 'admin',
                db_password: 'password',
                status: 'ACTIVE',
                plan: 'ENTERPRISE'
            });
            console.log('✅ Demo tenant created');
        } else {
            console.log('ℹ️ Demo tenant already exists');
        }
    } catch (err) {
        console.error('❌ Seed failed:', err);
    } finally {
        await db.destroy();
    }
}

seed();
