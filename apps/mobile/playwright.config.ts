import { defineConfig } from '@playwright/test';

/**
 * E2E web (remplace les flows Maestro) : l'app exportée (`pnpm export:web`) est servie par e2e-web/support/serve.mjs
 * et testée contre un Supabase local (`supabase start`). Variables : voir e2e-web/README.md.
 */
export default defineConfig({
  testDir: './e2e-web',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'node e2e-web/support/serve.mjs',
    url: process.env.E2E_BASE_URL ?? 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
