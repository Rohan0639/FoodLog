import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '..')

/**
 * In development, `/api/*` is forwarded to the Express server (server/), so the
 * browser sees one origin and the session cookie works without CORS changes.
 * Start the server with `npm run server:dev` first.
 */
const apiTarget = process.env.API_TARGET ?? 'http://localhost:8787'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
    // The shared code lives above the Vite root.
    fs: { allow: [repoRoot] },
  },
})
