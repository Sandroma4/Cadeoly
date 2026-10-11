import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
export const metadata = { robots: { index: false, follow: false } };
export default async function CancelledReservationPage() {
  const t = await getTranslations("guestReservation");
  return (
    <main className="public-container stack">
      <h1>{t("cancelled")}</h1>
      <p>{t("cancelHelp")}</p>
      <Link href="/">{t("home")}</Link>
    </main>
  );
}
