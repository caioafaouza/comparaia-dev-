
async function checkAdmin() {
    try {
        const body = {
            email: 'contato@inctec.com.br',
            password: 'Caio*1991'
        };
        console.log('Testing login for:', body.email, body.password);

        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}
checkAdmin();
