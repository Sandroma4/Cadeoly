import NextAuth from "next-auth";
import { prisma } from "./lib/prisma";
import { createAuthConfig } from "./lib/auth-config";
import { cookies } from "next/headers";
import { attachGuestLists, guestListCookie } from "./lib/guest-list-service";
import { reportBusinessEvent } from "./lib/observability";
export const guestListAuthEvents = {
  async signIn({ user }: { user: { id?: string } }) {
    if (!user.id) return;
    const jar = await cookies();
    const count = await attachGuestLists(
      prisma,
      user.id,
      jar.get(guestListCookie)?.value,
    );
    if (count) {
      jar.delete(guestListCookie);
      reportBusinessEvent("guest_lists_kept");
    }
  },
};
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...createAuthConfig(prisma),
  events: guestListAuthEvents,
});
