
const api = 'http://localhost:3000/api';

const routes = [
    { method: 'GET', path: '/admin/overview', name: 'Overview' },
    { method: 'GET', path: '/admin/plans', name: 'Plans' },
    { method: 'GET', path: '/admin/token-packages', name: 'Token Packages' },
    { method: 'GET', path: '/admin/api-gateway', name: 'API Gateway' },
    { method: 'GET', path: '/admin/system-keys', name: 'System Keys' },
    { method: 'GET', path: '/admin/config/smtp', name: 'SMTP Config' },
    { method: 'GET', path: '/admin/crm/leads', name: 'CRM Leads' },
    { method: 'GET', path: '/admin/webhooks', name: 'Webhooks' },
    { method: 'GET', path: '/admin/payment-gateways', name: 'Payment Gateways' }
];

(async () => {
    try {
        console.log('1. Login as Admin...');
        const loginRes = await fetch(`${api}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'contato@inctec.com.br', password: 'Caio1991*' })
        });

        if (!loginRes.ok) {
            console.error('Login Failed:', await loginRes.text());
            process.exit(1);
        }

        const session = await loginRes.json();
        const token = session.token;
        console.log('Login Success.');

        console.log('\n2. Validating Routes...');
        let failures = 0;

        for (const route of routes) {
            process.stdout.write(`Testing ${route.name} (${route.path})... `);
            try {
                const res = await fetch(`${api}${route.path}`, {
                    method: route.method,
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    const isArray = Array.isArray(data);
                    const count = isArray ? data.length : Object.keys(data).length;
                    console.log(`✅ OK (${isArray ? 'Array' : 'Object'}, ${count} items)`);
                } else {
                    console.log(`❌ FAILED (${res.status})`);
                    console.log(`   Error: ${await res.text()}`);
                    failures++;
                }
            } catch (e) {
                console.log(`❌ EXCEPTION: ${e.message}`);
                failures++;
            }
        }

        console.log(`\nValidation Complete. ${failures} failures found.`);
        if (failures > 0) process.exit(1);

    } catch (e) {
        console.error('Script Error:', e);
        process.exit(1);
    }
})();
