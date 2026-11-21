import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 25_000,
  use: { baseURL: 'http://127.0.0.1:4174', browserName: 'chromium', viewport: { width: 1440, height: 960 }, trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run preview -- --host 127.0.0.1 --port 4174 --strictPort', url: 'http://127.0.0.1:4174' },
    { command: 'node server.mjs', url: 'http://127.0.0.1:8787/health' },
  ],
});
