const knex = require('knex');
const config = require('../config/env');

const db = knex({
    client: 'pg',
    connection: config.db,
    searchPath: ['public']
});

async function debugUsers() {
    console.log('🔍 Debugging Tenant Users...');

    try {
        const tenants = await db('tenants').select('id', 'name', 'slug', 'db_name');
        console.log(`Found ${tenants.length} tenants.`);

        for (const tenant of tenants) {
            console.log(`\n--- Tenant: ${tenant.name} (${tenant.slug}) ---`);
            console.log(`Schema: ${tenant.db_name}`);

            try {
                // Check Schema Existence
                const schemaExists = await db.raw(`SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?`, [tenant.db_name]);
                if (schemaExists.rows.length === 0) {
                    console.error('❌ Schema does NOT exist!');
                    continue;
                }

                // Check Users Table
                const hasUsersTable = await db.schema.withSchema(tenant.db_name).hasTable('users');
                if (!hasUsersTable) {
                    console.error('❌ Users table MISSING!');
                    continue;
                }

                // Count Users
                const users = await db.withSchema(tenant.db_name).select('id', 'name', 'email', 'role').from('users');
                console.log(`Count: ${users.length}`);
                if (users.length > 0) {
                    console.table(users);
                } else {
                    console.log('⚠️  No users found.');
                }

            } catch (err) {
                console.error('❌ Error querying tenant:', err.message);
            }
        }

    } catch (err) {
        console.error('Fatal:', err);
    } finally {
        await db.destroy();
    }
}

debugUsers();
