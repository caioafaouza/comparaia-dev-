
const connectionManager = require('../server/db/connectionManager');

async function check() {
    const db = connectionManager.getMaster();
    const headers = await db('payment_gateways').where({ provider: 'mercadopago' }).select('*');

    console.log('--- MP Config in DB ---');
    headers.forEach(h => {
        console.log(`ID: ${h.id}, Active: ${h.active}`);
        let creds;
        try {
            if (typeof h.credentials === 'string') creds = JSON.parse(h.credentials);
            else creds = h.credentials;

            console.log('Creds:', {
                ...creds,
                accessToken: creds.accessToken ? creds.accessToken.substring(0, 10) + '...' : 'MISSING',
                publicKey: creds.publicKey ? creds.publicKey.substring(0, 5) + '...' : 'MISSING'
            });
        } catch (e) {
            console.log('Creds parse error:', e.message);
        }
    });

    if (headers.length === 0) console.log('No MP Gateway found in DB.');
    process.exit(0);
}

check();
