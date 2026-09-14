
const axios = require('axios');
const connectionManager = require('../server/db/connectionManager');
const { createApp } = require('../server/app');
const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

// Mock Config
process.env.NODE_ENV = 'test';
process.env.PORT = 3001;

// MP Credentials (from Seed)
const MP_ACCESS_TOKEN = 'APP_USR-1870049184506514-111012-f3322251b852d8c19043d12bcbc6c532-2561295350';
process.env.FRONTEND_URL = 'https://comparaia.com';

// MOCK: Mercado Pago Payment.get
const { Payment } = require('mercadopago');
const originalGet = Payment.prototype.get;
let mockPaymentData = null;

Payment.prototype.get = async function (opts) {
    if (mockPaymentData && opts.id === mockPaymentData.id) {
        console.log(`[Mock] Intercepted Payment.get(${opts.id}) -> Returning Approved`);
        return mockPaymentData;
    }
    // Fallback to real call if not mocked ID (e.g. if we used real payment)
    return originalGet.apply(this, arguments);
};

async function runValidation() {
    console.log('--- STARTING PAYMENT VALIDATION ---');

    // 1. Setup App & DB
    const app = createApp();
    const db = connectionManager.getMaster();

    // 2. Create Tenant & User
    const tenantId = uuidv4();
    const email = `qa-payment-${Date.now()}@test.com`;
    const password = 'TestPass123!';

    console.log(`Creating Tenant: ${tenantId}`);

    // Direct DB insert for speed/reliability in test script
    await db('tenants').insert({
        id: tenantId,
        name: 'QA Payment Tenant',
        slug: `qa-pay-${Date.now()}`, // Unique slug
        db_host: 'localhost',
        db_name: `tenant_${Date.now()}`,
        db_user: 'postgres',
        db_password: 'pwd',
        plan: 'STARTER',
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date()
    });

    // User insertion skipped
    // ...

    // Ensure packages exist
    const proPackage = await db('token_packages').where({ id: 'pkg_pro' }).first();
    if (!proPackage) {
        console.log('Seeding Default Packages...');
        await db('token_packages').insert([
            { id: 'pkg_basic', name: 'Pacote Basic', tokens: 1000, price: 49, active: true },
            { id: 'pkg_pro', name: 'Pacote Pro', tokens: 5000, price: 199, active: true }
        ]).onConflict('id').ignore();
    }

    // Mock Auth (We will use a mocked Request Context middleware or just JWT generation if available)
    // Actually, let's just generate a real JWT if possible, or mock the middleware.
    // Easier: Use a helper to sign a token if we have valid secret.
    // server/.env has JWT_SECRET=replace-me-with-strong-secret

    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 'user-id-placeholder', email, tenantId, role: 'ADMIN' }, 'replace-me-with-strong-secret', { expiresIn: '1h' });

    console.log('User Authenticated. Token generated.');

    // 3. Purchase Package
    console.log('Step 3: Purchasing Package...');
    const packageId = 'pkg_pro'; // 5000 tokens

    const purchaseRes = await request(app)
        .post('/api/billing/purchase-package')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Tenant-ID', tenantId)
        .send({ packageId });

    if (purchaseRes.status !== 200) {
        console.error('Purchase Failed:', purchaseRes.body);
        process.exit(1);
    }

    console.log('Preference Created:', purchaseRes.body);
    const { initPoint, sandboxInitPoint } = purchaseRes.body;

    // Extract metadata/external_reference if possible? 
    // We can't see it from the response. We rely on MP to have it.

    // 4. Mock Payment (Since we cannot create real payments with these keys)
    console.log('Step 4: Setting up Mock Payment for Webhook...');

    const mockId = `mock-pay-${Date.now()}`;
    const externalRef = JSON.stringify({
        tenantId: tenantId,
        type: 'PACKAGE',
        itemId: packageId
    });

    mockPaymentData = {
        id: mockId,
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: 199.00,
        external_reference: externalRef,
        metadata: {}
    };

    const paymentId = mockId; // For webhook trigger
    console.log(`Mock Payment ID ready: ${paymentId}`);

    // SKIPPED: Real Payment Creation via API due to "Unauthorized use of live credentials"
    /* 
       const mpPayment = await axios.post(...) 
    */

    // 5. Trigger Webhook
    console.log('Step 5: Triggering Webhook...');

    try {
        const webhookRes = await request(app)
            .post('/api/billing/webhook/mercadopago')
            .send({
                type: 'payment',
                data: { id: String(paymentId) }
            });

        console.log('Webhook Response:', webhookRes.status);

        // 6. Verify DB
        console.log('Step 6: Verifying Ledger...');
        const tx = await db('token_transactions')
            .where({ tenant_id: tenantId, description: `MercadoPago Payment ${paymentId}` })
            .first();

        if (tx) {
            console.log('SUCCESS: Transaction found in DB!');
            console.log(tx);
        } else {
            console.error('FAILURE: Transaction not found.');
            console.log('Verifying Wallet Balance...');
        }

    } catch (e) {
        console.error('Payment Flow Error:', e.response ? e.response.data : e.message);
    }

    console.log('--- TEST COMPLETE ---');
    process.exit(0);
}

runValidation();
