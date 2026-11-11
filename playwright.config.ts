import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3000' },
  webServer: [
    {
      command: 'npm run start --workspace api',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      // Force the no-key state: a GROQ_API_KEY in the developer's shell must not leak into the e2e run.
      // Tests that need the AI path mock /capabilities and /rewrite themselves (see e2e/rewrite.spec.ts).
      env: { GROQ_API_KEY: '' },
    },
    {
      command: 'npm run start --workspace web',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { NEXT_PUBLIC_API_URL: 'http://localhost:3001' },
    },
  ],
});
