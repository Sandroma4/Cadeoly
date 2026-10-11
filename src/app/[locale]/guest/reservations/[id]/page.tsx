import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guestReservationAccess } from "@/lib/guest-reservation-access";
import { GuestReservationManager } from "@/components/wishlist/GuestReservationManager";
import { PublicListHeader } from "@/components/wishlist/PublicListHeader";
export const metadata = { robots: { index: false, follow: false } };
export default async function GuestReservationPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const session = await auth();
  const access = await guestReservationAccess(id);
  if (!access) {
    if (
      session?.user?.id &&
      (await prisma.reservation.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true },
      }))
    )
      redirect(`/${locale}/dashboard/reservations`);
    notFound();
  }
  const row = access.row;
  return (
    <main className="public-container">
      <PublicListHeader />
      <GuestReservationManager
        id={id}
        title={row.item.title}
        message={row.personalMessage || ""}
        sent={Boolean(row.recapSentAt)}
        loggedIn={Boolean(session?.user?.id)}
        given={row.preparationStatus === "GIVEN"}
        guestName={row.guestFirstName || undefined}
      />
    </main>
  );
}
