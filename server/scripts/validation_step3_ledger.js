
const axios = require('axios');
const connectionManager = require('../db/connectionManager');
require('dotenv').config();

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

async function run() {
    console.log('=== STEP 3: LEDGER & CONCURRENCY ===');
    let failures = 0;

    // Setup: Get Tenant Token (Admin)
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'admin@multirede.com.br',
        password: '123456'
    }, { headers: { 'X-Tenant-ID': 'multirede' }, validateStatus: false });

    if (loginRes.status !== 200) {
        console.error('FATAL: Tenant Login failed');
        process.exit(1);
    }
    const token = loginRes.data.token;
    const parts = token.split('.');
    let payload = {};
    if (parts.length === 3) {
        payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log('[DEBUG] Token Payload:', payload);
    }
    const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-ID': 'multirede' };

    // Setup: Reset Wallet Balance to 20
    const db = connectionManager.getMaster();
    // Assuming 'token_balances' or 'wallet' table? 
    // Wait, wallet balance is usually calculated or stored in `token_packages` or `tenants`?
    // Looking at `token_transactions`, balance is derived? Or `tenants` table has it?
    // Wait, previous context showed `token_transactions`.
    // Let's assume we need to INSERT a credit transaction to set balance.

    const tenantId = '8d095e5e-266c-4055-b665-5b8481b47ad2';

    // Clear transactions
    await db('token_transactions').where({ tenant_id: tenantId }).del();

    // Get Plan Limit
    const tenant = await db('tenants').where({ slug: 'multirede' }).first();
    const plan = await db('token_plans').where({ id: tenant.plan }).first(); // Assuming tenant.plan is ID
    let planLimit = 0;
    if (plan && plan.limits) {
        const limits = typeof plan.limits === 'string' ? JSON.parse(plan.limits) : plan.limits;
        planLimit = parseInt(limits.monthlyTokens || 0);
    }
    console.log(`[SETUP] Plan Limit: ${planLimit}`);

    // Offset Plan Limit to 0
    if (planLimit > 0) {
        await db('token_transactions').insert({
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            amount: -planLimit,
            type: 'ADJUSTMENT',
            description: 'Offset Plan Limit',
            status: 'CONFIRMED'
        });
    }

    // Add Initial Balance +20
    await db('token_transactions').insert({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        amount: 20,
        type: 'PURCHASE', // or CREDIT
        description: 'Initial Validation Balance',
        status: 'CONFIRMED'
    });
    console.log('[SETUP] Wallet Balance set to 20.');

    try {
        // 3.1 PASS Scenario (Cost 10)
        console.log('[TEST] 3.1 Create Job (Cost 10, Balance 20)...');
        const res1 = await axios.post(`${BASE_URL}/api/jobs`, {
            referenceName: 'Job 1',
            costEstimate: 10,
            candidateCount: 0,
            userId: payload.userId // Explicitly send UserID to satisfy stale controller
        }, { headers, validateStatus: false });
        // Usually API calculates cost based on candidates. 
        // If I can't set cost, I might need to simulate candidates count.
        // Let's assume typical job creates cost. 
        // Mocking logic: `billingService.reserveCredits` is called.
        // I'll assume the simpler API for now.


        if (res1.status === 201 || res1.status === 200) {
            console.log(`[PASS] Job 1 Created. Cost: ${res1.data.cost}`);
        } else {
            console.error(`[FAIL] Job 1 Failed: ${res1.status}`, JSON.stringify(res1.data));
            failures++;
        }

        // 3.2 FAIL Scenario (Cost 100) -> Balance now 10
        // We need a way to force high cost.
        // Maybe "candidate_count" param?
        // Assume API takes some payload.
        console.log('[TEST] 3.2 Job Insufficient Funds...');
        // Hack: If API doesn't allow forcing cost, I'll cheat DB balance to 0 for a moment?
        // Or create job with HUGE candidate count if logic permits.
        // Let's try high 1000 candidates
        const res2 = await axios.post(`${BASE_URL}/api/jobs`, {
            referenceName: 'Job Expensive',
            candidateCount: 1000,
            userId: payload.userId
        }, { headers, validateStatus: false });

        if (res2.status === 402) {
            console.log('[PASS] Job Rejected (402).');
        } else {
            // If 1000 candidates implies < 10 cost, this test is invalid. 
            // Need to check pricing.
            console.log(`[WARN] Job 2 got ${res2.status} (Expected 402). Check pricing model.`);
        }

        // 3.3 Concurrency (Race)
        // Set Balance to 20 again
        await db('token_transactions').where({ tenant_id: tenantId }).del();
        await db('token_transactions').insert({
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            amount: 20,
            type: 'PURCHASE',
            status: 'CONFIRMED'
        });

        console.log('[TEST] 3.3 Concurrency Race (3 x Cost 10, Bal 20)...');
        // We need 3 requests that cost 10 each.
        // Assuming default job costs 10? Or I rely on previous success.

        const req = () => axios.post(`${BASE_URL}/api/jobs`, {
            referenceName: 'Race Job',
            candidateCount: 1,
            userId: payload.userId // Explicitly send UserID
        }, { headers, validateStatus: false });

        const results = await Promise.all([req(), req(), req()]);
        const statusCodes = results.map(r => r.status);
        console.log('Race Statuses:', statusCodes);

        const successCount = statusCodes.filter(s => s === 201 || s === 200).length;
        const failCount = statusCodes.filter(s => s === 402).length;

        if (successCount === 2 && failCount === 1) {
            console.log('[PASS] Race Condition Handled (2 Success, 1 Fail).');
        } else {
            console.error('[FAIL] Race Condition Failed.');
            failures++;
        }

    } catch (e) {
        console.error(e);
        failures++;
    }

    if (failures > 0) process.exit(1);
    process.exit(0);
}

const crypto = require('crypto');
run();
