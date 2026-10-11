import { googleAuthEnabled } from "@/lib/google-auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { returnPath } from "@/lib/return-path";
import { guestReservationAccess } from "@/lib/guest-reservation-access";
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
  return (
    <AuthForm
      register
      next={destination}
      initialName={access?.row.guestFirstName || undefined}
      initialEmail={access?.row.guestEmail || undefined}
      googleEnabled={googleAuthEnabled()}
    />
  );
}
