
const http = require('http');

function request(path) {
    return new Promise((resolve, reject) => {
        const req = http.get({
            hostname: 'localhost',
            port: 3000,
            path,
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', reject);
    });
}

(async () => {
    console.log('--- TEST OVERVIEW ---');
    try {
        const res = await request('/api/admin/overview');
        console.log(`GET /api/admin/overview: ${res.status}`);
        const body = JSON.parse(res.body);
        console.log('Metrics:', JSON.stringify(body, null, 2));

        if (Number.isNaN(body.avgLatencyMs)) console.error('❌ avgLatencyMs is NaN!');
        else console.log('✅ avgLatencyMs is valid');

    } catch (e) {
        console.error('Error:', e);
    }
})();
