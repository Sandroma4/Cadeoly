"use server";
import { randomBytes } from "node:crypto";
import { reportBusinessEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { withAuth, withListOwner, listOwnerId } from "@/lib/action-auth";
import { saveGuestWishlist } from "./guest-list";
import { currentGuestOwner } from "@/lib/guest-list-access";
import type { ActionResult } from "@/lib/action-result";
import { wishlistSchema, fields } from "@/lib/validation";
import { refreshWishlists } from "@/lib/refresh";
import { readWishlist } from "@/lib/wishlist-service";
import { changeListState, duplicateList } from "@/lib/list-lifecycle-service";
import type { GiftPageOptions } from "@/lib/gift-search";
async function validEvent(eventId: string | null, userId: string) {
  return (
    !eventId ||
    Boolean(
      await prisma.event.findFirst({
        where: { id: eventId, family: { members: { some: { userId } } } },
      }),
    )
  );
}
async function validRecipient(id: string | null, userId: string) {
  return (
    !id ||
    Boolean(
      await prisma.recipient.findFirst({ where: { id, ownerId: userId } }),
    )
  );
}
export async function createWishlist(
  form: FormData,
): Promise<ActionResult<{ wishlistId: string }>> {
  if (!(await auth())?.user?.id) return saveGuestWishlist(null, form);
  return withAuth(
    async (userId): Promise<ActionResult<{ wishlistId: string }>> => {
      const parsed = wishlistSchema.safeParse(fields(form));
      if (!parsed.success)
        return {
          error: "invalidFields",
          fields: Object.keys(parsed.error.flatten().fieldErrors),
        };
      if (
        !(await validEvent(parsed.data.eventId, userId)) ||
        !(await validRecipient(parsed.data.recipientId, userId))
      )
        return { error: "forbidden" };
      const list = await prisma.wishlist.create({
        data: { ...parsed.data, ownerId: userId },
      });
      refreshWishlists();
      reportBusinessEvent("wishlist_created");
      return { success: true, wishlistId: list.id };
    },
  );
}
export async function updateWishlist(
  id: string,
  form: FormData,
): Promise<ActionResult> {
  if (!(await auth())?.user?.id) return saveGuestWishlist(id, form);
  return withAuth(async (userId): Promise<ActionResult> => {
    const parsed = wishlistSchema.safeParse(fields(form));
    if (!parsed.success)
      return {
        error: "invalidFields",
        fields: Object.keys(parsed.error.flatten().fieldErrors),
      };
    if (
      !(await validEvent(parsed.data.eventId, userId)) ||
      !(await validRecipient(parsed.data.recipientId, userId))
    )
      return { error: "forbidden" };
    const updated = await prisma.wishlist.updateMany({
      where: { id, ownerId: userId, archivedAt: null, deletedAt: null },
      data: {
        ...parsed.data,
        ...(parsed.data.visibility !== "LINK" ? { shareToken: null } : {}),
      },
    });
    if (!updated.count) return { error: "forbidden" };
    refreshWishlists();
    return { success: true };
  });
}
export async function deleteWishlist(id: string): Promise<ActionResult> {
  return setWishlistState(id, "trash");
}
export async function setWishlistState(
  id: string,
  operation: "archive" | "trash" | "restore",
): Promise<ActionResult> {
  return withListOwner(async (userId): Promise<ActionResult> => {
    if (!["archive", "trash", "restore"].includes(operation))
      return { error: "invalidFields" };
    const result = await changeListState(prisma, id, userId, operation);
    refreshWishlists();
    return result;
  });
}
export async function duplicateWishlist(
  id: string,
  name: string,
): Promise<ActionResult<{ wishlistId: string }>> {
  return withListOwner(
    async (userId): Promise<ActionResult<{ wishlistId: string }>> => {
      const result = await duplicateList(prisma, id, userId, name);
      refreshWishlists();
      return result;
    },
  );
}
export async function changeShareLink(
  id: string,
  revoke = false,
): Promise<ActionResult<{ token: string | null }>> {
  return withAuth(
    async (userId): Promise<ActionResult<{ token: string | null }>> => {
      const token = revoke ? null : randomBytes(32).toString("hex");
      const result = await prisma.wishlist.updateMany({
        where: {
          id,
          ownerId: userId,
          visibility: "LINK",
          archivedAt: null,
          deletedAt: null,
        },
        data: { shareToken: token },
      });
      if (!result.count) return { error: "forbidden" };
      refreshWishlists();
      return { success: true, token };
    },
  );
}
export async function getMyWishlists(
  view: "active" | "archived" | "trash" = "active",
  limit?: number,
) {
  const userId = await listOwnerId();
  if (!userId) return [];
  return prisma.wishlist.findMany({
    where: {
      ownerId: userId,
      ...(view === "trash"
        ? { deletedAt: { not: null } }
        : {
            deletedAt: null,
            archivedAt: view === "archived" ? { not: null } : null,
          }),
    },
    orderBy: { createdAt: "desc" },
    ...(limit === undefined
      ? {}
      : { take: Math.min(Math.max(Math.trunc(limit), 1), 100) }),
    select: {
      id: true,
      name: true,
      description: true,
      visibility: true,
      _count: { select: { items: { where: { deletedAt: null } } } },
    },
  });
}
export async function getWishlistById(id: string, options?: GiftPageOptions) {
  const userId = await listOwnerId();
  if (!userId) return null;
  return readWishlist(prisma, id, userId, undefined, options);
}
export async function getSharedWishlist(
  token: string,
  options?: GiftPageOptions,
) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const list = await prisma.wishlist.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      visibility: true,
      ownerId: true,
      owner: { select: { guestTokenHash: true } },
    },
  });
  if (!list || list.owner.guestTokenHash || list.visibility !== "LINK")
    return null;
  const [session, guest] = await Promise.all([auth(), currentGuestOwner()]);
  return readWishlist(
    prisma,
    list.id,
    guest && guest.id === list.ownerId ? guest.id : session?.user?.id,
    token,
    options,
  );
}
export async function getPublicWishlist(id: string, options?: GiftPageOptions) {
  const list = await prisma.wishlist.findFirst({
    where: { id, visibility: "PUBLIC", archivedAt: null, deletedAt: null },
    select: { id: true },
  });
  if (!list) return null;
  const session = await auth();
  return readWishlist(prisma, id, session?.user?.id, undefined, options);
}
export async function getFamilyWishlists(familyId?: string, limit = 50) {
  const session = await auth();
  if (!session?.user?.id) return [];
  const userId = session.user.id;
  if (
    familyId &&
    !(await prisma.familyMember.findUnique({
      where: { userId_familyId: { userId, familyId } },
    }))
  )
    return [];
  return prisma.wishlist.findMany({
    where: {
      ownerId: { not: userId },
      archivedAt: null,
      deletedAt: null,
      visibility: { in: ["FAMILY", "PUBLIC"] },
      owner: {
        familyMembers: {
          some: {
            family: {
              ...(familyId ? { id: familyId } : {}),
              members: { some: { userId } },
            },
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      owner: { select: { name: true } },
      _count: { select: { items: { where: { deletedAt: null } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
}
