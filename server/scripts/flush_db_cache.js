
const axios = require('axios');
const connectionManager = require('../db/connectionManager');
require('dotenv').config();

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

async function run() {
    console.log('=== FLUSH DB CACHE ===');
    try {
        // 1. Login Master
        console.log('Logging in as Platform Admin...');
        const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'admin@platform.com',
            password: 'master123'
        }, { validateStatus: false });

        if (loginRes.status !== 200) {
            console.error('Master Login Failed:', loginRes.status, loginRes.data);
            process.exit(1);
        }

        const token = loginRes.data.token;
        console.log('Got Token.');

        // 2. Trigger Config Update (Flush)
        console.log('Triggering DB Config Update (Flush)...');
        // Sending empty body might work if controller handles it (using current values)
        // Controller: host || current.host
        const updateRes = await axios.post(`${BASE_URL}/api/admin/config/db`, {}, {
            headers: { Authorization: `Bearer ${token}` },
            validateStatus: false
        });

        if (updateRes.status === 200) {
            console.log('[SUCCESS] DB Cache Flushed via API.');
            console.log(updateRes.data);
        } else {
            console.error('[FAIL] DB Cache Flush Failed:', updateRes.status, updateRes.data);
            process.exit(1);
        }

    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}
run();
