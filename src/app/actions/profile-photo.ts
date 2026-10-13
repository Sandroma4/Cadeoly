"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateProfilePhoto } from "@/lib/profile-photos";
import { refreshWishlists } from "@/lib/refresh";

export async function saveProfilePhoto(form: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  const result = await updateProfilePhoto(prisma, session.user.id, form);
  if (result.success) refreshWishlists();
  return result;
}
