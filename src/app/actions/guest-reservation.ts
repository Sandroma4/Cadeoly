"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { managementToken } from "@/lib/guest-reservation-service";
import { guestReservationAccess } from "@/lib/guest-reservation-access";
import { allowAccountAttempt } from "@/lib/account-service";
import { deliverMail, mailConfiguration } from "@/lib/reset-mail";
import { refreshWishlists } from "@/lib/refresh";

async function allowed(identity: string, purpose: string, limit = 10) {
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
      500,
    )) &&
    (await allowAccountAttempt(
      prisma,
      purpose,
      identity,
      process.env.AUTH_SECRET,
      limit,
    )) &&
    (await allowAccountAttempt(
      prisma,
      purpose + "-ip",
      ip,
      process.env.AUTH_SECRET,
      50,
    ))
  );
}
async function sendRecap(id: string, locale: string) {
  const row = await prisma.reservation.findUnique({
    where: { id },
    include: { item: { select: { title: true } } },
  });
  if (!row?.guestEmail || row.userId || !process.env.AUTH_SECRET) return false;
  try {
    const { base, file } = mailConfiguration();
    const url = new URL(`/api/guest-reservations/${id}`, base);
    url.searchParams.set("token", managementToken(id, process.env.AUTH_SECRET));
    url.searchParams.set("locale", locale === "en" ? "en" : "fr");
    const en = locale === "en";
    const registerUrl = new URL(`/${en ? "en" : "fr"}/register`, base);
    registerUrl.searchParams.set(
      "next",
      `/${en ? "en" : "fr"}/guest/reservations/${id}`,
    );
    await deliverMail(
      {
        from: process.env.MAIL_FROM || "Cadéoly <local@example.test>",
        to: row.guestEmail,
        subject: en ? "Your Cadéoly reservation" : "Votre réservation Cadéoly",
        text: en
          ? `Your gift is reserved: ${row.item.title}\n\nManage your reservation, edit your note or cancel:\n${url}\n\n---\nAnd what about you?\nNever receive duplicate or unwanted gifts again! Create your own wish list for your next birthday or celebration:\n${registerUrl}\n(Your name and email will be pre-filled automatically)\n\nKeep this personal link private. No account is required.`
          : `Votre cadeau est réservé : ${row.item.title}\n\nGérer votre réservation, modifier votre petit mot ou annuler :\n${url}\n\n---\nEt si c’était à votre tour ?\nNe recevez plus de cadeaux en double ou inutiles ! Créez votre propre liste pour votre prochain anniversaire ou fête :\n${registerUrl}\n(Votre prénom et votre email seront déjà pré-remplis)\n\nConservez ce lien personnel confidentiel. Aucun compte n’est nécessaire.`,
      },
      file,
    );
    await prisma.reservation.updateMany({
      where: { id, userId: null },
      data: { recapSentAt: new Date() },
    });
    return true;
  } catch {
    return false;
  }
}
export async function reserveAsGuest() {
  return { error: "unauthorized" };
}
export async function manageGuestReservation(
  id: string,
  operation: "save" | "cancel" | "given" | "claim" | "resend",
  message = "",
  locale = "fr",
) {
  const access = await guestReservationAccess(id);
  if (!access) return { error: "forbidden" };
  const { row, verified } = access;
  if (operation === "resend") {
    if (!(await allowed(id, "guest-recap", 3))) return { error: "rateLimited" };
    return (await sendRecap(id, locale))
      ? { success: true }
      : { error: "emailDeliveryFailed" };
  }
  if (operation === "claim") {
    const session = await auth();
    if (!session?.user?.id) return { error: "unauthorized" };
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user?.email || user.email.toLowerCase() !== row.guestEmail)
      return { error: "guestEmailMismatch" };
    if (!verified && !user.emailVerified) return { error: "guestEmailProof" };
    await prisma.$transaction(async (tx) => {
      const attached = await tx.reservation.updateMany({
        where: {
          id,
          userId: null,
          managementTokenHash: row.managementTokenHash,
        },
        data: {
          userId: user.id,
          guestSessionHash: null,
          managementTokenHash: null,
          managementExpiresAt: null,
          guestEmail: null,
          guestFirstName: null,
        },
      });
      if (attached.count && verified && !user.emailVerified)
        await tx.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
    });
  } else if (operation === "cancel") {
    await prisma.reservation.deleteMany({
      where: { id, userId: null, managementTokenHash: row.managementTokenHash },
    });
  } else if (operation === "given") {
    await prisma.reservation.updateMany({
      where: { id, userId: null, managementTokenHash: row.managementTokenHash },
      data: { preparationStatus: "GIVEN", messageReleasedAt: new Date() },
    });
  } else if (operation === "save" && message.trim().length <= 1000) {
    await prisma.reservation.updateMany({
      where: { id, userId: null, managementTokenHash: row.managementTokenHash },
      data: { personalMessage: message.trim() || null },
    });
  } else return { error: "invalidFields" };
  refreshWishlists();
  if (operation === "cancel")
    redirect(`/${locale === "en" ? "en" : "fr"}/guest/reservations/cancelled`);
  if (operation === "claim")
    redirect(`/${locale === "en" ? "en" : "fr"}/dashboard/reservations`);
  return { success: true };
}
