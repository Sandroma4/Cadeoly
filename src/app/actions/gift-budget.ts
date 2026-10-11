"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseGiftBudget } from "@/lib/gift-budget";
import { refreshWishlists } from "@/lib/refresh";
export async function saveGiftBudget(
  scope: string,
  currency: string,
  amount: string,
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  const parsed = parseGiftBudget(scope, currency, amount);
  if (!parsed) return { error: "invalidFields" };
  const { amountCents } = parsed;
  await prisma.giftBudget.upsert({
    where: {
      userId_scope_currency: { userId: session.user.id, scope, currency },
    },
    create: { userId: session.user.id, scope, currency, amountCents },
    update: { amountCents },
  });
  refreshWishlists();
  return { success: true };
}
export async function removeGiftBudget(scope: string, currency: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  await prisma.giftBudget.deleteMany({
    where: { userId: session.user.id, scope, currency },
  });
  refreshWishlists();
  return { success: true };
}
