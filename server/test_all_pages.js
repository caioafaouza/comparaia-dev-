
const http = require('http');

const ROUTES = [
    '/api/admin/config',
    '/api/admin/overview',
    '/api/admin/tenants',
    '/api/admin/users',
    '/api/admin/config/db',
    // '/api/admin/config/redis', // POST only in index.js? Checking controller...
    // '/api/admin/config/storage' // POST only?
];

function request(path) {
    return new Promise((resolve) => {
        const req = http.get({
            hostname: 'localhost',
            port: 3000,
            path,
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ path, status: res.statusCode, body: data.substring(0, 100) }));
        });
        req.on('error', (e) => resolve({ path, status: 'ERROR', body: e.message }));
    });
}

(async () => {
    console.log('--- SYSTEM HEALTH CHECK ---');
    for (const route of ROUTES) {
        const res = await request(route);
        console.log(`[${res.status}] ${res.path} \t ${res.status === 200 ? '✅' : '❌'} - ${res.body.replace(/\n/g, '')}...`);
    }
})();
