import { test, expect } from '@playwright/test';

test('history lists saved analyses and deletes one', async ({ page }) => {
  // Make sure there is at least one saved analysis to act on.
  await page.goto('/');
  await page.getByRole('button', { name: 'Load sample' }).click();
  await page.getByRole('button', { name: 'Analyse match' }).click();
  await expect(page.getByRole('img', { name: /Match score/ })).toBeVisible();

  await page.getByRole('link', { name: 'History' }).click();
  await expect(page).toHaveURL(/\/history$/);

  const cards = page.getByTestId('analysis-card');
  await expect(cards.first()).toBeVisible();
  const card = cards.first();
  const id = await card.getAttribute('data-id');
  expect(id).not.toBeNull();

  await card.getByRole('button', { name: `Delete analysis ${id}` }).click();
  // Deleting asks for confirmation first, so a stray click cannot remove a record.
  await expect(page.getByRole('button', { name: 'Yes, delete' })).toBeVisible();
  await page.getByRole('button', { name: 'Yes, delete' }).click();

  await expect(page.locator(`[data-testid="analysis-card"][data-id="${id}"]`)).toHaveCount(0);
  await expect(page.getByText(`Deleted analysis #${id}.`)).toBeVisible();
});

test('cancelling a delete keeps the analysis', async ({ page }) => {
  await page.goto('/history');
  const card = page.getByTestId('analysis-card').first();
  await expect(card).toBeVisible();
  const id = await card.getAttribute('data-id');
  await card.getByRole('button', { name: `Delete analysis ${id}` }).click();
  await card.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator(`[data-testid="analysis-card"][data-id="${id}"]`)).toHaveCount(1);
});

test('open loads a saved analysis into the analyser', async ({ page }) => {
  await page.goto('/history');
  const card = page.getByTestId('analysis-card').first();
  await expect(card).toBeVisible();
  const id = await card.getAttribute('data-id');
  await card.getByRole('link', { name: 'Open' }).click();

  await expect(page).toHaveURL(new RegExp(`/analyses/${id}$`));
  await expect(page.getByRole('img', { name: /Match score \d+ out of 100/ })).toBeVisible();
  await expect(page.getByLabel('CV', { exact: true })).not.toHaveValue('');
});

test('history has no horizontal scrolling at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/history');
  await expect(page.getByTestId('analysis-card').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
