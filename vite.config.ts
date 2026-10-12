/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The app is served under an unguessable path; see firebase.json.
export const APP_BASE = '/IPRBduozpCGT/'

export default defineConfig({
  base: APP_BASE,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
