
import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'replace-me-with-strong-secret';
const API_URL = 'http://localhost:4809';
const TENANT_ID_A = '11111111-1111-1111-1111-111111111111';
const PACKAGE_ID = 'pkg_pro';

test('Checkout Flow via UI with Guest Payment', async ({ page, request }) => {
    // 1. Generate Token
    const token = jwt.sign({
        id: 'user-qa-e2e',
        email: 'qa-e2e@test.com',
        tenantId: TENANT_ID_A,
        role: 'ADMIN'
    }, JWT_SECRET, { expiresIn: '1h' });

    // 2. Create Preference
    console.log(`Creating Preference at ${API_URL}...`);
    const purchaseRes = await request.post(`${API_URL}/api/billing/purchase-package`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': TENANT_ID_A
        },
        data: { packageId: PACKAGE_ID }
    });

    // Debug response if fail
    if (!purchaseRes.ok()) {
        console.log('Purchase Failed:', await purchaseRes.text());
    }
    expect(purchaseRes.status(), 'Purchase API should succeed').toBe(200);
    const body = await purchaseRes.json();
    console.log('Init Point:', body.sandboxInitPoint);
    expect(body.sandboxInitPoint).toBeDefined();

    // 3. Navigate to Checkout
    await page.goto(body.sandboxInitPoint);

    // 4. Fill Guest Information (MP Sandbox UI)
    await page.waitForLoadState('networkidle');

    // Strategy: Look for "Pagar com cartão sem conta" or "Novo cartão"
    const cardOption = page.locator('text=Cartão de crédito');
    try {
        await cardOption.click({ timeout: 5000 });
    } catch (e) {
        console.log('Card option click failed or not needed.');
    }

    // Fill Card Number
    // Use framing: MP keeps checkout in Iframe sometimes? No, usually redirection.
    await page.locator('input[name="cardNumber"], input[data-checkout="cardNumber"]').nth(0).fill('4060000000000002');

    // Name
    await page.locator('input[name="cardholderName"], input[data-checkout="cardholderName"]').nth(0).fill('APRO');

    // Expiry
    await page.locator('input[name="cardExpirationMonth"], input[data-checkout="cardExpirationMonth"]').nth(0).fill('11');
    await page.locator('input[name="cardExpirationYear"], input[data-checkout="cardExpirationYear"]').nth(0).fill('29');

    // CVV
    await page.locator('input[name="securityCode"], input[data-checkout="securityCode"]').nth(0).fill('123');

    // CPF
    await page.locator('input[name="docNumber"], input[data-checkout="docNumber"]').nth(0).fill('19119119100');

    // Email
    await page.locator('input[type="email"]').nth(0).fill('qa-e2e-guest@test.com');

    // Click Pay
    await page.locator('button[type="submit"]:has-text("Pagar")').click();

    // 5. Wait for Success
    await expect(page.locator('text=Parabéns')).toBeVisible({ timeout: 60000 });

    console.log('Payment Successful!');
});
