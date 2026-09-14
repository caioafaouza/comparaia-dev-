const http = require('http');

const endpoints = [
    '/api/health',
    '/api/health/db',
    '/api/health/redis',
    '/api/health/storage'
];

async function check(path) {
    return new Promise(resolve => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'GET'
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });
        req.on('error', e => resolve({ status: 500, error: e.message }));
        req.end();
    });
}

(async () => {
    console.log('--- SYSTEM HEALTH CHECK ---');
    for (const ep of endpoints) {
        const res = await check(ep);
        console.log(`${ep}: ${res.status} ${res.status === 200 ? 'OK' : 'FAIL'} ${(res.status !== 200) ? res.body : ''}`);
    }
})();
