
const http = require('http');

function request(method, path, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                // Master context for registration
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

(async () => {
    console.log('--- TEST PROVISIONING (SCHEMA MODE) ---');

    const payload = {
        name: 'Inctec Sistemas Test',
        email: 'test_admin@inctec.com.br',
        slug: 'inctectest', // Simple slug
        plan: 'STARTER',
        adminName: 'Caio Test',
        password: 'securePassword123'
    };

    console.log('Sending Payload:', payload);

    try {
        const res = await request('POST', '/api/register-tenant', payload);
        console.log(`Status: ${res.status}`);
        console.log('Body:', res.body);

        if (res.status === 201) {
            console.log('✅ Tenant Created Successfully!');
        } else {
            console.error('❌ Creation Failed');
        }

    } catch (e) {
        console.error('❌ Request Error:', e);
    }
})();
