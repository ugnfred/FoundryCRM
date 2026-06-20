// @ts-check
import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Foundry ERP E2E tests.
 * Targets production at https://foundry-crm.vercel.app (or override via env).
 *
 * Run: npx playwright test --config=tests/e2e/playwright.config.js
 */
export default defineConfig({
  testDir: './specs',
  globalSetup: './fixtures/global-setup.js',

  /* Each test file runs up to 30 s; bump per-test with test.setTimeout() */
  timeout: 30_000,

  /* One retry on CI, zero locally */
  retries: process.env.CI ? 1 : 0,

  /* Fail fast on CI so we don't burn minutes */
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'https://foundry-crm.vercel.app',

    /* Reuse the auth session saved by global-setup */
    storageState: './fixtures/auth.json',

    /* Keep traces for failed tests only */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    /* Generous action/navigation timeouts for a remote app */
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
