import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Connection strings come from the environment. They are never committed.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
