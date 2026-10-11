import { Auth } from "@auth/core";
import { createAuthConfig } from "@/lib/auth-config";
import { canonicalAuthRequest } from "@/lib/auth-request";
import { prisma } from "@/lib/prisma";
import { guestListAuthEvents } from "@/auth";
// A native Request keeps the canonical Google callback and cookie origin aligned.
async function handle(request: Request) {
  return Auth(canonicalAuthRequest(request), {
    ...createAuthConfig(prisma),
    events: guestListAuthEvents,
  });
}
export { handle as GET, handle as POST };
