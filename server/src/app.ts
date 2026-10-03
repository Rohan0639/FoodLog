import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { errorHandler, notFound, sendError } from './middleware/errors';
import { log } from './utils/logger';
import { authRouter } from './modules/auth/auth.routes';
import { parseRouter } from './modules/parsing/parse.routes';
import type { Database } from './db/client';
import type { AiParser } from './modules/parsing/foodParsing';

export interface AppOptions {
  corsOrigin: string;
  bodyLimit?: string;
  /** Throws when the database is unreachable. Optional so the app can run without one. */
  pingDatabase?: () => Promise<void>;
  /** Database and auth wiring. Without these, only the health routes are served. */
  services?: {
    db: Database;
    jwtSecret: string;
    secureCookies: boolean;
    ai?: AiParser;
  };
}

/** Builds the Express app. Kept free of side effects so tests can mount it directly. */
export function createApp({ corsOrigin, bodyLimit = '100kb', pingDatabase, services }: AppOptions): express.Express {
  const app = express();

  app.disable('x-powered-by');

  // Request ID, reused if the caller sent one, so logs can be correlated.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header('x-request-id');
    const requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  // Security headers.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    next();
  });

  // CORS: a single configured origin, with credentials for the auth cookie.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.header('origin') === corsOrigin) {
      res.setHeader('Access-Control-Allow-Origin', corsOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Request logging: method, endpoint, status, duration, request ID. No bodies.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      log('info', 'request', {
        requestId: res.locals.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
      });
    });
    next();
  });

  app.use(express.json({ limit: bodyLimit }));
  app.use(cookieParser());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ success: true, data: { status: 'ok' } });
  });

  app.get('/api/health/db', async (_req: Request, res: Response) => {
    if (!pingDatabase) {
      sendError(res, 503, 'DB_NOT_CONFIGURED', 'No database is configured.');
      return;
    }
    try {
      await pingDatabase();
      res.json({ success: true, data: { database: 'ok' } });
    } catch (err) {
      // The cause is logged, never sent to the client.
      log('error', 'database health check failed', {
        requestId: res.locals.requestId,
        errorName: err instanceof Error ? err.name : 'UnknownError',
      });
      sendError(res, 503, 'DB_UNAVAILABLE', 'The database is not reachable right now.');
    }
  });

  if (services) {
    app.use('/api/auth', authRouter(services));
    app.use('/api', parseRouter(services));
  }

  app.use('/api', notFound);
  app.use((_req: Request, res: Response) => sendError(res, 404, 'NOT_FOUND', 'Not found'));
  app.use(errorHandler);

  return app;
}
