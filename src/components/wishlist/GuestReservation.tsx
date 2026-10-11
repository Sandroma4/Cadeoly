"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
export function GuestReservation({
  wishlistId,
  token,
  managementId,
}: {
  itemId: string;
  wishlistId: string;
  token?: string;
  reserved: boolean;
  group: boolean;
  managementId?: string;
}) {
  const locale = useLocale(),
    t = useTranslations("guestAccount"),
    legacy = useTranslations("guestReservation");
  return managementId ? (
    <Link href={"/guest/reservations/" + managementId}>{legacy("manage")}</Link>
  ) : (
    <Link
      className="primary-link"
      href={{
        pathname: "/login",
        query: {
          next:
            "/" + locale + (token ? "/share/" + token : "/lists/" + wishlistId),
        },
      }}
    >
      {t("reserve")}
    </Link>
  );
}
