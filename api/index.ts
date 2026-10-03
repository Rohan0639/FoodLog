import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server/src/app';
import { loadEnv } from '../server/src/config/env';
import { createPrisma, pingDatabase } from '../server/src/db/client';

/**
 * Vercel serverless entry for every /api/* request. vercel.json rewrites each
 * request here and passes the original path in `__route`, so the Express app
 * sees the same URL it would locally. The app is built once per warm instance.
 */
let app: ReturnType<typeof createApp> | null = null;

function getApp(): ReturnType<typeof createApp> {
  if (app) return app;
  const env = loadEnv();
  const db = createPrisma(env.DATABASE_URL);
  app = createApp({
    corsOrigin: env.CORS_ORIGIN,
    pingDatabase: () => pingDatabase(db),
    services: {
      db,
      jwtSecret: env.JWT_SECRET,
      secureCookies: env.NODE_ENV === 'production',
    },
  });
  return app;
}

/** Puts the original /api path back on the request, and removes the routing parameter. */
function restoreRoute(req: IncomingMessage): void {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = url.searchParams.get('__route') ?? '';
  url.searchParams.delete('__route');
  const query = url.searchParams.toString();
  req.url = `/api/${route}${query ? `?${query}` : ''}`;
}

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  try {
    restoreRoute(req);
    getApp()(req, res);
  } catch (err) {
    // Configuration problems (for example a missing variable) fail here, with names only.
    console.error(JSON.stringify({ level: 'error', message: 'server configuration failed', error: (err as Error).message }));
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: { code: 'SERVER_MISCONFIGURED', message: 'The server is not configured correctly.' } }));
  }
}
