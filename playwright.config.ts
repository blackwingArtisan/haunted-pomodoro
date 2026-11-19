import { defineConfig, devices } from '@playwright/test';

/** End-to-end tests drive the production build (with its service worker) on port 3182. */
const PORT = 3182;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    // Sound is synthesized live; keep the test machine quiet and its audio stack out of the way.
    launchOptions: { args: ['--disable-audio-output'] },
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
