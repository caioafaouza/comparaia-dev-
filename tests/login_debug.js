
const axios = require('axios');

const BASIC_URL = 'http://localhost:3000/api/auth/login';

async function testLogin(email, password) {
    console.log(`Testing login for ${email}...`);
    try {
        const response = await axios.post(BASIC_URL, {
            email,
            password
        }, {
            validateStatus: () => true // Resolve promise for all status codes
        });

        console.log(`Status: ${response.status}`);
        console.log('Response:', response.data);

        if (response.status === 200) {
            console.log('LOGIN SUCCESS!');
            if (response.data.token) console.log('Token Received');
        } else {
            console.log('LOGIN FAILED');
        }
    } catch (error) {
        console.error('Network Error:', error.message);
    }
    console.log('-----------------------------------');
}

async function run() {
    // 1. Test Master Admin (Seed)
    await testLogin('contato@inctec.com.br', 'Caio1991*');

    // 2. Test User reported in screenshot (Assuming we don't know password, checking if user exists logic trigger)
    // Actually, if we send wrong password, we should get 401. 
    // If user doesn't exist, we get 404.
    // This helps distinguish "User Not Found" vs "Wrong Password".
    await testLogin('12234@1234.com.br', 'WrongPass123');
}

run();
