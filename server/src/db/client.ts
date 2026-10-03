import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

/**
 * The single Prisma client for the server. Repositories receive it as a
 * dependency, so tests can point it at a different database.
 */
export function createPrisma(connectionString: string): PrismaClient {
  // The adapter does not read ?schema= from the URL, so pass it explicitly.
  const schema = new URL(connectionString).searchParams.get('schema') ?? undefined;
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }, { schema }),
  });
}

export type Database = PrismaClient;

/** Resolves when the database answers a trivial query; rejects otherwise. */
export async function pingDatabase(db: Database): Promise<void> {
  await db.$queryRaw`SELECT 1`;
}
