
const config = require('../config/env');
const { createApp } = require('../app'); // We might not need this if we hit the URL directly, but good for reference
// Or better, just hitting the running server URL
const BASE_URL = 'http://localhost:3000/api'; // Assuming default port
const CONCURRENCY = 20; // Simultaneous users
const ITERATIONS = 5;   // Actions per user

// Test Data
const USERS = [
    { email: 'contato@inctec.com.br', password: 'Caio1991*' },
    // Add more if you want to test multiple accounts
];

const TARGET_USER = USERS[0];

async function loginUser(email, password) {
    try {
        const start = performance.now();
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const end = performance.now();

        if (!response.ok) throw new Error(`Login failed: ${response.status}`);

        const data = await response.json();
        return {
            token: data.token,
            time: end - start,
            user: data.user
        };
    } catch (err) {
        return { error: err.message };
    }
}

async function getDashboard(token, tenantId) {
    const start = performance.now();
    const response = await fetch(`${BASE_URL}/dashboard/metrics`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId
        },
    });
    const end = performance.now();
    return { status: response.status, time: end - start };
}

async function getJobs(token, tenantId) {
    const start = performance.now();
    const response = await fetch(`${BASE_URL}/jobs`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': tenantId
        },
    });
    const end = performance.now();
    return { status: response.status, time: end - start };
}

async function runVirtualUser(id) {
    console.log(`[User ${id}] Starting...`);
    const loginRes = await loginUser(TARGET_USER.email, TARGET_USER.password);

    if (loginRes.error) {
        console.error(`[User ${id}] Login Failed: ${loginRes.error}`);
        return { error: true, stage: 'login' };
    }

    const token = loginRes.token;
    const tenantId = loginRes.user.tenant_id || 'impar'; // Fallback or logic to get tenant

    console.log(`[User ${id}] Logged in (${Math.round(loginRes.time)}ms). Tenant: ${tenantId}`);

    let stats = {
        dashboard: [],
        jobs: []
    };

    for (let i = 0; i < ITERATIONS; i++) {
        // 1. Dashboard
        const dash = await getDashboard(token, tenantId);
        stats.dashboard.push(dash.time);

        // 2. Jobs list
        const jobs = await getJobs(token, tenantId);
        stats.jobs.push(jobs.time);

        // Small random sleep
        await new Promise(r => setTimeout(r, Math.random() * 500));
    }

    return { id, stats };
}

async function runStressTest() {
    console.log(`Starting stress test: ${CONCURRENCY} users, ${ITERATIONS} iterations each.`);
    console.log(`Target: ${BASE_URL}\n`);

    const promises = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        promises.push(runVirtualUser(i));
    }

    const results = await Promise.all(promises);

    // Aggregation
    let totalDash = 0, countDash = 0;
    let totalJobs = 0, countJobs = 0;
    let errors = 0;

    results.forEach(r => {
        if (r.error) {
            errors++;
            return;
        }
        r.stats.dashboard.forEach(t => { totalDash += t; countDash++; });
        r.stats.jobs.forEach(t => { totalJobs += t; countJobs++; });
    });

    console.log('\n--- Results ---');
    console.log(`Total Errors: ${errors}`);
    console.log(`Avg Dashboard Latency: ${countDash ? (totalDash / countDash).toFixed(2) : 0}ms`);
    console.log(`Avg Jobs List Latency: ${countJobs ? (totalJobs / countJobs).toFixed(2) : 0}ms`);
}

runStressTest();
