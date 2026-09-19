import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'connected.spec.ts', timeout: 90000, workers: 1,
  reporter: [['list'], ['json', { outputFile: '../../docs/connected-results.json' }]],
  use: { baseURL: 'http://localhost:5174', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-connected', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile-connected', use: { ...devices['Pixel 7'] } },
  ],
});
