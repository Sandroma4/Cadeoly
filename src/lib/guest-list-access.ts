import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { guestListCookie, guestOwner } from "./guest-list-service";

export async function currentGuestOwner() {
  return guestOwner(prisma, (await cookies()).get(guestListCookie)?.value);
}
