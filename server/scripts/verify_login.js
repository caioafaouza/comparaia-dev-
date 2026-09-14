async function verifyLogin() {
    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-ID': 'multirede'
            },
            body: JSON.stringify({
                email: 'caio.souza@multiredebh.com',
                password: 'Caio1991*'
            })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        if (response.ok) {
            console.log('Login Successful!');
            console.log('Token:', data.token ? 'PRESENT' : 'MISSING');
            console.log('User Role:', data.user.role);
            console.log('Tenant:', data.tenant.name);
        } else {
            console.log('Login Failed:', data);
        }
    } catch (err) {
        console.error('Request Error:', err);
    }
}

verifyLogin();
