import type { Instrumentation } from "next";
import { reportServerError } from "./lib/observability";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { prisma } = await import("./lib/prisma");
    const { configureSqlite } = await import("./lib/sqlite-runtime");
    await configureSqlite(prisma);
  }
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  _request,
  context,
) => {
  reportServerError(error, context.routePath);
};
