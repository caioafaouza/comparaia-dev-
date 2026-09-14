
const knex = require('knex');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const { hashPassword } = require('./utils/password');

const DB_CONFIG = {
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    useNullAsDefault: true
};

const MASTER_MIGRATIONS = './migrations/master';
const TENANT_MIGRATIONS = './migrations/tenant';

async function resetSystem() {
    console.log('🚀 INITIALIZING FULL SYSTEM RESET...');
    const db = knex(DB_CONFIG);

    try {
        // 1. RESET MASTER (PUBLIC SCHEMA)
        console.log('\n--- 1. RESETTING MASTER (PUBLIC) ---');
        await db.raw('DROP SCHEMA public CASCADE');
        await db.raw('CREATE SCHEMA public');
        console.log('✅ Public schema recreated.');

        // Run Master Migrations
        console.log('Running Master Migrations...');
        await db.migrate.latest({
            directory: MASTER_MIGRATIONS,
            tableName: 'knex_migrations'
        });
        console.log('✅ Master Migrations Applied.');

        // 2. CREATE SUPER ADMIN
        console.log('\n--- 2. CREATING SUPER ADMIN ---');
        const adminEmail = 'contato@inctec.com.br';
        const adminPass = 'Caio1991*';
        const adminHash = await hashPassword(adminPass);

        await db('users').insert({
            id: uuidv4(),
            name: 'Inctec Sistemas',
            email: adminEmail,
            password: adminHash,
            role: 'PLATFORM_ADMIN',
            status: 'ACTIVE',
            created_at: new Date(),
            updated_at: new Date()
        });
        console.log(`✅ Super Admin created: ${adminEmail}`);

        // 3. CREATE DEMO TENANT
        console.log('\n--- 3. CREATING DEMO TENANT ---');
        const demoTenantId = '123e4567-e89b-12d3-a456-426614174000';
        const demoTenantSlug = 'demo';
        const demoDbName = 'tenant_demo';

        await db('tenants').insert({
            id: demoTenantId,
            name: 'Demo Company',
            slug: demoTenantSlug,
            db_host: process.env.DB_HOST,
            db_name: demoDbName,
            db_user: process.env.DB_USER,
            db_password: process.env.DB_PASSWORD,
            status: 'ACTIVE',
            plan: 'ENTERPRISE'
        });
        console.log(`✅ Tenant '${demoTenantSlug}' registered in master.`);

        // 4. RESET TENANT SCHEMA
        console.log(`\n--- 4. RESETTING TENANT SCHEMA (${demoDbName}) ---`);
        await db.raw(`DROP SCHEMA IF EXISTS ${demoDbName} CASCADE`);
        await db.raw(`CREATE SCHEMA ${demoDbName}`);
        console.log(`✅ Schema '${demoDbName}' recreated.`);

        // Run Tenant Migrations
        console.log(`Running Tenant Migrations for ${demoDbName}...`);

        // We need a separate connection config for the migrations to run on the specific schema
        // Knex migrations usually use the connection config to determine which table to lock/update
        // BUT schema support in Knex migrations needs 'searchPath' in connection string or 'schema' config

        // Strategy: Use a new knex instance targeted at the schema
        const tenantDb = knex({
            ...DB_CONFIG,
            searchPath: [demoDbName, 'public']
        });

        await tenantDb.migrate.latest({
            directory: TENANT_MIGRATIONS,
            tableName: 'knex_migrations',
            schemaName: demoDbName // Important for tracking migrations in the correct schema
        });
        console.log('✅ Tenant Migrations Applied.');

        // 5. CREATE TENANT USER
        console.log('\n--- 5. CREATING TENANT USER ---');
        const tenantAdminEmail = 'admin@demo.com';
        const tenantAdminPass = '123456';
        const tenantAdminHash = await hashPassword(tenantAdminPass);

        await tenantDb('users').insert({
            id: uuidv4(),
            name: 'Demo Admin',
            email: tenantAdminEmail,
            password: tenantAdminHash,
            role: 'ADMIN',
            status: 'ACTIVE',
            created_at: new Date(),
            updated_at: new Date()
        });
        console.log(`✅ Tenant User created: ${tenantAdminEmail}`);

        await tenantDb.destroy();

    } catch (err) {
        console.error('❌ FATAL ERROR DURING RESET:', err);
    } finally {
        await db.destroy();
        console.log('\n🏁 SYSTEM RESET COMPLETE.');
    }
}

resetSystem();
