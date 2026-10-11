"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { reserveAsGuest } from "@/app/actions/guest-reservation";
import { Link } from "@/i18n/routing";
import { triggerConfetti } from "@/components/ui/Confetti";
export function GuestReservation({
  itemId,
  token,
  reserved,
  group,
  managementId,
  wishlistId,
}: {
  itemId: string;
  token?: string;
  reserved: boolean;
  group: boolean;
  managementId?: string;
  wishlistId: string;
}) {
  const t = useTranslations("guestReservation"),
    errors = useTranslations("errors"),
    locale = useLocale(),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function submit(form: FormData) {
    setPending(true);
    setError("");
    try {
      const result = await reserveAsGuest(
        itemId,
        token,
        {
          firstName: form.get("firstName"),
          email: form.get("email"),
          message: form.get("message"),
        },
        locale,
      );
      if ("error" in result) setError(errors(result.error!));
      else {
        triggerConfetti();
        router.push(`/${locale}/guest/reservations/${result.id}`);
      }
    } catch {
      setError(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }
  if (managementId)
    return (
      <Link href={`/guest/reservations/${managementId}`}>{t("manage")}</Link>
    );
  if (group)
    return (
      <p>
        {t("groupAccount")}{" "}
        <Link
          href={{
            pathname: "/login",
            query: {
              next: token
                ? `/${locale}/share/${token}`
                : `/${locale}/lists/${wishlistId}`,
            },
          }}
        >
          {t("login")}
        </Link>
      </p>
    );
  return (
    <div className="stack">
      {!open ? (
        <Button disabled={reserved} onClick={() => setOpen(true)}>
          {t(reserved ? "reserved" : "reserve")}
        </Button>
      ) : (
        <form action={submit} className="stack" aria-busy={pending}>
          <p>{t("noAccount")}</p>
          <Input
            name="firstName"
            label={t("firstName")}
            autoComplete="given-name"
            maxLength={120}
            required
            autoFocus
          />
          <Input
            name="email"
            label={t("email")}
            autoComplete="email"
            type="email"
            maxLength={254}
            required
          />
          <label className="stack">
            {t("message")}
            <textarea name="message" maxLength={1000} rows={3} />
          </label>
          <p className="form-hint">{t("messageHelp")}</p>
          {error && <p role="alert">{error}</p>}
          <Button disabled={pending}>
            {t(pending ? "pending" : "confirm")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            {t("back")}
          </Button>
        </form>
      )}
    </div>
  );
}
