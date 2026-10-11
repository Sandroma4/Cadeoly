"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { refreshWishlists } from "@/lib/refresh";
import { duplicateEventWithLists } from "@/lib/event-duplicate-service";

export async function duplicateEvent(id: string, form: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  const result = await duplicateEventWithLists(prisma, id, session.user.id, {
    name: String(form.get("name") || ""),
    date: String(form.get("date") || ""),
  });
  refreshWishlists();
  return result;
}
