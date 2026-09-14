import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {

    test('should login successfully as Master Admin', async ({ page }) => {
        // Debugging: Log console and errors
        page.on('console', msg => console.log(`[Browser] ${msg.text()}`));
        page.on('pageerror', exception => console.log(`[Browser Error] ${exception}`));

        // Go to login page
        await page.goto('/login');

        // Fill credentials using placeholders
        await page.getByPlaceholder('Endereço de e-mail').fill('contato@inctec.com.br');
        await page.getByPlaceholder('Senha').fill('Caio*1991');

        // Click login
        await page.getByRole('button', { name: 'Entrar' }).click();

        // Expect to be redirected to admin
        await expect(page).toHaveURL(/\/admin/);

        // Check for some dashboard element
        try {
            await expect(page.getByText('Visão Geral')).toBeVisible({ timeout: 5000 });
        } catch (e) {
            await expect(page.getByText('Gerenciar Organizações')).toBeVisible();
        }
    });

    test('should show error with invalid credentials', async ({ page }) => {
        await page.goto('/login');
        await page.getByPlaceholder('Endereço de e-mail').fill('wrong@email.com');
        await page.getByPlaceholder('Senha').fill('invalid');
        await page.getByRole('button', { name: 'Entrar' }).click();

        await expect(page.getByText(/inválid|err|found/i)).toBeVisible();
    });

});
