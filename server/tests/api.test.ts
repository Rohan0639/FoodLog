import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { createPrisma, type Database } from '../src/db/client';
import { foodKey, type AiParser } from '../src/modules/parsing/foodParsing';

const url = process.env.DATABASE_URL;
const describeIfDb = url ? describe : describe.skip;
const JWT_SECRET = 'test-secret-that-is-long-enough-1234567890';
const ORIGIN = 'http://localhost:5173';
const timeout = 60_000;

describeIfDb('auth and parse API (live database)', () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;
  const emails: string[] = [];
  let aiCalls = 0;

  const ai: AiParser = async () => {
    aiCalls++;
    return [{ name: 'egg', quantity: 2, unit: 'piece', calories: 140, protein: 12, carbs: 1, fat: 10, sugar: 0, fiber: 0 }];
  };

  const newEmail = () => {
    const email = `api-${randomUUID()}@example.test`;
    emails.push(email);
    return email;
  };

  const password = 'a long enough passphrase';

  beforeAll(() => {
    db = createPrisma(url as string);
    app = createApp({
      corsOrigin: ORIGIN,
      services: { db, jwtSecret: JWT_SECRET, secureCookies: false, ai },
    });
  });

  afterAll(async () => {
    if (emails.length) await db.user.deleteMany({ where: { email: { in: emails } } });
    await db.$disconnect();
  }, timeout);

  describe('registration and login', () => {
    it('registers, stores a hashed password and sets an httpOnly session cookie', async () => {
      const email = newEmail();
      const res = await request(app).post('/api/auth/register').send({ email, name: 'Ana', password });

      expect(res.status).toBe(201);
      expect(res.body.data.user).toEqual({ id: expect.any(String), email, name: 'Ana' });
      expect(res.body.data.user.passwordHash).toBeUndefined();

      const cookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
      expect(cookie).toMatch(/foodlog_session=/);
      expect(cookie).toMatch(/HttpOnly/i);

      const stored = await db.user.findUniqueOrThrow({ where: { email } });
      expect(stored.passwordHash).not.toContain(password);
      expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
    }, timeout);

    it('rejects a duplicate email with 409', async () => {
      const email = newEmail();
      await request(app).post('/api/auth/register').send({ email, name: 'A', password });
      const again = await request(app).post('/api/auth/register').send({ email, name: 'B', password });
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('EMAIL_TAKEN');
    }, timeout);

    it('rejects a short password and bad input with field messages, not stack traces', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email', name: '', password: 'x' });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/email|password|name/);
    });

    it('gives the same generic error for a wrong password and an unknown email', async () => {
      const email = newEmail();
      await request(app).post('/api/auth/register').send({ email, name: 'C', password });

      const wrongPassword = await request(app).post('/api/auth/login').send({ email, password: 'wrong password 123' });
      const unknownEmail = await request(app).post('/api/auth/login').send({ email: newEmail(), password: 'wrong password 123' });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
    }, timeout);

    it('logs in with the right password', async () => {
      const email = newEmail();
      await request(app).post('/api/auth/register').send({ email, name: 'D', password });
      const res = await request(app).post('/api/auth/login').send({ email, password });
      expect(res.status).toBe(200);
      expect(res.headers['set-cookie']).toBeDefined();
    }, timeout);
  });

  describe('sessions', () => {
    it('returns 401 from /me without a session', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 for a forged or tampered session token', async () => {
      const res = await request(app).get('/api/auth/me').set('Cookie', 'foodlog_session=not.a.real.token');
      expect(res.status).toBe(401);
    });

    it('returns the current user with a valid session, and logout ends it', async () => {
      const email = newEmail();
      const agent = request.agent(app);
      await agent.post('/api/auth/register').send({ email, name: 'E', password });

      const me = await agent.get('/api/auth/me');
      expect(me.status).toBe(200);
      expect(me.body.data.user.email).toBe(email);

      await agent.post('/api/auth/logout');
      const after = await agent.get('/api/auth/me');
      expect(after.status).toBe(401);
    }, timeout);
  });

  describe('food parsing', () => {
    it('refuses to parse without a session', async () => {
      const res = await request(app).post('/api/parse-food').send({ text: '2 eggs' });
      expect(res.status).toBe(401);
    });

    it('validates the text', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/register').send({ email: newEmail(), name: 'F', password });
      const res = await agent.post('/api/parse-food').send({ text: '   ' });
      expect(res.status).toBe(422);
    }, timeout);

    it('calls the AI once for a new food and answers the repeat from the saved table', async () => {
      const agent = request.agent(app);
      const email = newEmail();
      const reg = await agent.post('/api/auth/register').send({ email, name: 'G', password });
      const userId = reg.body.data.user.id as string;

      const before = aiCalls;
      const first = await agent.post('/api/parse-food').send({ text: '2 eggs' });
      expect(first.status).toBe(200);
      expect(first.body.data.items[0]).toMatchObject({ name: 'egg', source: 'ai', calories: 140 });
      expect(aiCalls).toBe(before + 1);

      const second = await agent.post('/api/parse-food').send({ text: '3 eggs' });
      expect(second.status).toBe(200);
      expect(second.body.data.items[0]).toMatchObject({ source: 'dictionary', calories: 210 });
      expect(aiCalls).toBe(before + 1);

      const saved = await db.foodDictionaryEntry.findUnique({
        where: { userId_key: { userId, key: foodKey('egg') } },
      });
      expect(saved).not.toBeNull();
    }, timeout);

    it('reports the parser as unavailable without leaking the cause', async () => {
      const broken = createApp({
        corsOrigin: ORIGIN,
        services: {
          db,
          jwtSecret: JWT_SECRET,
          secureCookies: false,
          ai: async () => {
            throw new Error('upstream secret detail');
          },
        },
      });
      const agent = request.agent(broken);
      await agent.post('/api/auth/register').send({ email: newEmail(), name: 'H', password });
      const res = await agent.post('/api/parse-food').send({ text: 'mystery pastry' });
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('PARSER_UNAVAILABLE');
      expect(JSON.stringify(res.body)).not.toMatch(/secret detail/);
    }, timeout);
  });
});
