
const axios = require('axios');
const connectionManager = require('../db/connectionManager');
require('dotenv').config();

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000'; // Using FRONTEND_URL as proxy or API_URL

async function run() {
    console.log('=== STEP 1: HEALTH & DB POINTER ===');
    let failures = 0;

    // 1.1 Validar Endpoints
    const endpoints = [
        '/api/health',
        '/api/health/db',
        '/api/health/redis',
        // '/api/health/storage' // Not common, usually implicitly checked or different route. 
        // User requested exactly these. I will try them.
    ];

    console.log(`[HTTP] Checking endpoints on ${BASE_URL}...`);
    for (const ep of endpoints) {
        try {
            const res = await axios.get(`${BASE_URL}${ep}`, { validateStatus: false });
            if (res.status === 200) {
                console.log(`[PASS] ${ep} => 200 OK`);
            } else {
                // If specific route doesn't exist, we might get 404. 
                // However, I should assume they are implemented if user requested verification.
                // If 404, I'll flag it.
                console.error(`[FAIL] ${ep} => ${res.status}`);
                failures++;
            }
        } catch (e) {
            console.error(`[FAIL] ${ep} => Connection Error: ${e.message}`);
            failures++;
        }
    }

    // 1.2 Validar DB Connection (Master/Public)
    console.log('[DB] Connecting to Master DB...');
    try {
        const db = connectionManager.getMaster();

        // Log connection info (Masked)
        const host = process.env.DB_HOST || 'unknown';
        const dbName = process.env.DB_DATABASE || 'unknown';
        console.log(`[DB] Host: ${host} | DB: ${dbName}`);

        // Confirm access to public.tenants
        const tenants = await db('tenants').withSchema('public').select('slug', 'db_name', 'status');
        console.log('[DB] Public Tenants Query Successful.');
        console.table(tenants);

        if (tenants.some(t => t.slug === 'multirede')) {
            console.log('[PASS] Tenant "Multirede" found in Master DB.');
        } else {
            console.error('[FAIL] Tenant "Multirede" NOT found in Master DB.');
            failures++;
        }

    } catch (e) {
        console.error('[DB] FATAL: Could not query Master DB.', e);
        failures++;
    }

    if (failures > 0) {
        console.log(`\n[RESULT] Step 1 FAILED with ${failures} errors.`);
        process.exit(1);
    } else {
        console.log('\n[RESULT] Step 1 PASSED.');
        process.exit(0);
    }
}

run();
