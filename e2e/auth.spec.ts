
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test('should login successfully and redirect to dashboard', async ({ page }) => {
        await page.goto('/login');

        // Switch to Admin mode - Removed as it does not exist in UI
        // await page.getByRole('button', { name: 'Admin' }).click();

        // Fill login form
        // Assuming standard selectors - you might need to inspect the React components to get exact IDs or names
        await page.fill('input[type="email"]', 'contato@inctec.com.br');
        await page.fill('input[type="password"]', 'Caio*1991');

        // Click submit
        await page.click('button[type="submit"]');

        // Wait for navigation or a specific element on the dashboard
        // Check if URL changes to dashboard or if we see a dashboard specific element
        await expect(page).toHaveURL(/\/dashboard/);

        // Optional: Check for a welcome message or sidebar element
        await expect(page.locator('text=Visão Geral')).toBeVisible();
    });

    test('should show error on invalid credentials', async ({ page }) => {
        await page.goto('/login');
        // await page.getByRole('button', { name: 'Admin' }).click();

        await page.fill('input[type="email"]', 'wrong@user.com');
        await page.fill('input[type="password"]', 'wrongpass');
        await page.click('button[type="submit"]');

        // Expect an error toast or message
        await expect(page.getByText(/inválid|err|incorret/i)).toBeVisible();
    });
});
