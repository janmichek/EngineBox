import { test, expect } from '@playwright/test';

test.describe('Converter UI', () => {
  test('loads playlists from server', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Engine OS');
    await expect(page.locator('.playlist-list li').first()).toBeVisible({ timeout: 10_000 });
    const count = await page.locator('.playlist-list li').count();
    expect(count).toBeGreaterThan(0);
  });

  test('select all and convert all playlists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.playlist-list li').first()).toBeVisible({ timeout: 10_000 });

    await page.click('text=Select All');
    const selectedText = await page.locator('.toolbar .count').textContent();
    const match = selectedText.match(/(\d+) selected/);
    expect(parseInt(match[1])).toBeGreaterThan(0);

    await page.click('.convert-btn');

    await expect(page.locator('.status')).toBeVisible({ timeout: 5000 });

    const startTime = Date.now();
    while (Date.now() - startTime < 120_000) {
      const classAttr = await page.locator('.status').getAttribute('class');
      if (classAttr && classAttr.includes('done')) break;
      if (classAttr && classAttr.includes('error')) {
        const text = await page.locator('.status').textContent();
        throw new Error(`Conversion failed: ${text}`);
      }
      await page.waitForTimeout(500);
    }

    await expect(page.locator('.status.done')).toBeVisible();
    await expect(page.locator('.download-link')).toBeVisible();
  });
});
