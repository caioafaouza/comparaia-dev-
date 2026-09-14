async function verifyLogin() {
    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Intentionally NOT sending X-Tenant-ID header to test body resolution
            },
            body: JSON.stringify({
                email: 'caio.souza@multiredebh.com.br',
                password: 'Caio1991*',
                tenantSlug: 'multirede'
            })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        if (response.ok) {
            console.log('Login Successful!');
            console.log('Token:', data.token ? 'PRESENT' : 'MISSING');
            console.log('User:', data.user.email);
            console.log('Tenant:', data.tenant.slug);
        } else {
            console.log('Login Failed:', data);
        }
    } catch (err) {
        console.error('Request Error:', err);
    }
}

verifyLogin();
