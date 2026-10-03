import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { Database } from '../../db/client';

export const TOKEN_TTL_SECONDS = 15 * 60;
export const COOKIE_NAME = 'foodlog_session';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

export class AuthError extends Error {
  constructor(
    readonly code: 'EMAIL_TAKEN' | 'INVALID_CREDENTIALS',
    message: string
  ) {
    super(message);
  }
}

const toPublic = (user: { id: string; email: string; name: string }): PublicUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
});

export async function register(
  db: Database,
  input: { email: string; name: string; password: string }
): Promise<PublicUser> {
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  try {
    const user = await db.user.create({
      data: { email: input.email.toLowerCase(), name: input.name, passwordHash },
    });
    return toPublic(user);
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new AuthError('EMAIL_TAKEN', 'An account with this email already exists.');
    }
    throw err;
  }
}

export async function login(
  db: Database,
  input: { email: string; password: string }
): Promise<PublicUser> {
  const user = await db.user.findUnique({ where: { email: input.email.toLowerCase() } });
  // Same error whether the email or the password is wrong, so accounts cannot be enumerated.
  const ok = user ? await argon2.verify(user.passwordHash, input.password) : false;
  if (!user || !ok) {
    throw new AuthError('INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  return toPublic(user);
}

export function signToken(userId: string, secret: string): string {
  return jwt.sign({ sub: userId }, secret, { expiresIn: TOKEN_TTL_SECONDS, algorithm: 'HS256' });
}

/** Returns the user id if the token is valid and unexpired, otherwise null. */
export function verifyToken(token: string, secret: string): string | null {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
