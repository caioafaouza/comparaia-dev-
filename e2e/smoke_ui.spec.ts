
import { test, expect } from '@playwright/test';

test('Smoke Test - Check Port 3000', async ({ page, request }) => {
    // Check API availability if possible
    try {
        const res = await request.get('http://localhost:3000/');
        console.log('GET / status:', res.status());
    } catch (e) {
        console.log('GET / failed:', e.message);
    }

    // Navigate
    await page.goto('http://localhost:3000', { timeout: 10000 });
    const content = await page.content();
    console.log('Page Title:', await page.title());
    console.log('Content Valid:', content.length > 50);
});
