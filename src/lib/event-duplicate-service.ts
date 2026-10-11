import type { PrismaClient } from "@wishi/prisma-client";
import { z } from "zod";
import { prepareListCopy } from "./list-lifecycle-service";
import { removeGiftPhoto } from "./gift-photos";
import { manualGiftOrder } from "./gift-order-service";

const input = z.object({
  name: z.string().trim().min(1).max(120),
  date: z.iso.date(),
});

export async function duplicateEventWithLists(
  db: PrismaClient,
  id: string,
  userId: string,
  data: { name: string; date: string },
) {
  const parsed = input.safeParse(data);
  if (!parsed.success) return { error: "invalidFields" };
  const photos: string[] = [];
  try {
    return await db.$transaction(
      async (tx) => {
        // Serialize against membership changes before checking access or copying lists.
        const family = await tx.family.updateMany({
          where: { events: { some: { id } }, members: { some: { userId } } },
          data: { membershipVersion: { increment: 1 } },
        });
        if (!family.count) return { error: "forbidden" };
        const source = await tx.event.findUniqueOrThrow({
          where: { id },
          include: {
            wishlists: {
              where: { ownerId: userId, deletedAt: null, archivedAt: null },
              include: {
                items: {
                  where: { deletedAt: null },
                  orderBy: [...manualGiftOrder],
                },
              },
            },
          },
        });
        const copy = await tx.event.create({
          data: {
            name: parsed.data.name,
            date: new Date(parsed.data.date + "T12:00:00Z"),
            description: source.description,
            familyId: source.familyId,
          },
        });
        for (const list of source.wishlists) {
          const copied = await prepareListCopy(list, photos);
          await tx.wishlist.create({
            data: {
              ...copied,
              name: list.name,
              ownerId: userId,
              eventId: copy.id,
            },
          });
        }
        return { success: true, eventId: copy.id };
      },
      { timeout: 30000 },
    );
  } catch {
    await Promise.all(photos.map(removeGiftPhoto));
    return { error: "unexpected" };
  }
}
