import { ApiError, apiRequest } from './client';

export interface AccountUser {
  id: string;
  email: string;
  name: string;
}

/** Creates an account and signs it in (the server sets the session cookie). */
export function register(input: { email: string; name: string; password: string }) {
  return apiRequest<{ user: AccountUser }>('/api/auth/register', { method: 'POST', body: input });
}

export function login(input: { email: string; password: string }) {
  return apiRequest<{ user: AccountUser }>('/api/auth/login', { method: 'POST', body: input });
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/api/auth/logout', { method: 'POST' });
}

/** The signed-in account, or null when there is no valid session. */
export async function currentUser(): Promise<AccountUser | null> {
  try {
    const data = await apiRequest<{ user: AccountUser }>('/api/auth/me');
    return data.user;
  } catch (err) {
    if (err instanceof ApiError && err.isUnauthorized) return null;
    throw err;
  }
}
