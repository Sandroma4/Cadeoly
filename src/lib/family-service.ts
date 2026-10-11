import { FamilyRole } from "./domain-values";
import type { PrismaClient } from "@wishi/prisma-client";
export type FamilyOperation = "leave" | "remove" | "promote" | "transfer";
export async function manageFamily(
  db: PrismaClient,
  familyId: string,
  actorId: string,
  operation: FamilyOperation,
  memberId?: string,
) {
  return db.$transaction(async (tx) => {
    // Take the SQLite write lock before reading roles, so two removals cannot eliminate every admin.
    const locked = await tx.family.updateMany({
      where: {
        id: familyId,
        members: {
          some: {
            userId: actorId,
            ...(operation === "leave" ? {} : { role: FamilyRole.ADMIN }),
          },
        },
      },
      data: { membershipVersion: { increment: 1 } },
    });
    if (!locked.count) return { error: "forbidden" };
    const family = await tx.family.findUnique({
      where: { id: familyId },
      include: { members: { include: { user: { select: { email: true } } } } },
    });
    if (!family) return { error: "forbidden" };
    const targetId = operation === "leave" ? actorId : memberId;
    const target = family.members.find((member) => member.userId === targetId);
    if (!target) return { error: "forbidden" };
    if (operation === "transfer") {
      if (family.ownerId !== actorId || target.userId === actorId)
        return { error: "forbidden" };
      await tx.familyMember.update({
        where: { id: target.id },
        data: { role: FamilyRole.ADMIN },
      });
      await tx.family.update({
        where: { id: familyId },
        data: { ownerId: target.userId },
      });
      await tx.familyMember.update({
        where: { userId_familyId: { userId: actorId, familyId } },
        data: { role: FamilyRole.MEMBER },
      });
      return { success: true };
    }
    if (operation === "promote") {
      await tx.familyMember.update({
        where: { id: target.id },
        data: { role: FamilyRole.ADMIN },
      });
      return { success: true };
    }
    if (target.userId === family.ownerId) return { error: "transferFirst" };
    if (
      target.role === FamilyRole.ADMIN &&
      family.members.filter((member) => member.role === FamilyRole.ADMIN)
        .length <= 1
    )
      return { error: "lastAdmin" };
    if (operation === "remove" && target.userId === actorId)
      return { error: "forbidden" };
    await tx.wishlist.updateMany({
      where: { ownerId: target.userId, event: { familyId } },
      data: { eventId: null },
    });
    if (target.user.email)
      await tx.invitation.deleteMany({
        where: { familyId, email: target.user.email.toLowerCase() },
      });
    await tx.familyMember.delete({ where: { id: target.id } });
    return { success: true };
  });
}
