/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// The app is served under an unguessable path taken from VITE_APP_SLUG (see .env.example).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const slug = env.VITE_APP_SLUG
  if (!slug) throw new Error('VITE_APP_SLUG is not set. Copy .env.example to .env.local and pick a random slug.')
  const base = `/${slug}/`
  return {
    base,
    // Build into dist/<slug>/ so the site root stays empty (404) and only the slug path serves the app.
    build: { outDir: `dist${base}`, emptyOutDir: true },
    plugins: [react()],
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
