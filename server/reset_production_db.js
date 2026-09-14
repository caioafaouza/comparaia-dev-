
console.log("HELLO WORLD");
const connectionManager = require('./db/connectionManager');
const path = require('path');
const config = require('./knexfile');

async function resetProductionDb() {
    try {
        console.log('[RESET] Starting Production Database Clean (Master + Tenant)...');

        // 0. Connect Master
        const masterDb = connectionManager.getMaster();

        console.log('[DEBUG] __dirname:', __dirname);
        console.log('[DEBUG] Migration Path:', path.join(__dirname, 'migrations/master'));

        // 1. Drop Master Tables (Reverse Order of creation usually)
        // Hardcoded list based on knexfile/migrations
        console.log('[RESET] Dropping Master Tables (CASCADE)...');
        // Use raw SQL for CASCADE support which knex dropTableIfExists doesn't always strictly enforce in all dialects same way or just to be safe.
        // Actually knex.schema.dropTableIfExists doesn't accept cascade.
        // We must use raw.
        const tables = ['audit_logs', 'billing_failures', 'tenant_api_keys', 'token_transactions', 'token_plans', 'users', 'tenants', 'system_config', 'knex_migrations', 'knex_migrations_lock'];

        for (const t of tables) {
            await masterDb.raw(`DROP TABLE IF EXISTS "${t}" CASCADE`);
        }

        console.log('[RESET] Master Tables Dropped.');

        // 2. Migrate Master
        console.log('[RESET] Running Master Migrations...');
        await masterDb.migrate.latest({
            directory: path.join(__dirname, 'migrations/master'),
            tableName: config.development.migrations.tableName
        });
        console.log('[RESET] Master Migrations Done.');

        // 3. Seed Master
        console.log('[RESET] Seeding Master (Plans, Admin)...');
        await masterDb.seed.run({
            directory: path.join(__dirname, 'seeds/master')
        });
        console.log('[RESET] Master Seeds Done.');

        // 4. Setup Tenant (Data)
        // Ensure "Multirede" exists (seeded or manual insert if seed missed it)
        const tenant = await masterDb('tenants').where({ slug: 'multirede' }).first();
        if (!tenant) {
            console.error('[RESET] Error: Tenant "Multirede" not found after seed. Stopping.');
            process.exit(1);
        }

        // 5. Connect Tenant
        console.log(`[RESET] Connecting to Tenant: ${tenant.name}...`);
        const tenantDb = connectionManager.getTenantConnection(tenant);

        // 6. Drop Tenant Tables (CASCADE)
        console.log('[RESET] Dropping Tenant Tables (CASCADE)...');
        const tenantTables = ['stock_movements', 'comparison_jobs', 'products', 'users', 'knex_migrations_tenant', 'knex_migrations_tenant_lock'];
        for (const t of tenantTables) {
            await tenantDb.raw(`DROP TABLE IF EXISTS "${t}" CASCADE`);
        }

        // 7. Migrate Tenant
        console.log('[RESET] Running Tenant Migrations...');
        await tenantDb.migrate.latest({
            directory: path.join(__dirname, 'migrations/tenant'),
            tableName: config.tenant_template.migrations.tableName
        });
        console.log('[RESET] Tenant Migrations Done.');

        // 8. Seed Tenant (Optional - Initial User)
        // If seeds/tenant exists
        try {
            console.log('[RESET] Seeding Tenant...');
            await tenantDb.seed.run({
                directory: config.tenant_template.seeds.directory
            });
            console.log('[RESET] Tenant Seeds Done.');
        } catch (e) {
            console.warn('[RESET] Tenant Seeding skipped or failed (might be empty):', e.message);
        }

        console.log('[RESET] ✅ COMPLETE CLEAN START.');
        process.exit(0);

    } catch (e) {
        console.error('[RESET] FATAL:', e);
        process.exit(1);
    }
}

resetProductionDb();
