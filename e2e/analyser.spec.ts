import { test, expect } from '@playwright/test';

async function analyseSample(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Load sample' }).click();
  await page.getByRole('button', { name: 'Analyse match' }).click();
  await expect(page.getByRole('img', { name: /Match score \d+ out of 100/ })).toBeVisible();
}

test('loads the sample, analyses it and shows the score', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Load sample' }).click();
  await expect(page.getByLabel('CV', { exact: true })).not.toHaveValue('');
  await expect(page.getByLabel('Job description', { exact: true })).not.toHaveValue('');

  await page.getByRole('button', { name: 'Analyse match' }).click();

  await expect(page.getByRole('img', { name: /Match score \d+ out of 100/ })).toBeVisible();
  await expect(page.getByTestId('score-value')).toHaveText(/^\d+$/);
  await expect(page.getByText('Algorithmic analysis')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Matched keywords' }).locator('li').first()).toBeVisible();
  await expect(page.getByRole('list', { name: 'Missing keywords' }).locator('li').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tips' })).toBeVisible();
});

test('explains what is missing when a field is empty', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Analyse match' }).click();
  await expect(page.getByText('Paste your CV text to continue.')).toBeVisible();
});

test('privacy note is visible above the inputs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Do not paste real personal information', { exact: false })).toBeVisible();
});

test('hides the AI rewrite button when the API has no key', async ({ page }) => {
  const capabilities = page.waitForResponse((res) => res.url().endsWith('/capabilities') && res.ok());
  await page.goto('/');
  await capabilities;
  await page.getByRole('button', { name: 'Load sample' }).click();
  await page.getByRole('button', { name: 'Analyse match' }).click();
  await expect(page.getByRole('img', { name: /Match score/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Improve my bullets with AI' })).toHaveCount(0);
});

test('the analysis page works at 390px without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await analyseSample(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
