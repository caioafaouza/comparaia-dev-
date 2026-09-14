// Minimal Master Seed - Insert Required Data Only
// Creates token_plan and system_config for provisioning
// Run: node server/scripts/seed_master_minimal.cjs

const path = require('path');
require('dotenv').config({
    path: process.env.DOTENV_PATH
        ? path.resolve(process.env.DOTENV_PATH)
        : path.resolve(__dirname, '..', '.env')
});

const crypto = require('crypto');
const connectionManager = require('../db/connectionManager');

async function main() {
    console.log('\n=== MINIMAL MASTER SEED ===\n');

    const masterDb = connectionManager.getMaster();

    try {
        // 1. Create default token plan
        console.log('[1/2] Creating default token plan...');

        const existing = await masterDb('token_plans').where({ slug: 'free' }).first();

        if (existing) {
            console.log(`  ⚠️  Token plan 'free' already exists\n`);
        } else {
            await masterDb('token_plans').insert({
                id: crypto.randomUUID(),
                slug: 'free',
                name: 'Free Plan',
                token_limit: 1000,
                price: 0,
                is_default: true,
                created_at: new Date(),
                updated_at: new Date()
            });
            console.log('  ✅ Created token plan: Free Plan (1000 tokens)\n');
        }

        // 2. Create minimal system_config
        console.log('[2/2] Creating minimal system config...');

        const configExists = await masterDb('system_config').where({ config_key: 'app_initialized' }).first();

        if (configExists) {
            console.log('  ⚠️  System config already exists\n');
        } else {
            await masterDb('system_config').insert({
                id: crypto.randomUUID(),
                config_key: 'app_initialized',
                config_value: JSON.stringify({ initialized: true, version: '1.0.0' }),
                created_at: new Date(),
                updated_at: new Date()
            });
            console.log('  ✅ Created system config: app_initialized\n');
        }

        console.log('=== SEED COMPLETE ===\n');
        console.log('✅ SEED_OK\n');

        await masterDb.destroy();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Seed failed:', error.message);
        await masterDb.destroy();
        process.exit(1);
    }
}

main();
