
const mercadopago = require('mercadopago');
const db = require('../server/db/connectionManager'); // Just to shim if needed, or removing db dependency
// We just need Axios or SDK.
// User provided token in screenshots: APP_USR-187...

const ACCESS_TOKEN = 'APP_USR-1870049184506514-111012-f3322251b852d8c19043d12bcbc6c532-2561295350';

async function checkSearch() {
    const fetch = (await import('node-fetch')).default;

    console.log('Searching payments...');
    const url = `https://api.mercadopago.com/v1/payments/search?limit=5&access_token=${ACCESS_TOKEN}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (res.status === 200) {
            console.log('Search OK. Count:', data.paging ? data.paging.total : 'N/A');
            const p = data.results && data.results.length > 0 ? data.results[0] : null;
            if (p) {
                console.log('First result status:', p.status);
                console.log('PAYMENT_ID:', p.id);
            } else {
                console.log('No payments found.');
            }
        } else {
            console.log('Search Failed:', res.status, data);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkSearch();
