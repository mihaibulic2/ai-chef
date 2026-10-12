import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5173/IPRBduozpCGT/', ...devices['iPhone 14'] },
  projects: [{ name: 'webkit-iphone', use: { ...devices['iPhone 14'] } }],
  webServer: { command: 'npx vite --port 5173', url: 'http://localhost:5173/IPRBduozpCGT/', reuseExistingServer: true },
})
