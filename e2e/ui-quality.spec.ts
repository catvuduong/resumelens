import { test, expect } from '@playwright/test';

// Guards against shipping an app that looks like raw HTML: these apps are shown in a portfolio, so a real stylesheet is mandatory.
test('app is styled, not raw browser defaults', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const info = await page.evaluate(() => {
    let rules = 0;
    for (const sheet of Array.from(document.styleSheets)) {
      try { rules += sheet.cssRules.length; } catch { /* cross-origin sheet */ }
    }
    const link = document.querySelector('a');
    return {
      rules,
      linkColor: link ? getComputedStyle(link).color : '',
      font: getComputedStyle(document.body).fontFamily,
      bodyMargin: getComputedStyle(document.body).margin,
    };
  });
  expect(info.rules, 'stylesheet has too few rules: write real CSS for the whole UI').toBeGreaterThanOrEqual(40);
  expect(info.linkColor, 'links still use the default browser blue').not.toBe('rgb(0, 0, 238)');
  expect(info.font.toLowerCase(), 'body still uses the default serif font').not.toBe('times new roman');
  expect(info.bodyMargin, 'body still has the default 8px margin').not.toBe('8px');
});

test('no horizontal scroll on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
