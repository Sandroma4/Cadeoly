"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { changeShareLink } from "@/app/actions/wishlist";
import { Button } from "@/components/ui/Button";
import { ShareLink } from "@/components/ui/ShareLink";
export function WishlistManager({
  id,
  name,
  visibility,
  token,
  guestMode = false,
}: {
  guestMode?: boolean;
  id: string;
  name: string;
  visibility: string;
  token: string | null;
}) {
  const t = useTranslations("wishlist");
  const account = useTranslations("guestAccount");
  const flow = useTranslations("dailyFlow");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const link = token ? "/" + locale + "/share/" + token : "";
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function share(revoke: boolean) {
    if (
      link &&
      !window.confirm(t(revoke ? "confirmRevokeShare" : "confirmRenewShare"))
    )
      return;
    setPending(true);
    setMessage("");
    try {
      const result = await changeShareLink(id, revoke);
      if (result.error) setMessage(errors(result.error));
      router.refresh();
    } catch {
      setMessage(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }
  if (guestMode)
    return (
      <section className="stack gift-preview wishlist-sharing">
        <h2>{flow("sharingTitle")}</h2>
        <p>{account("sharingHelp")}</p>
        <Link
          className="primary-link"
          href={{
            pathname: "/register",
            query: { next: `/${locale}/dashboard/wishlists/${id}` },
          }}
        >
          {account("unlockSharing")}
        </Link>
        <Link
          className="secondary-link"
          href={{
            pathname: "/login",
            query: { next: `/${locale}/dashboard/wishlists/${id}` },
          }}
        >
          {account("signIn")}
        </Link>
      </section>
    );
  return (
    <section
      className="stack gift-preview wishlist-sharing"
      aria-busy={pending}
      aria-label={flow("sharingTitle")}
    >
      <div className="wishlist-sharing-heading">
        <h2>{flow("sharingTitle")}</h2>
        <span className="visual-badge">
          {t("visibility" + visibility[0] + visibility.slice(1).toLowerCase())}
        </span>
      </div>
      {visibility === "FAMILY" && (
        <Link className="primary-link" href="/dashboard/family">
          {flow("inviteFamily")}
        </Link>
      )}
      {visibility === "PRIVATE" && (
        <Button
          variant="secondary"
          onClick={() => {
            if (window.matchMedia("(max-width: 768px)").matches) {
              router.push(
                `/dashboard/wishlists/${id}?manage=1&focus=visibility`,
              );
              return;
            }
            const settings = document.getElementById("list-settings");
            if (!(settings instanceof HTMLDetailsElement)) return;
            const actions = settings.closest("details.wishlist-actions");
            if (actions instanceof HTMLDetailsElement) actions.open = true;
            settings.open = true;
            const field = settings.querySelector<HTMLSelectElement>(
              "select[name='visibility']",
            );
            field?.focus();
            field?.scrollIntoView({ block: "center", behavior: "smooth" });
          }}
        >
          {flow("changeVisibility")}
        </Button>
      )}
      {visibility === "PUBLIC" && (
        <ShareLink href={"/" + locale + "/lists/" + id} title={name} />
      )}
      {visibility === "LINK" && (
        <>
          <p>{t("shareHelp")}</p>
          <div className="button-row">
            <Button
              variant={link ? "secondary" : "primary"}
              disabled={pending}
              onClick={() => share(false)}
            >
              {t(link ? "renewShare" : "createShare")}
            </Button>
            {link && (
              <Button
                disabled={pending}
                variant="secondary"
                onClick={() => share(true)}
              >
                {t("revoke")}
              </Button>
            )}
          </div>
          {link && <ShareLink key={link} href={link} title={name} />}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
