
require('dotenv').config();
const connectionManager = require('./db/connectionManager');

(async () => {
    console.log('🌱 SEEDING DEMO TENANT...');
    const master = connectionManager.getMaster();

    try {
        // 1. Check if demo exists
        const existing = await master('tenants').where({ slug: 'demo' }).first();
        if (existing) {
            console.log('✅ Demo tenant already exists.');
        } else {
            console.log('✨ Creating Demo Tenant...');
            await master('tenants').insert({
                id: '00000000-0000-0000-0000-000000000000',
                name: 'Demo Company',
                slug: 'demo',
                db_name: 'tenant_demo',
                db_host: 'localhost',
                db_user: 'postgres',
                db_password: 'pwd',
                status: 'ACTIVE'
            });
            console.log('✅ Demo tenant record inserted.');
        }

        // 2. Create Schema if Not Exists (using raw query)
        const knex = connectionManager.getMaster(); // Reuse connection
        await knex.raw('CREATE SCHEMA IF NOT EXISTS tenant_demo');
        console.log('✅ Schema tenant_demo ensured.');

        // 3. Run Migrations for this new tenant
        // We can manually run constraints or leverage the migration system if configured
        console.log('🔄 Running initial schema setup for tenant_demo...');

        // Manual Schema Creation (Faster than invoking migration system programmatically right now)
        const tenantDb = connectionManager.getTenantConnection({ id: 'demo-id', slug: 'demo', db_name: 'tenant_demo' });

        const hasJobs = await tenantDb.schema.hasTable('comparison_jobs');
        if (!hasJobs) {
            await tenantDb.schema.createTable('users', table => {
                table.uuid('id').primary();
                table.string('name').notNullable();
                table.string('email').unique().notNullable();
                table.string('password').notNullable();
                table.string('role').defaultTo('MEMBER');
                table.string('status').defaultTo('ACTIVE');
                table.timestamps(true, true);
            });
            await tenantDb.schema.createTable('comparison_jobs', table => {
                table.uuid('id').primary(); // Default UUID generation handled by app or DB
                table.uuid('user_id').references('id').inTable('users');
                table.string('reference_name').notNullable();
                table.string('status').defaultTo('QUEUED');
                table.integer('candidate_count').defaultTo(0);
                table.decimal('cost', 10, 2).defaultTo(0);
                table.json('result');
                table.text('error_message');
                table.timestamp('created_at').defaultTo(knex.fn.now());
                table.timestamp('completed_at');
            });
            console.log('✅ Tables created in tenant_demo.');
        } else {
            console.log('✅ Tables already exist.');
        }

    } catch (e) {
        console.error('❌ Seeding failed:', e);
    } finally {
        process.exit();
    }
})();
