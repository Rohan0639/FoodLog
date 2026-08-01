import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'

const repoRoot = path.resolve(__dirname, '..')

/**
 * Serves `/api/*` during `npm run dev`.
 *
 * In production Vercel runs the files in `api/` as serverless functions. The
 * Vite dev server knows nothing about them, so without this the food parser
 * 404s locally and the app reports that it cannot reach it.
 *
 * This runs the very same handler in-process — no duplicated parsing logic —
 * by loading it through Vite's SSR pipeline and adapting Node's req/res to the
 * small slice of the Vercel signature the handler actually uses.
 */
function vercelApiDevServer(): Plugin {
  return {
    name: 'foodlog:api-dev-server',
    apply: 'serve',
    configureServer(server) {
      // The handler reads process.env.GEMINI_API_KEY; load the root .env for it.
      const env = loadEnv('', repoRoot, '')
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }

      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (!url.startsWith('/api/')) return next()

        const handlerPath = path.join(repoRoot, `${url.slice(1)}.ts`)
        if (!fs.existsSync(handlerPath)) return next()

        try {
          // Collect the body — connect does not parse it for us.
          const raw = await new Promise<string>((resolve, reject) => {
            let data = ''
            req.on('data', (chunk) => { data += chunk })
            req.on('end', () => resolve(data))
            req.on('error', reject)
          })

          const vreq = req as any
          vreq.query = Object.fromEntries(new URL(req.url || '', 'http://localhost').searchParams)
          vreq.cookies = {}
          try {
            vreq.body = raw ? JSON.parse(raw) : {}
          } catch {
            vreq.body = raw
          }

          // Minimal VercelResponse surface.
          const vres = res as any
          vres.status = (code: number) => { res.statusCode = code; return vres }
          vres.json = (payload: unknown) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(payload))
            return vres
          }
          vres.send = (payload: unknown) => {
            res.end(typeof payload === 'string' ? payload : JSON.stringify(payload))
            return vres
          }

          const mod = await server.ssrLoadModule(handlerPath)
          await mod.default(vreq, vres)
        } catch (err) {
          server.config.logger.error(`[api-dev] ${url} failed: ${(err as Error).message}`)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              error: 'Dev API handler failed',
              message: (err as Error).message,
            }))
          }
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), vercelApiDevServer()],
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    strictPort: true,
    // The api/ handlers live above the Vite root and import from backend/ + shared/.
    fs: { allow: [repoRoot] },
  },
})
