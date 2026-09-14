// Ledger Concurrency Test - Race Condition Validation
// Tests atomic behavior of balance check + reserve under parallel load
// Run: node server/tests/ledger.concurrency.test.js

const assert = require('assert');
const crypto = require('crypto');

// Test Configuration
const API_BASE = 'http://localhost:3000';
const TENANT_SLUG = 'qa-concurrency-test';
const USER_EMAIL = `qa-concurrency-${Date.now()}@test.local`;
const USER_PASSWORD = 'Test@123456';

// Test Scenario
const INITIAL_BALANCE = 20;
const JOB_COST = 10;
const PARALLEL_REQUESTS = 3;
const EXPECTED_SUCCESS = 2;
const EXPECTED_FAIL_402 = 1;

let authToken = null;
let tenantId = null;
let userId = null;

// Helpers
const http = async (method, path, body = null, headers = {}) => {
    const url = `${API_BASE}${path}`;
    const opts = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    };

    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const text = await res.text();
    let data = null;

    try {
        data = text ? JSON.parse(text) : null;
    } catch (e) {
        data = { _raw: text };
    }

    return { status: res.status, data };
};

const dbQuery = async (sql) => {
    // Direct DB query helper (assumes pg client or can use API endpoint)
    const connectionManager = require('../db/connectionManager');
    const db = connectionManager.getMaster();
    return await db.raw(sql);
};

// Test Steps
async function setup() {
    console.log('\n=== SETUP ===\n');

    // 1. Create QA tenant if not exists
    console.log('[1/5] Creating QA tenant...');
    const tenantRes = await http('POST', '/api/tenants', {
        slug: TENANT_SLUG,
        name: 'QA Concurrency Test Tenant',
        adminName: 'QA Admin',
        adminEmail: USER_EMAIL,
        adminPassword: USER_PASSWORD
    });

    if (tenantRes.status === 201 || tenantRes.status === 200) {
        tenantId = tenantRes.data.tenant?.id || tenantRes.data.id;
        console.log(`✅ Tenant created/exists: ${tenantId}`);
    } else if (tenantRes.status === 409) {
        console.log('⚠️  Tenant already exists, fetching...');
        // Login to get tenantId
        const loginRes = await http('POST', '/api/auth/login', {
            tenantSlug: TENANT_SLUG,
            email: USER_EMAIL,
            password: USER_PASSWORD
        });

        if (loginRes.status === 200) {
            authToken = loginRes.data.token;
            tenantId = loginRes.data.user.tenantId;
            userId = loginRes.data.user.id;
            console.log(`✅ Logged in existing tenant: ${tenantId}`);
        } else {
            throw new Error(`Failed to login: ${loginRes.status} ${JSON.stringify(loginRes.data)}`);
        }
    } else {
        throw new Error(`Failed to create tenant: ${tenantRes.status} ${JSON.stringify(tenantRes.data)}`);
    }

    // 2. Login if not already
    if (!authToken) {
        console.log('[2/5] Logging in...');
        const loginRes = await http('POST', '/api/auth/login', {
            tenantSlug: TENANT_SLUG,
            email: USER_EMAIL,
            password: USER_PASSWORD
        });

        if (loginRes.status !== 200) {
            throw new Error(`Login failed: ${loginRes.status}`);
        }

        authToken = loginRes.data.token;
        userId = loginRes.data.user.id;
        console.log(`✅ Logged in: userId=${userId}`);
    }

    // 3. Reset wallet balance via direct DB
    console.log('[3/5] Resetting wallet balance...');
    const connectionManager = require('../db/connectionManager');
    const db = connectionManager.getMaster();

    // Ensure wallet exists
    const walletExists = await db('wallet').where({ tenant_id: tenantId }).first();

    if (!walletExists) {
        await db('wallet').insert({
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            balance: INITIAL_BALANCE,
            created_at: new Date()
        });
        console.log(`✅ Wallet created: balance=${INITIAL_BALANCE}`);
    } else {
        await db('wallet').where({ tenant_id: tenantId }).update({ balance: INITIAL_BALANCE });
        console.log(`✅ Wallet reset: balance=${INITIAL_BALANCE}`);
    }

    // 4. Clear old transactions
    console.log('[4/5] Clearing old transactions...');
    await db('token_transactions').where({ tenant_id: tenantId }).del();
    console.log('✅ Transactions cleared');

    // 5. Clear old jobs
    console.log('[5/5] Clearing old jobs...');
    const tenantDb = connectionManager.getOrCreate(TENANT_SLUG);
    await tenantDb('comparison_jobs').where({ user_id: userId }).del();
    console.log('✅ Jobs cleared');

    console.log('\n✅ Setup complete\n');
}

