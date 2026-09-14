
import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = 'replace-me-with-strong-secret';
const API_URL = process.env.API_URL || 'http://localhost:3002'; // Default to match ps1
const TENANT_ID_A = '11111111-1111-1111-1111-111111111111';
const PACKAGE_ID = 'pkg_pro';
const MP_ACCESS_TOKEN = 'APP_USR-1870049184506514-111012-f3322251b852d8c19043d12bcbc6c532-2561295350';
const WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || 'testing123';

// MCP Generated Test User (Step 3523)
const BUYER_USER_ID = '3170244717';
const BUYER_EMAIL = 'test_user_57499613@testuser.com'; // Derived from nickname usually, but best to use manual login
// We must login manually or use credentials if known.
// Since password is masked, we prompt via Env.
const BUYER_PASSWORD = process.env.MP_BUYER_PASSWORD || 'check-mp-panel';

test.setTimeout(180000); // 3 minutes

test('Full Payment Flow: Checkout -> Poll MP -> Simulate Webhook', async ({ page, request }) => {
    // 1. Generate Token
    const token = jwt.sign({
        id: 'user-qa-e2e',
        email: 'qa-e2e@test.com',
        tenantId: TENANT_ID_A,
        role: 'ADMIN'
    }, JWT_SECRET, { expiresIn: '1h' });

    console.log(`Step 1: Generated Token for ${TENANT_ID_A}`);

    // 2. Create Preference
    console.log(`Step 2: Creating Preference at ${API_URL}...`);
    const purchaseRes = await request.post(`${API_URL}/api/billing/purchase-package`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': TENANT_ID_A
        },
        data: { packageId: PACKAGE_ID }
    });

    if (!purchaseRes.ok()) {
        console.log('Purchase Failed:', await purchaseRes.text());
        throw new Error('Purchase API Failed');
    }
    const body = await purchaseRes.json();
    const initPoint = body.sandboxInitPoint;
    const externalRef = body.externalReference;

    expect(initPoint).toBeDefined();
    expect(externalRef).toBeDefined();
    console.log(`Init Point: ${initPoint}`);
    console.log(`Ext Ref: ${externalRef}`);

    // 3. UI Checkout (Guest)
    console.log('Step 3: Navigating to Checkout...');
    await page.goto(initPoint);
    await page.waitForLoadState('networkidle');

    // Click "Cartão de crédito"
    const cardOption = page.locator('text=Cartão de crédito');
    try {
        await cardOption.click({ timeout: 5000 });
    } catch (e) {
        console.log('Card option click failed or skipped (direct form).');
    }

    // Fill Form (Mastercard from Screenshot)
    // 5031 4332 1540 6351
    await page.locator('input[name="cardNumber"], input[data-checkout="cardNumber"]').nth(0).fill('5031433215406351');
    await page.locator('input[name="cardholderName"], input[data-checkout="cardholderName"]').nth(0).fill('APRO');
    await page.locator('input[name="cardExpirationMonth"], input[data-checkout="cardExpirationMonth"]').nth(0).fill('11');
    await page.locator('input[name="cardExpirationYear"], input[data-checkout="cardExpirationYear"]').nth(0).fill('29');
    await page.locator('input[name="securityCode"], input[data-checkout="securityCode"]').nth(0).fill('123');
    await page.locator('input[name="docNumber"], input[data-checkout="docNumber"]').nth(0).fill('19119119100');
    await page.locator('input[type="email"]').nth(0).fill('qa-e2e-guest@test.com');

    // Pay
    await page.locator('button[type="submit"]:has-text("Pagar")').click();

    // Verify Success
    await expect(page.locator('text=Parabéns')).toBeVisible({ timeout: 60000 });
    console.log('Step 3: Payment UI Successful!');

    // 4. Poll MP Search
    console.log('Step 4: Polling MP for Payment Status...');
    let paymentId = null;
    let attempts = 0;
    while (!paymentId && attempts < 10) {
        await page.waitForTimeout(3000);
        const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${externalRef}&access_token=${MP_ACCESS_TOKEN}`;
        const searchRes = await request.get(searchUrl);
        if (searchRes.ok()) {
            const data = await searchRes.json();
            const results = data.results || [];
            const approved = results.find((p: any) => p.status === 'approved');
            if (approved) {
                paymentId = approved.id;
                console.log(`Found Approved Payment: ${paymentId}`);
            }
        }
        attempts++;
    }
    expect(paymentId).not.toBeNull();

    // 5. Simulate Webhook
    console.log('Step 5: Simulating Webhook URL with Signature...');
    const ts = Date.now().toString();
    const manifestId = paymentId;
    const requestId = `req-${ts}`;
    const template = `id:${manifestId};request-id:${requestId};ts:${ts};`;
    const hash = crypto.createHmac('sha256', WEBHOOK_SECRET).update(template).digest('hex');
    const signatureHeader = `ts=${ts};v1=${hash}`;

    const webhookRes = await request.post(`${API_URL}/api/billing/webhook/mercadopago`, {
        headers: {
            'x-signature': signatureHeader,
            'x-request-id': requestId
        },
        data: {
            action: 'payment.created',
            type: 'payment',
            data: { id: paymentId?.toString() } // MP sends string usually or number?
        }
    });

    console.log('Webhook Status:', webhookRes.status());
    expect(webhookRes.status()).toBe(200);

    console.log('TEST COMPLETE: Payment Creation + Webhook Validated.');
});
