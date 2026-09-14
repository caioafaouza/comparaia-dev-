
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

async function checkUsers() {
    const db = knex(DB_CONFIG);
    try {
        const tenants = await db('tenants').select('*');
        for (const tenant of tenants) {
            console.log(`\nTenant: ${tenant.slug}`);
            const schemaName = `tenant_${tenant.slug.replace(/-/g, '_')}`;

            try {
                const users = await db.withSchema(schemaName).select('*').from('users');
                console.log(`   User Count: ${users.length}`);
                if (users.length > 0) {
                    users.forEach(u => console.log(`   - ${u.id} (${u.email})`));
                } else {
                    console.log('   ⚠️ NO USERS FOUND!');
                }
            } catch (e) {
                console.log(`   ❌ Error: ${e.message}`);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await db.destroy();
    }
}

checkUsers();
