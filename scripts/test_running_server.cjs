
const axios = require('axios');

async function test() {
    console.log('Testing http://localhost:3000/api/billing/purchase-package ...');

    // We need a valid token.
    // I will generate one using the same secret.
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({
        id: 'qa-user',
        email: 'qa@test.com',
        tenantId: '11111111-1111-1111-1111-111111111111', // qa-mp-a
        role: 'ADMIN'
    }, 'replace-me-with-strong-secret', { expiresIn: '1h' });

    try {
        const res = await axios.post('http://localhost:3000/api/billing/purchase-package', {
            packageId: 'pkg_pro'
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-ID': 'qa-mp-a'
            }
        });
        console.log('Status:', res.status);
        console.log('Data:', res.data);
    } catch (e) {
        console.log('Error:', e.message);
        if (e.response) {
            console.log('Response:', e.response.status, e.response.data);
        }
    }
}

test();
