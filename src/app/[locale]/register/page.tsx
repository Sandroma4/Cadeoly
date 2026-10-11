import { googleAuthEnabled } from "@/lib/google-auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { returnPath } from "@/lib/return-path";
import { guestReservationAccess } from "@/lib/guest-reservation-access";
import { currentGuestOwner } from "@/lib/guest-list-access";
import { prisma } from "@/lib/prisma";
export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  const destination = returnPath(next, locale);
  const id = destination.match(
    /^\/(?:fr|en)\/guest\/reservations\/([A-Za-z0-9_-]+)$/,
  )?.[1];
  const access = id ? await guestReservationAccess(id) : null;
  const guest = await currentGuestOwner();
  const guestUser = guest
    ? await prisma.user.findUnique({
        where: { id: guest.id },
        select: { name: true },
      })
    : null;
  return (
    <AuthForm
      register
      next={destination}
      initialName={access?.row.guestFirstName || guestUser?.name || undefined}
      initialEmail={access?.row.guestEmail || undefined}
      googleEnabled={googleAuthEnabled()}
    />
  );
}
