"use client";
import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { manageGuestReservation } from "@/app/actions/guest-reservation";
import { triggerConfetti } from "@/components/ui/Confetti";
export function GuestReservationManager({
  id,
  title,
  message,
  sent,
  loggedIn,
  given,
  guestName,
}: {
  id: string;
  title: string;
  message: string;
  sent: boolean;
  loggedIn: boolean;
  given: boolean;
  guestName?: string;
}) {
  const t = useTranslations("guestReservation"),
    errors = useTranslations("errors"),
    locale = useLocale(),
    router = useRouter();
  const [note, setNote] = useState(message),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [cancel, setCancel] = useState(false),
    [done, setDone] = useState(false);

  useEffect(() => {
    triggerConfetti();
  }, []);

  async function act(
    operation: "save" | "cancel" | "given" | "claim" | "resend",
  ) {
    setPending(true);
    setError("");
    try {
      const result = await manageGuestReservation(id, operation, note, locale);
      if (result.error) setError(errors(result.error));
      else if (operation === "claim") {
        router.push(`/${locale}/dashboard/reservations`);
        router.refresh();
      } else if (operation === "cancel") {
        setDone(true);
        setStatus(t("cancelled"));
      } else {
        if (operation === "given") triggerConfetti();
        setStatus(
          t(
            operation === "resend"
              ? "emailSent"
              : operation === "given"
                ? "givenDone"
                : "saved",
          ),
        );
        router.refresh();
      }
    } catch {
      setError(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }
  const next = `/${locale}/guest/reservations/${id}`;
  return (
    <div className="stack" aria-busy={pending}>
      <h1>{t(done ? "cancelled" : "success")}</h1>
      <h2>{title}</h2>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
      {!done && (
        <>
          <p>{t(sent ? "recap" : "recapFailed")}</p>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => act("resend")}
          >
            {t("resend")}
          </Button>
          <section className="guest-retention-card stack">
            <span className="visual-badge">{t("retentionBadge")}</span>
            <h2>
              {guestName
                ? t("keepTitlePersonalized", { name: guestName })
                : t("keepTitle")}
            </h2>
            <p className="retention-desc">{t("keepHelp")}</p>
            {loggedIn ? (
              <Button disabled={pending} onClick={() => act("claim")}>
                {t("attach")}
              </Button>
            ) : (
              <div className="button-row" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
                <Link
                  className="primary-link"
                  href={{ pathname: "/register", query: { next } }}
                >
                  {t("signup")}
                </Link>
                <Link
                  href={{ pathname: "/login", query: { next } }}
                  className="secondary-link"
                >
                  {t("login")}
                </Link>
              </div>
            )}
            <a
              href="#reservation-controls"
              className="tertiary-link"
              style={{
                fontSize: "0.875rem",
                color: "var(--muted-foreground)",
                textDecoration: "underline",
                marginTop: "0.25rem",
              }}
            >
              {t("continue")}
            </a>
          </section>
          <section id="reservation-controls" className="stack">
            <label className="stack">
              {t("message")}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                rows={4}
              />
            </label>
            <p className="form-hint">{t("messageHelp")}</p>
            <Button
              disabled={pending}
              variant="secondary"
              onClick={() => act("save")}
            >
              {t("save")}
            </Button>
            {!given && (
              <Button
                disabled={pending}
                variant="secondary"
                onClick={() => act("given")}
              >
                {t("given")}
              </Button>
            )}
            {cancel ? (
              <div className="stack">
                <p>{t("cancelHelp")}</p>
                <Button
                  disabled={pending}
                  variant="danger"
                  onClick={() => act("cancel")}
                >
                  {t("cancelConfirm")}
                </Button>
                <Button
                  disabled={pending}
                  variant="ghost"
                  onClick={() => setCancel(false)}
                >
                  {t("back")}
                </Button>
              </div>
            ) : (
              <Button
                disabled={pending}
                variant="ghost"
                onClick={() => setCancel(true)}
              >
                {t("cancel")}
              </Button>
            )}
          </section>
        </>
      )}
      <Link href="/">{t("home")}</Link>
    </div>
  );
}
