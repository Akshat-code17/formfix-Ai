import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: 'connected.spec.ts',
  timeout: 45_000,
  fullyParallel: true,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.FORMFIX_E2E_ORIGIN ?? 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.FORMFIX_E2E_ORIGIN ? undefined : {
    command: 'node ../../node_modules/vite/bin/vite.js build --mode demo && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
