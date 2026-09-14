
const connectionManager = require('./db/connectionManager');
const crypto = require('crypto');

async function run() {
    try {
        const db = connectionManager.getMaster();
        console.log('Checking plans...');
        const plans = await db('token_plans').select('*');
        let plan = plans.find(p => p.slug === 'enterprise');
        if (!plan) {
            console.log('Creating plan...');
            const [inserted] = await db('token_plans').insert({
                id: crypto.randomUUID(),
                name: 'Enterprise',
                slug: 'enterprise',
                price: 0,
                // currency: 'BRL', // Schema has default
                // active: true, // Schema has default
                limits: JSON.stringify({ monthlyTokens: 1000000 }),
                features: JSON.stringify({}),
            }).returning('*');
            plan = inserted;
        }

        console.log('Using Plan ID:', plan.id);

        const existing = await db('tenants').where({ slug: 'multirede' }).first();
        if (!existing) {
            console.log('Creating Tenant Multirede...');
            await db('tenants').insert({
                id: '8d095e5e-266c-4055-b665-5b8481b47ad2',
                name: 'Multirede',
                slug: 'multirede',
                db_host: process.env.DB_HOST || 'localhost',
                db_name: process.env.DB_DATABASE || 'comparaia',
                db_user: process.env.DB_USER || 'comparaia',
                db_password: 'encrypted_placeholder', // Schema requires not null
                plan: plan.id, // Column is 'plan'
                status: 'ACTIVE',
                created_at: new Date()
            });
            console.log('Tenant Created.');
        } else {
            console.log('Tenant already exists.');
        }

        console.log('DONE');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
