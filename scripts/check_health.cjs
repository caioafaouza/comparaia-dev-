
const fetch = require('node-fetch'); // Ensure node-fetch is available (was used in check_mp_search)
// or use dynamic import if needed, assuming node 18+ has global fetch?
// I'll use simple http to be safe.
const http = require('http');

function check(path) {
    return new Promise((resolve) => {
        http.get(`http://localhost:3000${path}`, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                console.log(`${path}: ${res.statusCode}`); // JSON.parse(data) if needed
                resolve();
            });
        }).on('error', (e) => {
            console.log(`${path}: ERROR ${e.message}`);
            resolve();
        });
    });
}

async function run() {
    console.log('--- Health Check (Port 3000) ---');
    await check('/api/billing/wallet'); // Check Auth/Billing presence? (expect 401 or 200)
    await check('/'); // Frontend or API root?
    // User asked for /api/health
    await check('/api/health');
}

run();
