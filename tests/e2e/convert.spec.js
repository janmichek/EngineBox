import { test, expect } from '@playwright/test';

test.describe('EngineBox UI', () => {
  test('loads playlists from server', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('EngineBox');
    await expect(page.locator('main ul li').first()).toBeVisible({ timeout: 10_000 });
    const count = await page.locator('main ul li').count();
    expect(count).toBeGreaterThan(0);
  });

  test('shows each playlist once with tracks', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main ul li').first()).toBeVisible({ timeout: 10_000 });

    const items = page.locator('main ul li');
    const count = await items.count();
    const names = [];

    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const name = (await item.locator('span').textContent())?.trim();
      const tracks = await item.locator('small').textContent();
      expect(parseInt(tracks, 10)).toBeGreaterThan(0);
      names.push(name);
    }

    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((name) => name === 'SOLID')).toHaveLength(1);
    expect(names.filter((name) => name === 'RIVER')).toHaveLength(1);
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
