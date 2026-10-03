import 'dotenv/config';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { createPrisma, pingDatabase } from './db/client';
import { log } from './utils/logger';

const env = loadEnv();
const db = createPrisma(env.DATABASE_URL);
const app = createApp({
  corsOrigin: env.CORS_ORIGIN,
  pingDatabase: () => pingDatabase(db),
  services: {
    db,
    jwtSecret: env.JWT_SECRET,
    secureCookies: env.NODE_ENV === 'production',
  },
});

app.listen(env.PORT, () => {
  log('info', 'server started', { port: env.PORT, env: env.NODE_ENV });
});
