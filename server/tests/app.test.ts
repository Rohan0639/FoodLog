import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { loadEnv } from '../src/config/env';

const ORIGIN = 'http://localhost:5173';
const app = createApp({ corsOrigin: ORIGIN, bodyLimit: '1kb' });

describe('health', () => {
  it('returns the success envelope', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('echoes a safe incoming request id and generates one otherwise', async () => {
    const echoed = await request(app).get('/api/health').set('X-Request-Id', 'abc12345-test');
    expect(echoed.headers['x-request-id']).toBe('abc12345-test');

    const generated = await request(app).get('/api/health').set('X-Request-Id', 'bad id!!');
    expect(generated.headers['x-request-id']).not.toBe('bad id!!');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sets security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('errors', () => {
  it('returns a safe 404 envelope for unknown API routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects oversized bodies with 413', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'x'.repeat(5000) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects malformed JSON with 400 and no parser detail', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{ not json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
    expect(JSON.stringify(res.body)).not.toMatch(/at |stack/i);
  });
});

describe('CORS', () => {
  it('allows the configured origin with credentials', async () => {
    const res = await request(app).get('/api/health').set('Origin', ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not allow other origins', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('configuration', () => {
  const valid = {
    DATABASE_URL: 'postgresql://u:p@h:5432/d',
    JWT_SECRET: 'x'.repeat(40),
  };

  it('accepts a complete environment and applies defaults', () => {
    const env = loadEnv(valid);
    expect(env.PORT).toBe(8787);
    expect(env.CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it('fails fast when a required value is missing, naming only the key', () => {
    expect(() => loadEnv({ JWT_SECRET: valid.JWT_SECRET })).toThrow('DATABASE_URL');
  });

  it('rejects a weak JWT secret without echoing it', () => {
    const attempt = () => loadEnv({ ...valid, JWT_SECRET: 'short' });
    expect(attempt).toThrow('JWT_SECRET');
    expect(attempt).not.toThrow(/short/);
  });
});

describe('database health', () => {
  it('reports 503 without leaking the cause when the database is down', async () => {
    const down = createApp({
      corsOrigin: ORIGIN,
      pingDatabase: async () => {
        throw new Error('connect ECONNREFUSED 10.0.0.1:5432 password=secret');
      },
    });
    const res = await request(down).get('/api/health/db');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|secret|5432/);
  });

  it('reports ok when the database answers', async () => {
    const up = createApp({ corsOrigin: ORIGIN, pingDatabase: async () => {} });
    const res = await request(up).get('/api/health/db');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { database: 'ok' } });
  });
});
