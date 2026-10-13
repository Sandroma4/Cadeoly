"use server";
import { FamilyRole } from "@/lib/domain-values";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { fields, familySchema, emailSchema } from "@/lib/validation";
import { refreshWishlists } from "@/lib/refresh";
import { manageFamily } from "@/lib/family-service";
import {
  joinFamily,
  issueInvitation,
  pendingInvitations,
  revokeInvitation,
} from "@/lib/invitation-service";
export async function createFamily(form: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  const parsed = familySchema.safeParse(fields(form));
  if (!parsed.success) return { error: "invalidFields" };
  const family = await prisma.family.create({
    data: {
      ...parsed.data,
      ownerId: session.user.id,
      members: { create: { userId: session.user.id, role: FamilyRole.ADMIN } },
    },
  });
  refreshWishlists();
  return { success: true, familyId: family.id };
}
export async function getMyFamilies() {
  const session = await auth();
  if (!session?.user?.id) return [];
  return prisma.family.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profilePhoto: true,
              profilePhotoVisibility: true,
            },
          },
        },
      },
      _count: { select: { members: true } },
    },
  });
}
export async function createInvitation(familyId: string, email: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: "invalidFields" };
  const result = await issueInvitation(
    prisma,
    familyId,
    parsed.data,
    session.user.id,
  );
  refreshWishlists();
  return result;
}
export async function getPendingInvitations(familyId: string) {
  const session = await auth();
  return session?.user?.id
    ? pendingInvitations(prisma, familyId, session.user.id)
    : [];
}
export async function cancelInvitation(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  const result = await revokeInvitation(prisma, id, session.user.id);
  refreshWishlists();
  return result;
}
export async function renewInvitation(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  const invitation = await prisma.invitation.findFirst({
    where: {
      id,
      family: {
        members: { some: { userId: session.user.id, role: FamilyRole.ADMIN } },
      },
    },
    select: { familyId: true, email: true },
  });
  if (!invitation) return { error: "forbidden" };
  const result = await issueInvitation(
    prisma,
    invitation.familyId,
    invitation.email,
    session.user.id,
  );
  refreshWishlists();
  return result;
}
export async function acceptInvitation(token: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true },
  });
  if (!user) return { error: "unauthorized" };
  const result = await joinFamily(prisma, token, user);
  refreshWishlists();
  return result;
}
export async function changeFamilyMembership(
  familyId: string,
  operation: string,
  memberId?: string,
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  if (!["leave", "remove", "promote", "transfer"].includes(operation))
    return { error: "invalidFields" };
  const result = await manageFamily(
    prisma,
    familyId,
    session.user.id,
    operation as "leave" | "remove" | "promote" | "transfer",
    memberId,
  );
  refreshWishlists();
  return result;
}
