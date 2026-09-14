const axios = require('axios');
const assert = require('assert');

// Config
const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const EMAIL = 'contato@inctec.com.br';
const PASSWORD = 'Caio*1991'; // Hardcoded for smoke test in safe env, or use ENV

async function smokeTest() {
    console.log('🔥 Smoke Test Started');
    console.log(`   Target: ${API_URL}`);

    try {
        // 1. Health Check
        const health = await axios.get(`${API_URL}/health`);
        assert(health.status === 200, 'Health check failed');
        console.log('✅ Health Check OK');

        // 2. Login
        console.log('   Attempting Login...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });

        assert(loginRes.status === 200, 'Login failed');
        const token = loginRes.data.token;
        assert(token, 'No token returned');
        console.log('✅ Login OK');

        // 3. Check Tenant Details (Protected Route)
        console.log('   Fetching Tenant Details...');
        const meRes = await axios.get(`${API_URL}/tenant/details`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert(meRes.status === 200, 'Tenant Details failed');
        assert(meRes.data.slug === 'inctec', 'Wrong tenant');
        console.log('✅ Tenant Context OK');

        // 4. (Optional) Create Job or Check Dashboard
        // Just checking dashboard metrics is enough for "read" smoke test
        const metricsRes = await axios.get(`${API_URL}/dashboard/metrics`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert(metricsRes.status === 200, 'Dashboard failed');
        console.log('✅ Dashboard Metrics OK');

        console.log('🚀 SMOKE TEST PASSED');
        process.exit(0);

    } catch (error) {
        console.error('❌ Smoke Test FAILED');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data:`, error.response.data);
        } else {
            console.error(`   Error:`, error.message);
        }
        process.exit(1);
    }
}

smokeTest();
