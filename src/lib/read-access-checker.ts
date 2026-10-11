import type { PrismaClient } from "@wishi/prisma-client";

export function createFamilyMembershipLoader(db: PrismaClient, userId: string) {
  let owners: Promise<ReadonlySet<string>> | undefined;
  return () => {
    owners ??= db.family
      .findMany({
        where: { members: { some: { userId } } },
        select: { members: { select: { userId: true } } },
      })
      .then(
        (families) =>
          new Set(
            families.flatMap((family) =>
              family.members.map((member) => member.userId),
            ),
          ),
      );
    return owners;
  };
}

type WishlistAccessContext = {
  ownerId: string;
  visibility: string;
  shareToken: string | null;
  archivedAt?: Date | null;
  deletedAt?: Date | null;
};

// Create once per read. Only active FAMILY lists share an owner membership check;
// link tokens and each list's revoked/archived state are always checked separately.
export function createReadAccessChecker(
  check: (list: WishlistAccessContext, token?: string) => Promise<boolean>,
) {
  const familyAccess = new Map<string, Promise<boolean>>();
  return (list: WishlistAccessContext, token?: string) => {
    if (list.visibility !== "FAMILY" || list.deletedAt || list.archivedAt)
      return check(list, token);
    let access = familyAccess.get(list.ownerId);
    if (!access) {
      access = check(list, token);
      familyAccess.set(list.ownerId, access);
    }
    return access;
  };
}
