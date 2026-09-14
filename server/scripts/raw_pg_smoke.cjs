// Raw PG Driver Smoke Test - Bypass Knex
// Tests basic connectivity and INSERT into token_plans
// Run: node server/scripts/raw_pg_smoke.cjs

const path = require('path');
const { Client } = require('pg');
require('dotenv').config({
    path: process.env.DOTENV_PATH
        ? path.resolve(process.env.DOTENV_PATH)
        : path.resolve(__dirname, '..', '.env')
});

async function main() {
    console.log('\n=== RAW PG DRIVER SMOKE TEST ===\n');

    const config = {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
        statement_timeout: 15000,
    };

    console.log('Connecting...');
    const client = new Client(config);

    try {
        await client.connect();
        console.log('✅ Connected via tcp/ip');

        // 1. SELECT 1
        console.log('[1/4] SELECT 1...');
        try {
            const res1 = await client.query('SELECT 1 as ping');
            console.log(`  ✅ OK (ping=${res1.rows[0].ping})`);
        } catch (e) {
            console.log(`  ❌ FAIL SELECT 1: ${e.message}`);
        }

        // 1.5 Create/Insert diagnostic_events (Control)
        console.log('[1.5/4] INSERT diagnostic_events...');
        try {
            await client.query('CREATE TABLE IF NOT EXISTS diagnostic_events (id serial primary key, event_type text)');
            const resDiag = await client.query("INSERT INTO diagnostic_events (event_type) VALUES ('raw_test') RETURNING id");
            console.log(`  ✅ OK (id=${resDiag.rows[0].id})`);
        } catch (e) {
            console.log(`  ❌ FAIL diagnostic_events: ${e.message}`);
        }

        // 2. INSERT token_plans
        console.log('[2/4] INSERT token_plans...');
        const slug = `raw_${Date.now()}`;

        // Use parameterized query
        const query = `
            INSERT INTO token_plans (id, slug, name, token_limit, price, features, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING id
        `;

        // Use crypto for uuid
        const crypto = require('crypto');
        const values = [
            crypto.randomUUID(),
            slug,
            'Raw PG Test',
            100,
            0,
            JSON.stringify({ raw: true })
        ];

        try {
            const res2 = await client.query(query, values);
            console.log(`  ✅ OK (id=${res2.rows[0].id})`);
        } catch (e) {
            console.log(`  ❌ FAIL token_plans: ${e.message}`);
            // console.log(e.stack);
        }

        // 2.5 INSERT users (Alternative real table)
        console.log('[2.5/4] INSERT users...');
        try {
            // Mock user
            await client.query(`
                INSERT INTO users (id, name, email, password, role, status, created_at, updated_at)
                VALUES ($1, 'Raw Test', 'raw@test.com', 'hash', 'ADMIN', 'ACTIVE', NOW(), NOW())
                ON CONFLICT (email) DO NOTHING
             `, [crypto.randomUUID()]);
            console.log(`  ✅ OK (users)`);
        } catch (e) {
            console.log(`  ❌ FAIL users: ${e.message}`);
        }

        console.log('\n=== RAW PG TEST COMPLETE ===');

    } catch (err) {
        console.error('\n❌ GLOBAL FAIL:', err.message);
        console.error(err.stack);
    } finally {
        await client.end();
    }
}

main();
