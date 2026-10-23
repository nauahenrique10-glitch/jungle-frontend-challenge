import { defineConfig } from '@playwright/test'
import base from './playwright.config'
export default defineConfig({
 ...base,
 testDir: './tests/preview',
 use: { ...base.use, baseURL: 'http://127.0.0.1:4174' },
 projects: [414, 1440].map(width => ({ name: `preview-${width}`, use: { browserName: 'chromium' as const, viewport: { width, height: 900 } } })),
 webServer: { command: 'npm run preview -- --port 4174 --strictPort', url: 'http://127.0.0.1:4174', reuseExistingServer: false },
})
