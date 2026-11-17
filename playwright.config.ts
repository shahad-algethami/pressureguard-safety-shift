import { defineConfig, devices } from '@playwright/test';
const base = 'http://localhost:3002';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: { baseURL: base, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'msedge' } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: 'msedge' },
    },
  ],
  webServer: [
    {
      command: 'node tests/mock-openai.mjs',
      url: 'http://127.0.0.1:4011',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev -- --port 3002',
      url: base,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        PG_BUILD_DIR: '.next-e2e',
        OPENAI_API_KEY: 'test-only-not-a-real-key',
        OPENAI_BASE_URL: 'http://127.0.0.1:4011/v1',
        OPENAI_MODEL: 'test-model',
        NEXT_PUBLIC_SUPABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
        ALLOW_LOCAL_DEMO: 'true',
        PG_DATA_DIR: '.local-data/e2e',
        APP_ORIGIN: base,
      },
    },
  ],
});
