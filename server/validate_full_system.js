
require('dotenv').config();
const http = require('http');
const connectionManager = require('./db/connectionManager');

const BASE_URL = 'http://localhost:3000';
const TENANT_SLUG = 'inctec-sistemas';

async function testEndpoint(method, path, body = null, headers = {}) {
    return new Promise((resolve) => {
        const req = http.request(BASE_URL + path, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-ID': TENANT_SLUG,
                ...headers
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data.substring(0, 200), fullBody: data }));
        });
        req.on('error', (e) => resolve({ status: 'ERR', body: e.message }));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

(async () => {
    console.log('🔍 INITIATING COMPREHENSIVE SYSTEM AUTHIT...');
    console.log('============================================');

    // 1. DATABASE CONNECTIVITY
    console.log('\n[1/4] DATABASE CHECK');
    try {
        const master = connectionManager.getMaster();
        await master.raw('SELECT 1');
        console.log('✅ Master DB Connection: OK');

        const tenant = await master('tenants').where({ slug: TENANT_SLUG }).first();
        if (tenant) {
            console.log(`✅ Tenant Resolved: ${tenant.name} (Schema: ${tenant.db_name})`);
            const tenantDb = connectionManager.getTenantConnection(tenant);

            // Check Critical Tables
            const tables = ['users', 'comparison_jobs', 'products'];
            for (const t of tables) {
                const exists = await tenantDb.schema.hasTable(t);
                console.log(`   - Table '${t}': ${exists ? '✅' : '❌ MISSING'}`);
            }
        } else {
            console.error('❌ Tenant Validation: FAILED (Tenant not found)');
        }
    } catch (e) {
        console.error('❌ Database Check Failed:', e.message);
    }

    // 2. INFRASTRUCTURE
    console.log('\n[2/4] INFRASTRUCTURE CHECK');
    try {
        // Mock Redis/Storage checks if not fully configured
        console.log('   - Redis: SKIPPED (Dev Mode in Memory)');
        console.log('   - Storage: SKIPPED (Dev Mode Local)');
    } catch (e) { }

    // 3. API ENDPOINTS (SMOKE TEST)
    console.log('\n[3/4] API ENDPOINT SMOKE TEST');
    const endpoints = [
        { verb: 'GET', url: '/api/admin/config', name: 'Global Config' },
        { verb: 'GET', url: '/api/admin/overview', name: 'Dashboard Overview' },
        { verb: 'GET', url: '/api/admin/tenants', name: 'Tenant List' },
        { verb: 'GET', url: '/api/jobs', name: 'List Jobs' },
        { verb: 'POST', url: '/api/ai/analyze-raw', body: { reference: { content: 'test' }, candidates: [] }, name: 'AI Analysis' }
    ];

    for (const ep of endpoints) {
        const res = await testEndpoint(ep.verb, ep.url, ep.body);
        const icon = res.status >= 200 && res.status < 400 ? '✅' : '❌';
        console.log(`${icon} [${res.status}] ${ep.name} (${ep.url})`);
        if (res.status >= 400) console.log(`    Error: ${res.body}`);
    }

    // 4. JOB CREATION SIMULATION
    console.log('\n[4/4] CRITICAL FLOW: JOB CREATION');
    const jobPayload = {
        userId: 'e165432a-0000-0000-0000-000000000000', // Unique ID to test provisioning
        referenceName: 'System Validation Job',
        candidateCount: 1,
        cost: 5.00
    };
    const jobRes = await testEndpoint('POST', '/api/jobs', jobPayload);
    console.log(`Job Creation: ${jobRes.status === 200 ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (jobRes.status !== 200) console.log(`Response: ${jobRes.fullBody}`);

    console.log('\n============================================');
    console.log('AUDIT COMPLETE.');
    process.exit(0);
})();
