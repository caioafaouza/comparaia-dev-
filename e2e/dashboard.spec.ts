import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {

    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto('/login');
        await page.getByPlaceholder('Endereço de e-mail').fill('contato@inctec.com.br');
        await page.getByPlaceholder('Senha').fill('Caio*1991');
        await page.getByRole('button', { name: 'Entrar' }).click();
        await expect(page).toHaveURL(/\/admin/);
    });

    test('should click dashboard links', async ({ page }) => {
        // Verify sidebar is present
        await expect(page.getByTestId('nav-dashboard')).toBeVisible();
        await expect(page.getByTestId('nav-tenants')).toBeVisible();
        await expect(page.getByTestId('nav-users')).toBeVisible();
    });

    test('should display tenants table', async ({ page }) => {
        // Tenants is the default view, so table should be visible
        await expect(page.getByRole('table')).toBeVisible();
        await expect(page.getByTestId('tenants-header')).toBeVisible();
    });

    test('should allow navigation to other modules', async ({ page }) => {
        // Navigate to Overview
        await page.getByTestId('nav-dashboard').click();
        await expect(page.getByText('Visão Geral')).toBeVisible({ timeout: 10000 });

        // Click back to Tenants
        await page.getByTestId('nav-tenants').click();
        await expect(page.getByTestId('tenants-header')).toBeVisible();
    });

});
