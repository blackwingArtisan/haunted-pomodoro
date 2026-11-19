import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests for a deployed copy: the same browser, pointed at LIVE_URL, with no local server.
 * Run: LIVE_URL=https://example.pages.dev npm run smoke
 */
const LIVE_URL = process.env.LIVE_URL;
if (!LIVE_URL) throw new Error('Set LIVE_URL to the deployed site, for example LIVE_URL=https://example.pages.dev npm run smoke');

export default defineConfig({
  testDir: 'tests/smoke',
  workers: 1,
  retries: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: LIVE_URL,
    viewport: { width: 1440, height: 1000 },
    launchOptions: { args: ['--disable-audio-output'] },
  },
});
