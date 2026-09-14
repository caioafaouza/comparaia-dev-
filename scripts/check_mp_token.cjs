
const axios = require('axios');

// Token to verify
const MP_ACCESS_TOKEN = 'APP_USR-1870049184506514-111012-f3322251b852d8c19043d12bcbc6c532-2561295350';

async function checkToken() {
    console.log('Checking Token Details...');
    try {
        const response = await axios.get('https://api.mercadopago.com/users/me', {
            headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
            }
        });

        const user = response.data;
        console.log('User ID:', user.id);
        console.log('Narrative:', user.nickname);
        console.log('Site ID:', user.site_id);
        console.log('Tags:', user.tags); // Check for 'test_user' tag
        console.log('Live Mode (sandbox_mode?):', user.test_user); // Some APIs might return this

    } catch (error) {
        console.error('Token Check Failed:', error.response ? error.response.data : error.message);
    }
}

checkToken();
