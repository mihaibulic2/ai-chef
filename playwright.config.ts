import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Same slug the app is served under (from .env.local; see .env.example).
const slug = process.env.VITE_APP_SLUG ?? readFileSync('.env.local', 'utf8').match(/^VITE_APP_SLUG=(.+)$/m)?.[1]?.trim()
if (!slug) throw new Error('VITE_APP_SLUG is not set. Copy .env.example to .env.local.')
const url = `http://localhost:5173/${slug}/`

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: url, ...devices['iPhone 14'] },
  projects: [{ name: 'webkit-iphone', use: { ...devices['iPhone 14'] } }],
  webServer: { command: 'npx vite --port 5173', url, reuseExistingServer: true },
})
