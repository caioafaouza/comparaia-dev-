
const knex = require('../server/db/connectionManager').getMaster();
const uuid = require('uuid');

async function seed() {
    try {
        console.log('--- Initializing Production Seed ---');

        // 1. Ensure Tenant exists
        const tenantSlug = 'comparaia';
        const existing = await knex('tenants').where({ slug: tenantSlug }).first();

        if (existing) {
            console.log(`[OK] Tenant '${tenantSlug}' already exists.`);
        } else {
            console.log(`[NEW] Creating tenant '${tenantSlug}'...`);
            await knex('tenants').insert({
                id: uuid.v4(),
                name: 'Compara IA Master',
                slug: tenantSlug,
                status: 'ACTIVE',
                db_name: 'public', // Force 'public' schema for Master Tenant
                db_host: process.env.DB_HOST || '127.0.0.1', // Localhost for prod
                db_port: process.env.DB_PORT || 5432,
                db_user: process.env.DB_USER || 'comparaia',
                db_password: process.env.DB_PASSWORD || 'ddaCxxXzJr4iCBET',
                db_ssl: false,
                plan: 'ENTERPRISE',
                created_at: new Date(),
                updated_at: new Date()
            });
            console.log(`[OK] Tenant '${tenantSlug}' created.`);
        }

        console.log('--- Seed Complete ---');
        process.exit(0);
    } catch (error) {
        console.error('SEED ERROR:', error);
        process.exit(1);
    }
}

seed();
