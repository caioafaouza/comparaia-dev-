
const axios = require('axios');

// Default provided by user (suspected Live Key)
const MP_ACCESS_TOKEN = 'APP_USR-1870049184506514-111012-f3322251b852d8c19043d12bcbc6c532-2561295350';

async function createTestUser() {
    console.log('Attempting to create Test User...');
    try {
        const response = await axios.post('https://api.mercadopago.com/users/test', {
            site_id: 'MLB',
            description: 'QA Automation User'
        }, {
            headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Test User Created Successfully!');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Failed to create Test User:', error.response ? error.response.data : error.message);
    }
}

createTestUser();
