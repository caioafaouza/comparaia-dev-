
const api = 'http://localhost:3000/api';

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
        console.log('Login Success. Token acquired.');

        console.log('2. Fetching Overview Data...');
        const overviewRes = await fetch(`${api}/admin/overview`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!overviewRes.ok) {
            console.error('Overview Fetch Failed:', overviewRes.status, await overviewRes.text());
            process.exit(1);
        }

        const data = await overviewRes.json();
        console.log('Overview Data Received:', JSON.stringify(data, null, 2));

    } catch (e) {
        console.error('Script Error:', e);
    }
})();
