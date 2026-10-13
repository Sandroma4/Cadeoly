import type { PrismaClient } from "@wishi/prisma-client";
import { saveGiftPhoto, removeGiftPhoto } from "./gift-photos";

export async function canReadProfilePhoto(
  db: PrismaClient,
  ownerId: string,
  viewerId?: string,
) {
  if (!viewerId) return false;
  const user = await db.user.findUnique({
    where: { id: ownerId },
    select: { profilePhoto: true, profilePhotoVisibility: true },
  });
  if (!user?.profilePhoto) return false;
  if (ownerId === viewerId) return true;
  if (user.profilePhotoVisibility === "MEMBERS") return true;
  if (user.profilePhotoVisibility !== "FAMILY") return false;
  return Boolean(
    await db.family.findFirst({
      where: {
        AND: [
          { members: { some: { userId: ownerId } } },
          { members: { some: { userId: viewerId } } },
        ],
      },
      select: { id: true },
    }),
  );
}

export async function updateProfilePhoto(
  db: PrismaClient,
  userId: string,
  form: FormData,
) {
  const operation = form.get("operation") || "save";
  const visibility = form.get("visibility");
  if (operation !== "save" && operation !== "remove")
    return { error: "invalidFields" };
  if (
    operation === "save" &&
    !["PRIVATE", "FAMILY", "MEMBERS"].includes(String(visibility))
  )
    return { error: "invalidFields" };
  if (
    !(await db.user.findUnique({ where: { id: userId }, select: { id: true } }))
  )
    return { error: "unauthorized" };
  const file = form.get("photo");
  let uploaded: string | undefined;
  if (operation === "save" && file instanceof File && file.size > 0) {
    try {
      uploaded = await saveGiftPhoto(file);
    } catch {
      return { error: "invalidPhoto" };
    }
  }
  try {
    const previous = await db.$transaction(async (transaction) => {
      const current = await transaction.user.findUniqueOrThrow({
        where: { id: userId },
        select: { profilePhoto: true },
      });
      await transaction.user.update({
        where: { id: userId },
        data: {
          profilePhoto: operation === "remove" ? null : uploaded,
          ...(operation === "save"
            ? { profilePhotoVisibility: String(visibility) }
            : {}),
        },
      });
      return current.profilePhoto;
    });
    if (operation === "remove" || uploaded) await removeGiftPhoto(previous);
    return { success: true };
  } catch (error) {
    if (uploaded) await removeGiftPhoto(uploaded);
    throw error;
  }
}
