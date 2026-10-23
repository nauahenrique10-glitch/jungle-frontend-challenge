import { defineConfig } from '@playwright/test'

export default defineConfig({
 testDir: './tests/e2e',
 fullyParallel: true,
 // Each test owns a Chromium process. Serial by default on this 4 GB workspace;
 // explicit --workers=N remains available on machines with sufficient memory.
 workers: 1,
 retries: 0,
 forbidOnly: !!process.env.CI,
 reporter: [['list'], ['html', { open: 'never' }]],
 use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', serviceWorkers: 'allow' },
 projects: [390, 414, 768, 1440].map(width => ({ name: `chromium-${width}`, use: { browserName: 'chromium' as const, viewport: { width, height: 900 } } })),
 webServer: {
  command: 'npm run dev -- --port 4173 --strictPort',
  url: 'http://127.0.0.1:4173',
  reuseExistingServer: false,
  env: { VITE_ENABLE_MSW: 'true', VITE_API_URL: '/api', VITE_AUTH_SCENARIO: 'success', VITE_CATALOG_SCENARIO: 'success', VITE_DETAIL_SCENARIO: 'success', VITE_COMMERCE_SCENARIO: 'success' },
 },
})
