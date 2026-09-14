
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
    console.log('--- TEST CONFIG ENDPOINT ---');
    try {
        console.log('Fetching Global Config...');
        const res = await request('/api/admin/config');
        console.log(`GET /api/admin/config: ${res.status}`);
        console.log('Body:', res.body);
    } catch (e) {
        console.error('Error:', e);
    }
})();
