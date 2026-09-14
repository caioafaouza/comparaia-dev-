
const connectionManager = require('../server/db/connectionManager');
const { v4: uuidv4 } = require('uuid');

async function seed() {
    console.log('Seeding Mercado Pago Credentials...');

    // Credentials provided by USER
    // Note: In production, these should come from secure env vars or vault.
    const MP_CREDENTIALS = {
        publicKey: 'APP_USR-652a912a-cd70-4df9-a347-7d6bac67233d',
        accessToken: 'APP_USR-1870049184506514-111012-f3322251b852d8c19043d12bcbc6c532-2561295350',
        userId: '190978040'
    };

    try {
        const db = connectionManager.getMaster();

        // Check if exists
        const existing = await db('payment_gateways').where({ provider: 'mercadopago' }).first();

        const payload = {
            name: 'Mercado Pago (Sandbox)',
            active: true,
            is_default: true,
            credentials: JSON.stringify(MP_CREDENTIALS),
            updated_at: new Date()
        };

        if (existing) {
            await db('payment_gateways').where({ provider: 'mercadopago' }).update(payload);
            console.log('Updated existing Mercado Pago gateway configuration.');
        } else {
            await db('payment_gateways').insert({
                provider: 'mercadopago',
                created_at: new Date(),
                ...payload
            });
            console.log('Created new Mercado Pago gateway configuration.');
        }

        console.log('Seed completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }
}

seed();
