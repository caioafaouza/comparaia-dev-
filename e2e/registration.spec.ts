
import { test, expect } from '@playwright/test';

test.describe('Tenant Registration & Login Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Ensure a clean state by clearing local storage
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('should register a new tenant and access the dashboard', async ({ page }) => {
        // Listen for console messages
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

        // 1. Go to Register Page directly
        console.log('Navigating to /register...');
        await page.goto('/register');

        // Wait for page to load
        await page.waitForLoadState('networkidle');
        console.log('Current URL after navigation:', page.url());

        // Wait for potential redirect or initial load
        await expect(page).toHaveTitle(/COMPARA IA/i);

        try {
            console.log('Waiting for register-submit-button...');
            const submitBtn = page.getByTestId('register-submit-button');
            await expect(submitBtn).toBeVisible({ timeout: 10000 });
            console.log('Found Submit Button');
        } catch (e) {
            console.log('Failed to find submit button.');
            console.log('Current URL:', page.url());

            // Take a screenshot for debugging
            await page.screenshot({ path: 'registration-failure.png' });
            console.log('Screenshot saved to registration-failure.png');

            // Log the body content (summarized)
            const body = await page.evaluate(() => document.body.innerText.substring(0, 500));
            console.log('Page body start:', body);

            throw e;
        }

        const timestamp = Date.now();
        const companyName = `Test Corp ${timestamp}`;
        const email = `admin${timestamp}@test.com`;

        // 2. Fill Form using TestIDs (Robust Selectors)
        console.log('Filling form...');
        await page.getByTestId('register-tenant-name').fill(companyName);
        await page.getByTestId('register-tenant-cnpj').fill('00.000.000/0001-00');
        await page.getByTestId('register-tenant-phone').fill('11999999999');
        await page.getByTestId('register-tenant-sector').selectOption('Indústria');
        await page.getByTestId('register-tenant-volume').selectOption('Até R$ 100k');
        await page.getByTestId('register-admin-name').fill('Admin user');
        await page.getByTestId('register-admin-email').fill(email);
        await page.getByTestId('register-admin-password').fill('Caio*1991');

        // 3. Submit and Wait for Provisioning (Slow operation)
        console.log('Submitting registration...');
        const provisioningPromise = page.waitForResponse(response =>
            (response.url().includes('/api/register-tenant') || response.url().includes('/api/auth/register')) &&
            (response.status() === 201 || response.status() === 200)
            , { timeout: 60000 });

        await page.getByTestId('register-submit-button').click();

        // Wait for network response
        await provisioningPromise;
        console.log('Registration provisioning completed.');

        // 4. Verify Success Redirect
        // Should redirect to dashboard or show success message.
        await expect(page).toHaveURL(/\/(dashboard|admin)/, { timeout: 30000 });
        console.log('Redirected to:', page.url());

        // 5. Verify Dashboard Elements
        // Check if we are really on the dashboard (SaaSLayout is rendered)
        await expect(page.getByTestId('saas-layout')).toBeVisible({ timeout: 15000 });
        console.log('SaaS Layout visible.');

        // 6. Reload to verify persistence/session
        await page.reload();
        await expect(page.getByTestId('saas-layout')).toBeVisible();
        console.log('Session persists after reload.');
    });
});
