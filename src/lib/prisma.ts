import { PrismaClient } from "@wishi/prisma-client";
import { reportServerError, reportSlowOperation } from "./observability";

const globalForPrisma = global as unknown as {
  cadeolyPrisma?: PrismaClient;
  wishiPrisma?: PrismaClient;
};

function createClient() {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "error" },
    ],
  });
  client.$on("query", (event) =>
    reportSlowOperation("database", event.duration),
  );
  client.$on("error", () => reportServerError(undefined, "/database"));
  return client;
}
export const prisma =
  globalForPrisma.cadeolyPrisma ||
  globalForPrisma.wishiPrisma ||
  createClient();

if (process.env.NODE_ENV !== "production")
  globalForPrisma.cadeolyPrisma = prisma;
