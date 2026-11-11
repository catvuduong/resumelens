import { test, expect, Page } from '@playwright/test';

// The real API has no key in CI, so the AI layer is exercised by answering its two endpoints from the test.
// The unit tests cover the server-side Groq client against mocked HTTP.

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

async function analyseSampleWithAi(page: Page) {
  await page.route('**/capabilities', (route) => route.fulfill({ json: { ai: true } }));
  const capabilities = page.waitForResponse((res) => res.url().endsWith('/capabilities'));
  await page.goto('/');
  await capabilities;
  await page.getByRole('button', { name: 'Load sample' }).click();
  await page.getByRole('button', { name: 'Analyse match' }).click();
  await expect(page.getByRole('img', { name: /Match score/ })).toBeVisible();
}

test('shows the AI button and original vs improved bullets with a copy action', async ({ page }) => {
  await page.route('**/analyses/*/rewrite', (route) =>
    route.fulfill({
      json: {
        source: 'ai',
        tips: [],
        bullets: [
          {
            index: 1,
            original: '- Built a customer dashboard in React and TypeScript used by 4,000 monthly users.',
            improved: 'Built a React and TypeScript customer dashboard used by 4,000 monthly users.',
          },
        ],
      },
    }),
  );
  await analyseSampleWithAi(page);

  await page.getByRole('button', { name: 'Improve my bullets with AI' }).click();

  await expect(page.getByText('AI-assisted rewrite')).toBeVisible();
  await expect(page.getByText('Built a React and TypeScript customer dashboard used by 4,000 monthly users.')).toBeVisible();
  const copy = page.getByRole('button', { name: 'Copy improved bullet 1' });
  await copy.click();
  await expect(copy).toHaveText('Copied');
});

test('falls back to the rule-based tips when the rewrite is unavailable', async ({ page }) => {
  await page.route('**/analyses/*/rewrite', (route) =>
    route.fulfill({ json: { source: 'algorithm', bullets: [], tips: ['Add measurable results to bullet 1.'] } }),
  );
  await analyseSampleWithAi(page);

  await page.getByRole('button', { name: 'Improve my bullets with AI' }).click();

  await expect(page.getByText('The AI rewrite is unavailable right now')).toBeVisible();
  await expect(page.getByText('AI-assisted rewrite')).toHaveCount(0);
  await expect(page.getByText('Algorithmic analysis')).toBeVisible();
});
