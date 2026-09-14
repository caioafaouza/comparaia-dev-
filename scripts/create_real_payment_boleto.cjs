
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const ACCESS_TOKEN = 'APP_USR-1870049184506514-111012-f3322251b852d8c19043d12bcbc6c532-2561295350';

async function createBoletoPayment() {
    console.log('--- CREATING BOLETO PAYMENT (SANDBOX) ---');
    try {
        const paymentRes = await axios.post('https://api.mercadopago.com/v1/payments', {
            transaction_amount: 100,
            description: 'QA Boleto Payment',
            payment_method_id: 'bolbradesco',
            payer: {
                email: 'test_user_generic@test.com',
                first_name: 'Test',
                last_name: 'User',
                identification: {
                    type: 'CPF',
                    number: '19119119100'
                }
            },
            external_reference: 'QA_BOLETO_' + Date.now()
        }, {
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'X-Idempotency-Key': uuidv4()
            }
        });

        console.log('Boleto Created!');
        const paymentId = paymentRes.data.id;
        console.log('ID:', paymentId);
        console.log('Status:', paymentRes.data.status);

        // Attempt to Approve
        console.log('Attempting to APPROVE payment...');
        const updateRes = await axios.put(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            status: 'approved'
        }, {
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
        });

        console.log('Update Result:', updateRes.data.status);
        console.log('SUCCESS! Real Payment ID:', paymentId);

    } catch (e) {
        console.error('Error:', e.response ? e.response.data : e.message);
    }
}

createBoletoPayment();
