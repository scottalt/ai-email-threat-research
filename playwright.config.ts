import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 2,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
      : undefined,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
