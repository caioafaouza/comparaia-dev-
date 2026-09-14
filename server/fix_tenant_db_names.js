
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

async function fixTenantNames() {
    console.log('--- FIXING TENANT DB_NAMES ---');
    const db = knex(DB_CONFIG);
    try {
        const tenants = await db('tenants').select('*');
        for (const t of tenants) {
            const correctName = `tenant_${t.slug.replace(/-/g, '_')}`;
            console.log(`Tenant ${t.slug}: db_name='${t.db_name}' -> '${correctName}'`);

            if (t.db_name !== correctName) {
                await db('tenants').where({ id: t.id }).update({ db_name: correctName });
                console.log('   ✅ Updated.');
            } else {
                console.log('   MATCH (No change needed).');
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await db.destroy();
    }
}

fixTenantNames();
