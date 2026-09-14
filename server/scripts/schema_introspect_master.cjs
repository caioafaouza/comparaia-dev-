// Schema Introspection Master - Deterministic Discovery
// Queries actual schema columns and tables for seeds/migrations
// Run: node server/scripts/schema_introspect_master.cjs

const path = require('path');
const fs = require('fs');
require('dotenv').config({
    path: process.env.DOTENV_PATH
        ? path.resolve(process.env.DOTENV_PATH)
        : path.resolve(__dirname, '..', '.env')
});

const connectionManager = require('../db/connectionManager');

async function main() {
    console.log('\n=== MASTER SCHEMA INTROSPECTION ===\n');

    const masterDb = connectionManager.getMaster();
    const snapshot = {
        timestamp: new Date().toISOString(),
        tables: {},
        billing_tables: []
    };

    try {
        // 1. Introspect token_plans
        console.log('[1/3] Introspecting token_plans columns...\n');

        const tokenPlansColumns = await masterDb.raw(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema='public' AND table_name='token_plans'
            ORDER BY ordinal_position
        `);

        if (tokenPlansColumns.rows.length === 0) {
            console.error('❌ token_plans table not found!\n');
            snapshot.tables.token_plans = { error: 'table_not_found' };
        } else {
            console.log('token_plans columns:');
            tokenPlansColumns.rows.forEach(col => {
                console.log(`  - ${col.column_name} (${col.data_type}, nullable=${col.is_nullable}, default=${col.column_default || 'none'})`);
            });
            console.log('');
            snapshot.tables.token_plans = {
                columns: tokenPlansColumns.rows,
                has_is_default: tokenPlansColumns.rows.some(c => c.column_name === 'is_default')
            };
        }

        // 2. Introspect users (for admin seed)
        console.log('[2/3] Introspecting users columns...\n');

        const usersColumns = await masterDb.raw(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema='public' AND table_name='users'
            ORDER BY ordinal_position
        `);

        if (usersColumns.rows.length === 0) {
            console.error('❌ users table not found!\n');
            snapshot.tables.users = { error: 'table_not_found' };
        } else {
            console.log('users columns:');
            usersColumns.rows.forEach(col => {
                console.log(`  - ${col.column_name} (${col.data_type}, nullable=${col.is_nullable})`);
            });
            console.log('');
            snapshot.tables.users = {
                columns: usersColumns.rows
            };
        }

        // 3. Search for billing/wallet tables
        console.log('[3/3] Searching for billing-related tables...\n');

        const billingTables = await masterDb.raw(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema='public'
            AND table_name ~ '(wallet|token|credit|balance)'
            ORDER BY table_name
        `);

        console.log(`Found ${billingTables.rows.length} billing-related table(s):`);
        billingTables.rows.forEach(t => console.log(`  - ${t.table_name}`));
        console.log('');

        snapshot.billing_tables = billingTables.rows.map(r => r.table_name);
        snapshot.has_wallet = billingTables.rows.some(r => r.table_name === 'wallet');

        // Summary
        console.log('=== INTROSPECTION SUMMARY ===\n');
        console.log(`token_plans: ${snapshot.tables.token_plans?.error ? 'MISSING' : 'OK'}`);
        console.log(`  - has is_default column: ${snapshot.tables.token_plans?.has_is_default ? 'YES' : 'NO'}`);
        console.log(`users: ${snapshot.tables.users?.error ? 'MISSING' : 'OK'}`);
        console.log(`wallet table: ${snapshot.has_wallet ? 'EXISTS' : 'MISSING'}`);
        console.log(`billing tables: ${snapshot.billing_tables.join(', ')}\n`);

        // Write snapshot JSON
        const outputDir = path.resolve(__dirname, '..', 'test-results');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const snapshotPath = path.join(outputDir, 'master_schema_snapshot.json');
        fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

        console.log(`✅ Snapshot saved: ${snapshotPath}\n`);
        console.log('✅ INTROSPECTION_OK\n');

        await masterDb.destroy();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Introspection failed:', error.message);
        await masterDb.destroy();
        process.exit(1);
    }
}

main();
