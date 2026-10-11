"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function completeTutorial() {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  await prisma.user.updateMany({
    where: { id: session.user.id, tutorialCompletedAt: null },
    data: { tutorialCompletedAt: new Date() },
  });
  return { success: true };
}
