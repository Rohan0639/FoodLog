import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Database } from '../../db/client';
import { sendError } from '../../middleware/errors';
import { AuthError, COOKIE_NAME, TOKEN_TTL_SECONDS, login, register, signToken } from './auth.service';
import { requireAuth } from '../../middleware/auth';

const registerSchema = z.object({
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(200),
});

export interface AuthDeps {
  db: Database;
  jwtSecret: string;
  secureCookies: boolean;
}

function setSessionCookie(res: Response, token: string, secure: boolean): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/',
  });
}

/** Validation failures return the field names and messages only. */
function validationMessage(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
}

export function authRouter({ db, jwtSecret, secureCookies }: AuthDeps): Router {
  const router = Router();

  router.post('/register', async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 422, 'VALIDATION_ERROR', validationMessage(parsed.error));
      return;
    }
    try {
      const user = await register(db, parsed.data);
      setSessionCookie(res, signToken(user.id, jwtSecret), secureCookies);
      res.status(201).json({ success: true, data: { user } });
    } catch (err) {
      if (err instanceof AuthError) {
        sendError(res, 409, err.code, err.message);
        return;
      }
      throw err;
    }
  });

  router.post('/login', async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 422, 'VALIDATION_ERROR', validationMessage(parsed.error));
      return;
    }
    try {
      const user = await login(db, parsed.data);
      setSessionCookie(res, signToken(user.id, jwtSecret), secureCookies);
      res.json({ success: true, data: { user } });
    } catch (err) {
      if (err instanceof AuthError) {
        sendError(res, 401, err.code, err.message);
        return;
      }
      throw err;
    }
  });

  router.post('/logout', (_req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { path: '/', httpOnly: true, sameSite: 'lax', secure: secureCookies });
    res.status(204).end();
  });

  router.get('/me', requireAuth(jwtSecret), async (req: Request, res: Response) => {
    const user = await db.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      sendError(res, 401, 'UNAUTHORIZED', 'Please sign in again.');
      return;
    }
    res.json({ success: true, data: { user: { id: user.id, email: user.email, name: user.name } } });
  });

  return router;
}
