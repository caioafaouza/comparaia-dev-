
const axios = require('axios');
const connectionManager = require('../db/connectionManager');
require('dotenv').config();

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
    console.log('=== STEP 4: PROCESSOR & AI TRAFFIC ===');
    let failures = 0;

    // 1. Auth
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'admin@multirede.com.br',
        password: '123456'
    }, { headers: { 'X-Tenant-ID': 'multirede' }, validateStatus: false });

    if (loginRes.status !== 200) {
        console.error('FATAL: Login failed');
        process.exit(1);
    }
    const token = loginRes.data.token;
    const parts = token.split('.');
    let payload = {};
    if (parts.length === 3) {
        payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    }
    const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-ID': 'multirede' };

    // 2. Create Job
    console.log('[TEST] 4.1 Create Valid Job...');
    const createRes = await axios.post(`${BASE_URL}/api/jobs`, {
        referenceName: 'Processor Validation',
        candidateCount: 1,
        userId: payload.userId,
        // Mock files? Controller accepts empty files if allowed?
        // Logic: uploadFilesToStorage -> if empty returns [].
        // prompt uses aiParams.files.length.
        // It should work without files.
    }, { headers, validateStatus: false });

    if (createRes.status !== 200 && createRes.status !== 201) {
        console.error(`[FAIL] Job Create Failed: ${createRes.status}`, createRes.data);
        process.exit(1);
    }
    const jobId = createRes.data.id;
    console.log(`[PASS] Job Created: ${jobId}`);

    // 3. Poll for Completion (Max 30s)
    console.log('[TEST] 4.2 Polling for Completion...');
    let status = 'QUEUED';
    let attempts = 0;
    const maxAttempts = 15; // 30s

    while (status !== 'COMPLETED' && status !== 'FAILED' && attempts < maxAttempts) {
        await sleep(2000);
        const pollRes = await axios.get(`${BASE_URL}/api/jobs/${jobId}`, { headers });
        status = pollRes.data.status;
        console.log(`... Status: ${status}`);
        if (status === 'COMPLETED') {
            console.log('[PASS] Job Completed.');
            console.log('Result:', JSON.stringify(pollRes.data.result).substring(0, 100) + '...');
            if (pollRes.data.result && pollRes.data.result.score) {
                console.log('[PASS] AI Result contains Score.');
            } else {
                console.warn('[WARN] AI Result missing expected fields.');
            }
            break;
        }
        if (status === 'FAILED') {
            console.error('[FAIL] Job Failed:', pollRes.data.error);
            failures++;
            break;
        }
        attempts++;
    }

    if (status !== 'COMPLETED' && status !== 'FAILED') {
        console.error('[FAIL] Timeout waiting for completion.');
        failures++;
    }

    // 4. Verify Ledger Transaction Status
    console.log('[TEST] 4.3 Verifying Ledger Transaction...');
    const db = connectionManager.getMaster();
    const trx = await db('token_transactions').where({ reference_id: jobId }).first();

    if (trx) {
        console.log(`[PASS] Transaction Found. Status: ${trx.status}, Type: ${trx.type}`);
        if (trx.status === 'CONFIRMED' && trx.type === 'TOKEN_USAGE') {
            console.log('[PASS] Ledger Updated Correctly.');
        } else {
            console.error(`[FAIL] Status Mismatch. Expected CONFIRMED, got ${trx.status}`);
            failures++;
        }
    } else {
        console.error('[FAIL] No Transaction found for Job ID.');
        failures++;
    }

    if (failures > 0) process.exit(1);
    process.exit(0);
}

run();
