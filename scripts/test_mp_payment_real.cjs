
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const PUBLIC_KEY = 'APP_USR-652a912a-cd70-4df9-a347-7d6bac67233d';
const ACCESS_TOKEN = 'APP_USR-1870049184506514-111012-f3322251b852d8c19043d12bcbc6c532-2561295350';

async function testPayment() {
    console.log('--- TEST PAYMENT WITH FRESH CARD TOKEN ---');

    try {
        // 1. Generate Card Token
        console.log('Generating Card Token...');
        const cardRes = await axios.post(`https://api.mercadopago.com/v1/card_tokens?public_key=${PUBLIC_KEY}`, {
            card_number: "4060000000000002", // Test Master Card
            security_code: "123",
            expiration_month: 11,
            expiration_year: 2029,
            cardholder: {
                name: "Test User",
                identification: {
                    number: "19119119100",
                    type: "CPF"
                }
            }
        });

        const cardToken = cardRes.data.id;
        console.log('Card Token Generated:', cardToken);

        // 2. Create Payment
        console.log('Creating Payment...');
        const paymentRes = await axios.post('https://api.mercadopago.com/v1/payments', {
            transaction_amount: 100,
            token: cardToken,
            description: 'QA Test Payment',
            installments: 1,
            payment_method_id: 'master',
            payer: {
                email: 'test_user_generic@test.com'
            },
            external_reference: 'QA_TEST_REF_' + Date.now()
        }, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'X-Idempotency-Key': uuidv4()
            }
        });

        console.log('Payment Created Successfully!');
        console.log('ID:', paymentRes.data.id);
        console.log('Status:', paymentRes.data.status);
    } catch (e) {
        console.error('Error:', e.response ? e.response.data : e.message);
    }
}

testPayment();
