
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

const migrations = require('./migrations/tenant/20231027_initial_schema.js');

async function repairTenants() {
    console.log('--- STARTING TENANT REPAIR ---');
    const db = knex(DB_CONFIG);

    try {
        const tenants = await db('tenants').select('*');

        for (const tenant of tenants) {
            console.log(`\nReparing Tenant: ${tenant.slug}...`);
            const schemaName = `tenant_${tenant.slug.replace(/-/g, '_')}`;

            // Create Schema if not exists
            await db.raw(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

            // We need a Knex instance bound to this schema for the 'up' function
            const tenantDb = knex({
                ...DB_CONFIG,
                searchPath: [schemaName] // Force search path
            });

            try {
                // Check if tables exist
                const exists = await tenantDb.schema.hasTable('comparison_jobs');
                if (!exists) {
                    console.log('   Running Migration UP...');
                    await migrations.up(tenantDb);
                    console.log('   ✅ Migration applied.');
                } else {
                    // Check 'products' separately as partial migration might have happened
                    const hasProducts = await tenantDb.schema.hasTable('products');
                    if (!hasProducts) {
                        console.log('   Running Partial Migration (Products only)...');
                        await tenantDb.schema.createTable('products', table => {
                            table.uuid('id').primary();
                            table.string('name').notNullable();
                            table.string('category');
                            table.decimal('initial_cost', 15, 2);
                            table.integer('stock_quantity').defaultTo(0);
                            table.integer('min_stock').defaultTo(5);
                            table.json('technical_specs');
                            table.timestamps(true, true);
                        });
                        console.log('   ✅ Products table created.');
                    }

                    const hasStock = await tenantDb.schema.hasTable('stock_movements');
                    if (!hasStock) {
                        console.log('   Running Partial Migration (Stock only)...');
                        await tenantDb.schema.createTable('stock_movements', table => {
                            table.increments('id').primary();
                            table.uuid('product_id').references('id').inTable('products');
                            table.string('type').notNullable();
                            table.integer('quantity').notNullable();
                            table.decimal('unit_cost', 15, 2);
                            table.timestamp('created_at').defaultTo(tenantDb.fn.now());
                        });
                        console.log('   ✅ Stock Movements table created.');
                    }

                    console.log('   ℹ️ Core tables valid.');
                }
            } catch (err) {
                console.error(`   ❌ Error migrating ${tenant.slug}:`, err.message);
            } finally {
                await tenantDb.destroy();
            }
        }
        console.log('\n--- REPAIR COMPLETE ---');
    } catch (e) {
        console.error('Fatal Error:', e);
    } finally {
        await db.destroy();
    }
}

repairTenants();
