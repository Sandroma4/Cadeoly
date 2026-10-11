import type { PrismaClient } from "@wishi/prisma-client";

export async function configureSqlite(db: PrismaClient) {
  // Prisma's SQLite client uses one connection. Configure its lock wait as well
  // as the persistent journal mode before accepting application requests.
  await db.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
  await db.$queryRawUnsafe("PRAGMA journal_mode = WAL");
}
