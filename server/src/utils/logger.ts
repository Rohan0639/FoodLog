/**
 * Structured (JSON-lines) logger. Fields whose names suggest a secret are
 * redacted, so a careless log call cannot leak a password, token or key.
 */
const SECRET_KEYS = /pass(word)?|token|secret|authorization|cookie|key|passphrase/i;

type Level = 'info' | 'warn' | 'error';

function redact(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = SECRET_KEYS.test(key) ? '[REDACTED]' : value;
  }
  return out;
}

export function log(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...redact(fields),
  });
  if (level === 'error') console.error(line);
  else console.log(line);
}
