import type { NextFunction, Request, Response } from 'express';
import { COOKIE_NAME, verifyToken } from '../modules/auth/auth.service';
import { sendError } from './errors';

declare global {
  // Set by requireAuth, read by route handlers.
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

/** Rejects the request unless it carries a valid, unexpired session cookie. */
export function requireAuth(jwtSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE_NAME];
    const userId = token ? verifyToken(token, jwtSecret) : null;
    if (!userId) {
      sendError(res, 401, 'UNAUTHORIZED', 'Please sign in.');
      return;
    }
    req.userId = userId;
    next();
  };
}
