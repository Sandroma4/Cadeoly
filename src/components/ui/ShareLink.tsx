"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { socialShareUrl, type SocialChannel } from "@/lib/social-sharing";
import { notify } from "./Toast";
export function ShareLink({
  href,
  title,
  help,
  compact = false,
}: {
  href: string;
  title: string;
  help?: string;
  compact?: boolean;
}) {
  const t = useTranslations("sharing");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [qr, setQr] = useState<{ href: string; image: string } | null>(null);
  const [pending, setPending] = useState(false);
  function shareTo(channel: SocialChannel) {
    const url = new URL(href, window.location.origin).toString();
    const link = document.createElement("a");
    link.href = socialShareUrl(
      channel,
      title,
      t("message", { title, url }),
      /iPad|iPhone|iPod/.test(navigator.userAgent),
    );
    link.rel = "noopener noreferrer";
    link.referrerPolicy = "no-referrer";
    if (channel === "whatsapp") link.target = "_blank";
    link.click();
  }
  async function perform(kind: "copy" | "share" | "qr") {
    setPending(true);
    setMessage("");
    setFailed(false);
    try {
      const url = new URL(href, window.location.origin).toString();
      if (kind === "qr") {
        const QRCode = await import("qrcode");
        setQr({
          href,
          image: await QRCode.toDataURL(url, {
            width: 256,
            margin: 4,
            errorCorrectionLevel: "M",
          }),
        });
      } else if (kind === "share" && navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setMessage(t("copied"));
        notify(t("copied"));
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setFailed(true);
        setMessage(t("manualCopy"));
      }
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="stack" aria-label={t("title")} aria-busy={pending}>
      {help && <p>{help}</p>}
      <a className="break-word" href={href}>
        {t("open")}
      </a>
      <div className="button-row">
        <Button
          type="button"
          disabled={pending}
          onClick={() => perform("copy")}
        >
          {t("copy")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => perform("share")}
        >
          {t("share")}
        </Button>
        {!compact && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => perform("qr")}
          >
            {t("qr")}
          </Button>
        )}
      </div>
      {!compact && (
        <div className="button-row" role="group" aria-label={t("sendVia")}>
          {(["whatsapp", "sms", "email"] as const).map((channel) => (
            <Button
              key={channel}
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => shareTo(channel)}
            >
              {t(channel)}
            </Button>
          ))}
        </div>
      )}
      {failed && (
        <input
          aria-label={t("link")}
          readOnly
          value={
            typeof window === "undefined"
              ? href
              : new URL(href, window.location.origin).toString()
          }
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
      {qr?.href === href && (
        <figure className="share-qr">
          {/* Local data URL: private links must not reach an image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.image} width={256} height={256} alt={t("qrAlt")} />
          <figcaption>{t("scan")}</figcaption>
        </figure>
      )}
      <p role={failed ? "alert" : "status"} aria-live="polite">
        {message || (pending ? t("pending") : "")}
      </p>
    </section>
  );
}
