
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
    console.log('--- TEST ADMIN ROUTES ---');
    try {
        console.log('Fetching Users...');
        const resUsers = await request('/api/admin/users');
        console.log(`GET /api/admin/users: ${resUsers.status}`);
        console.log('Body:', resUsers.body.substring(0, 200) + '...');

        console.log('Fetching Tenants...');
        const resTenants = await request('/api/admin/tenants');
        console.log(`GET /api/admin/tenants: ${resTenants.status}`);
        console.log('Body:', resTenants.body.substring(0, 200) + '...');

    } catch (e) {
        console.error('Error:', e);
    }
})();
