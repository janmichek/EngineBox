import { test, expect } from '@playwright/test';

test.describe('EngineBox UI', () => {
  test('loads playlists from server', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('EngineBox');
    await expect(page.locator('main ul li').first()).toBeVisible({ timeout: 10_000 });
    const count = await page.locator('main ul li').count();
    expect(count).toBeGreaterThan(0);
  });

  test('select all and convert all playlists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main ul li').first()).toBeVisible({ timeout: 10_000 });

    await page.locator('.select-all input[type="checkbox"]').check();
    const selectedText = await page.locator('.select-all span').textContent();
    const match = selectedText.match(/(\d+) selected/);
    expect(parseInt(match[1])).toBeGreaterThan(0);

    await page.click('footer button');

    await expect(page.locator('footer article')).toBeVisible({ timeout: 5000 });

    const startTime = Date.now();
    while (Date.now() - startTime < 120_000) {
      const classAttr = await page.locator('footer article').getAttribute('class');
      if (classAttr && classAttr.includes('done')) break;
      if (classAttr && classAttr.includes('error')) {
        const text = await page.locator('footer article').textContent();
        throw new Error(`Conversion failed: ${text}`);
      }
      await page.waitForTimeout(500);
    }

    await expect(page.locator('footer article.done')).toBeVisible();
    await expect(page.locator('a.download')).toBeVisible();
  });
});
