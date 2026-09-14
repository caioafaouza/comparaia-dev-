
const axios = require('axios');
const connectionManager = require('../db/connectionManager');
require('dotenv').config();

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

async function run() {
    console.log('=== STEP 2: MULTI-TENANCY ISOLATION ===');
    let failures = 0;

    try {
        // 2.1 Login Master (PLATFORM_ADMIN) -> Should fail or return Master Context?
        // Wait, current Auth Logic: if no X-Tenant-Id, what happens?
        // Let's assume we log in as Super Admin.
        // We need an endpoint to verify "who am I" context.
        // Or we use the /api/admin/tenants endpoint which requires Master Role.

        console.log('[TEST] 2.1 Login Master...');
        const masterLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: process.env.MASTER_ADMIN_EMAIL || 'admin@platform.com',
            password: process.env.MASTER_ADMIN_PASSWORD || 'master123'
        }, { validateStatus: false });

        if (masterLogin.status === 200) {
            console.log('[PASS] Master Login OK');
            const token = masterLogin.data.token;

            // 2.2 List Tenants
            console.log('[TEST] 2.2 List Tenants (Master Context)...');
            const tenantsRes = await axios.get(`${BASE_URL}/api/admin/tenants`, {
                headers: { Authorization: `Bearer ${token}` },
                validateStatus: false
            });

            if (tenantsRes.status === 200) {
                const multirede = tenantsRes.data.find(t => t.slug === 'multirede');
                if (multirede && (multirede.db_name === 'tenant_multirede')) {
                    console.log('[PASS] "Multirede" found with correct db_name (schema).');
                } else {
                    console.error('[FAIL] "Multirede" not found or db_name incorrect.');
                    failures++;
                }
            } else {
                console.error(`[FAIL] List Tenants: ${tenantsRes.status}`);
                failures++;
            }
        } else {
            // If master login fails (maybe checking seeded creds?)
            console.error(`[FAIL] Master Login failed: ${masterLogin.status}`);
            failures++;
        }

        // 2.3 Login Tenant
        console.log('[TEST] 2.3 Login Tenant "Multirede"...');
        const tenantLogin = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'admin@multirede.com.br',
            password: '123456' // Seeded password
        }, {
            headers: { 'X-Tenant-ID': 'multirede' },
            validateStatus: false
        });

        let tenantToken = null;
        if (tenantLogin.status === 200) {
            console.log('[PASS] Tenant Login OK');
            tenantToken = tenantLogin.data.token;
        } else {
            console.error(`[FAIL] Tenant Login failed: ${tenantLogin.status} (Body: ${JSON.stringify(tenantLogin.data)})`);
            failures++;
        }

        // 2.4 Data Isolation
        if (tenantToken) {
            console.log('[TEST] 2.4 Verify Isolation...');

            // Query Users in Tenant Context
            const db = connectionManager.getMaster();

            // Check Public Users (Should be Master Admin only or empty of Tenant Users)
            const publicUsers = await db('users').withSchema('public').where({ email: 'admin@multirede.com.br' });
            if (publicUsers.length === 0) {
                console.log('[PASS] Tenant User NOT found in public schema.');
            } else {
                console.error('[FAIL] Tenant User LEAKED into public schema!');
                failures++;
            }

            // Check Tenant Users
            const tenantUsers = await db('users').withSchema('tenant_multirede').where({ email: 'admin@multirede.com.br' });
            if (tenantUsers.length === 1) {
                console.log('[PASS] Tenant User FOUND in tenant_multirede schema.');
            } else {
                console.error('[FAIL] Tenant User NOT found in tenant_multirede schema.');
                failures++;
            }
        }

    } catch (e) {
        console.error('[FATAL] Step 2 Error:', e);
        failures++;
    }

    if (failures > 0) process.exit(1);
    process.exit(0);
}

run();
