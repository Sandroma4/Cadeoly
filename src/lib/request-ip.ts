import { headers } from "next/headers";

/**
 * First client address set by the hosting proxy, used only for throttling.
 * Null when unknown, and on the isolated E2E server where every test account
 * shares 127.0.0.1 (global and per-email limits still apply there).
 */
export async function requestIp() {
  if (process.env.CADEOLY_E2E === "true") return null;
  return (
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null
  );
}
