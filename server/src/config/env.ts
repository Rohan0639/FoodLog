import { z } from 'zod';

/**
 * Validated server configuration. Startup fails fast if anything is missing,
 * rather than failing on the first request.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
});

export type ServerEnv = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Names only. Values can be secrets, so they are never echoed.
    const names = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid server configuration: ${names}`);
  }
  return result.data;
}
