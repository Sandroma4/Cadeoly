"use server";

import type { Prisma } from "@wishi/prisma-client";
import { getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { currentGuestOwner } from "@/lib/guest-list-access";
import {
  guestListCookie,
  guestListMaxAge,
  newGuestSession,
  parseGuestIdea,
} from "@/lib/guest-list-service";
import { guestCookieOptions } from "@/lib/guest-reservation-access";
import { allowAccountAttempt } from "@/lib/account-service";
import {
  fields,
  itemSchema,
  registrationSchema,
  wishlistSchema,
  emailSchema,
} from "@/lib/validation";
import type { ActionResult } from "@/lib/action-result";
import { refreshWishlists } from "@/lib/refresh";
import { reportBusinessEvent } from "@/lib/observability";
import { mailConfiguration, deliverMail } from "@/lib/reset-mail";

async function allowed(purpose: string, limit: number) {
  if (!process.env.AUTH_SECRET) return false;
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return (
    (await allowAccountAttempt(
      prisma,
      purpose + "-global",
      "all",
      process.env.AUTH_SECRET,
      1000,
    )) &&
    (await allowAccountAttempt(
      prisma,
      purpose,
      ip,
      process.env.AUTH_SECRET,
      limit,
    ))
  );
}

function refresh() {
  revalidatePath("/[locale]/guest/lists", "layout");
  refreshWishlists();
}

async function createGuestList(
  data: Prisma.WishlistCreateWithoutOwnerInput,
  ownerName?: string,
) {
  const owner = await currentGuestOwner();
  if (owner) {
    return prisma.wishlist.create({
      data: { ...data, owner: { connect: { id: owner.id } } },
      select: { id: true },
    });
  }
  const session = newGuestSession();
  const guest = await prisma.user.create({
    data: {
      name: ownerName,
      guestTokenHash: session.hash,
      guestExpiresAt: session.expires,
      wishlists: { create: data },
    },
    select: { wishlists: { select: { id: true } } },
  });
  (await cookies()).set(guestListCookie, session.token, {
    ...guestCookieOptions,
    maxAge: guestListMaxAge,
  });
  return guest.wishlists[0];
}

export async function startGuestWishlist(
  form: FormData,
): Promise<ActionResult<{ wishlistId: string }>> {
  const idea = parseGuestIdea(form.get("idea"));
  if (!idea.success) return { error: "invalidFields" };
  if (!(await allowed("guest-list-save", 30))) return { error: "rateLimited" };
  const t = await getTranslations("guestStart");
  const { price, ...item } = idea.data;
  const list = await createGuestList({
    name: t("defaultName"),
    visibility: "PRIVATE",
    shareToken: null,
    items: { create: { ...item, priceCents: price } },
  });
  refresh();
  reportBusinessEvent("guest_list_started");
  return { success: true, wishlistId: list.id };
}

export async function saveGuestWishlist(
  id: string | null,
  form: FormData,
): Promise<ActionResult<{ wishlistId: string }>> {
  const parsed = wishlistSchema.safeParse({
    ...fields(form),
    visibility: "PRIVATE",
  });
  const name = registrationSchema.shape.name.safeParse(form.get("ownerName"));
  if (!parsed.success || (id && form.get("ownerName") && !name.success))
    return { error: "invalidFields" };
  if (!(await allowed("guest-list-save", 30))) return { error: "rateLimited" };
  const owner = await currentGuestOwner();
  if (parsed.data.eventId || parsed.data.recipientId)
    return { error: "unauthorized" };
  const data = { ...parsed.data, visibility: "PRIVATE", shareToken: null };
  if (id) {
    if (!owner) return { error: "forbidden" };
    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.wishlist.updateMany({
        where: { id, ownerId: owner.id, deletedAt: null, archivedAt: null },
        data,
      });
      if (updated.count && name.success)
        await tx.user.update({
          where: { id: owner.id },
          data: { name: name.data },
        });
      return updated;
    });
    if (!updated.count) return { error: "forbidden" };
    refresh();
    return { success: true, wishlistId: id };
  }
  const listData = {
    ...data,
    visibility: "PRIVATE",
    shareToken: null,
  };
  const list = await createGuestList(
    listData,
    name.success ? name.data : undefined,
  );
  refresh();
  return { success: true, wishlistId: list.id };
}

