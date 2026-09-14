
const api = 'http://localhost:3000/api';

(async () => {
    try {
        console.log('Testing Login...');
        const res = await fetch(`${api}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'contato@inctec.com.br', password: 'Caio1991*' })
        });

        if (res.status !== 200) {
            console.error('Login Failed:', res.status, await res.text());
            process.exit(1);
        }

        const data = await res.json();
        console.log('Login Success!');
        console.log('Token:', !!data.token);
        console.log('Tenant:', data.tenant?.name);

        if (data.tenant?.slug !== 'MASTER') {
            console.warn('Warning: Not Master Context (Slug is ' + data.tenant?.slug + ')');
        } else {
            console.log('Context: MASTER (Correct)');
        }

    } catch (e) {
        console.error('Error:', e);
    }
})();