async function runConcurrencyTest() {
    console.log('=== CONCURRENCY TEST ===\n');
    console.log(`Scenario: ${PARALLEL_REQUESTS} parallel job requests`);
    console.log(`Initial balance: ${INITIAL_BALANCE}`);
    console.log(`Cost per job: ${JOB_COST}`);
    console.log(`Expected: ${EXPECTED_SUCCESS} × 201, ${EXPECTED_FAIL_402} × 402\n`);

    // Create 3 parallel job requests
    const jobPayload = {
        userId,
        referenceName: 'Concurrency Test Job',
        candidateCount: 1  // Should cost 10 (MIN_COST * 1)
    };

    const requests = Array.from({ length: PARALLEL_REQUESTS }, (_, i) =>
        http('POST', '/api/jobs', jobPayload, { Authorization: `Bearer ${authToken}` })
            .then(res => ({
                index: i,
                status: res.status,
                jobId: res.data?.id,
                error: res.data?.error
            }))
            .catch(err => ({
                index: i,
                status: 'ERROR',
                error: err.message
            }))
    );

    console.log('⏱️  Sending 3 parallel requests...\n');
    const start = Date.now();
    const results = await Promise.allSettled(requests);
    const elapsed = Date.now() - start;

    console.log(`✅ All requests completed in ${elapsed}ms\n`);

    // Analyze results
    const responses = results.map(r => r.value || r.reason);
    const statusCodes = responses.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {});

    console.log('--- Response Status Codes ---');
    Object.entries(statusCodes).forEach(([code, count]) => {
        console.log(`  ${code}: ${count}`);
    });

    console.log('\n--- Individual Responses ---');
    responses.forEach((r, i) => {
        const icon = r.status === 201 ? '✅' : r.status === 402 ? '⚠️' : '❌';
        console.log(`${icon} [${i}] Status ${r.status}: jobId=${r.jobId || 'none'}, error=${r.error || 'none'}`);
    });

    return { responses, statusCodes };
}

async function validateDatabase() {
    console.log('\n=== DATABASE VALIDATION ===\n');

    const connectionManager = require('../db/connectionManager');
    const db = connectionManager.getMaster();

    // 1. Check wallet balance
    console.log('[1/3] Checking wallet balance...');
    const wallet = await db('wallet').where({ tenant_id: tenantId }).first();
    console.log(`  Current balance: ${wallet.balance}`);

    if (wallet.balance < 0) {
        console.error('❌ FAIL: Balance is NEGATIVE!');
    } else {
        console.log(`  ✅ Balance non-negative`);
    }

    // 2. Check transactions
    console.log('[2/3] Checking token transactions...');
    const transactions = await db('token_transactions')
        .where({ tenant_id: tenantId })
        .orderBy('created_at', 'desc');

    console.log(`  Total transactions: ${transactions.length}`);

    const reserved = transactions.filter(t => t.status === 'RESERVED');
    const referenceIds = new Set(reserved.map(t => t.reference_id));

    console.log(`  RESERVED count: ${reserved.length}`);
    console.log(`  Unique reference_ids: ${referenceIds.size}`);

    if (reserved.length !== referenceIds.size) {
        console.error(`❌ FAIL: Duplicate reference_id detected!`);
    } else {
        console.log(`  ✅ No duplicate reference_ids`);
    }

    console.log('\n  Last 10 transactions:');
    transactions.slice(0, 10).forEach((tx, i) => {
        console.log(`    [${i}] ${tx.type} | ${tx.status} | amount=${tx.amount} | jobId=${tx.reference_id?.substring(0, 8)}`);
    });

    // 3. Check jobs created
    console.log('\n[3/3] Checking jobs...');
    const tenantDb = connectionManager.getOrCreate(TENANT_SLUG);
    const jobs = await tenantDb('comparison_jobs')
        .where({ user_id: userId })
        .orderBy('created_at', 'desc')
        .limit(10);

    console.log(`  Jobs created: ${jobs.length}`);
    jobs.forEach((job, i) => {
        console.log(`    [${i}] ${job.id.substring(0, 8)} | ${job.status} | cost=${job.cost}`);
    });

    return { wallet, transactions, jobs };
}

async function assertions(results, dbState) {
    console.log('\n=== ASSERTIONS ===\n');

    let passed = 0;
    let failed = 0;

    const check = (condition, description) => {
        if (condition) {
            console.log(`✅ PASS: ${description}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${description}`);
            failed++;
        }
    };

    // Test assertions
    check(
        results.statusCodes[201] === EXPECTED_SUCCESS,
        `Exactly ${EXPECTED_SUCCESS} requests returned 201 (got ${results.statusCodes[201] || 0})`
    );

    check(
        results.statusCodes[402] === EXPECTED_FAIL_402,
        `Exactly ${EXPECTED_FAIL_402} request returned 402 (got ${results.statusCodes[402] || 0})`
    );

    check(
        !results.statusCodes[500],
        `No 500 errors (got ${results.statusCodes[500] || 0})`
    );

    check(
        dbState.wallet.balance >= 0,
        `Wallet balance non-negative (balance=${dbState.wallet.balance})`
    );

    const reserved = dbState.transactions.filter(t => t.status === 'RESERVED');
    const referenceIds = new Set(reserved.map(t => t.reference_id));

    check(
        reserved.length === EXPECTED_SUCCESS,
        `Exactly ${EXPECTED_SUCCESS} RESERVED transactions (got ${reserved.length})`
    );

    check(
        reserved.length === referenceIds.size,
        `No duplicate reference_ids (reserved=${reserved.length}, unique=${referenceIds.size})`
    );

    console.log(`\n--- Final Result: ${passed} PASS, ${failed} FAIL ---\n`);

    if (failed > 0) {
        console.error('❌ TEST FAILED - Race condition detected!\n');
        process.exit(1);
    } else {
        console.log('✅ TEST PASSED - Ledger is atomic!\n');
        process.exit(0);
    }
}

// Main
(async () => {
    try {
        await setup();
        const results = await runConcurrencyTest();
        const dbState = await validateDatabase();
        await assertions(results, dbState);
    } catch (error) {
        console.error('\n❌ TEST ERROR:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
})();