export async function saveGuestItem(
  wishlistId: string,
  itemId: string | null,
  form: FormData,
): Promise<ActionResult> {
  const parsed = itemSchema.safeParse({ ...fields(form), priority: "NORMAL" });
  if (!parsed.success) return { error: "invalidFields" };
  const owner = await currentGuestOwner();
  if (!owner) return { error: "forbidden" };
  if (!(await allowed("guest-item-save", 100))) return { error: "rateLimited" };
  const list = await prisma.wishlist.findFirst({
    where: {
      id: wishlistId,
      ownerId: owner.id,
      deletedAt: null,
      archivedAt: null,
    },
    select: { id: true },
  });
  if (!list) return { error: "forbidden" };
  // Only the fields exposed by the guest editor may be changed.
  const { title, description, url, price } = parsed.data;
  const data = { title, description, url, priceCents: price };
  if (itemId) {
    const updated = await prisma.wishlistItem.updateMany({
      where: { id: itemId, wishlistId: list.id, deletedAt: null },
      data,
    });
    if (!updated.count) return { error: "forbidden" };
  } else {
    await prisma.wishlistItem.create({
      data: { ...data, wishlistId: list.id },
    });
  }
  refresh();
  reportBusinessEvent("guest_list_edited");
  return { success: true };
}

export async function sendGuestAccessLink(
  wishlistId: string,
  form: FormData,
): Promise<ActionResult> {
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { error: "invalidFields" };
  const owner = await currentGuestOwner();
  if (!owner) return { error: "forbidden" };
  if (!(await allowed("guest-access-email", 5)))
    return { error: "rateLimited" };
  if (
    !process.env.AUTH_SECRET ||
    !(await allowAccountAttempt(
      prisma,
      "guest-access-owner",
      owner.id,
      process.env.AUTH_SECRET,
      3,
    ))
  )
    return { error: "rateLimited" };
  const list = await prisma.wishlist.findFirst({
    where: {
      id: wishlistId,
      ownerId: owner.id,
      deletedAt: null,
      archivedAt: null,
    },
    select: { name: true },
  });
  if (!list) return { error: "forbidden" };
  const token = (await cookies()).get(guestListCookie)?.value;
  if (!token) return { error: "forbidden" };
  try {
    const { base, file } = mailConfiguration();
    const t = await getTranslations("guestStart");
    const locale = form.get("locale") === "en" ? "en" : "fr";
    const url = new URL(`/api/guest-lists/${wishlistId}/access`, base);
    url.searchParams.set("token", token);
    url.searchParams.set("locale", locale);
    await deliverMail(
      {
        from: process.env.MAIL_FROM || "Cadéoly <local@example.test>",
        to: email.data,
        subject: t("emailSubject"),
        text: t("emailBody", { name: list.name, url: url.toString() }),
      },
      file,
    );
    reportBusinessEvent("guest_access_email_sent");
    return { success: true };
  } catch {
    return { error: "emailUnavailable" };
  }
}

export async function deleteGuestItem(
  wishlistId: string,
  itemId: string,
): Promise<ActionResult> {
  const owner = await currentGuestOwner();
  if (!owner) return { error: "forbidden" };
  const deleted = await prisma.wishlistItem.updateMany({
    where: {
      id: itemId,
      wishlistId,
      deletedAt: null,
      wishlist: { ownerId: owner.id, deletedAt: null, archivedAt: null },
    },
    data: { deletedAt: new Date() },
  });
  if (!deleted.count) return { error: "forbidden" };
  refresh();
  return { success: true };
}
