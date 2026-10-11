"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { sendGuestAccessLink } from "@/app/actions/guest-list";
import { PreservedForm } from "@/components/ui/PreservedForm";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function GuestAccessForm({ wishlistId }: { wishlistId: string }) {
  const t = useTranslations("guestStart");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(form: FormData) {
    if (pending) return;
    setPending(true);
    setError("");
    setSent(false);
    try {
      form.set("locale", locale);
      const result = await sendGuestAccessLink(wishlistId, form);
      if (!result.success) setError(result.error);
      else setSent(true);
    } catch {
      setError("unexpected");
    } finally {
      setPending(false);
    }
  }
  return (
    <PreservedForm action={submit} className="stack" aria-busy={pending}>
      <Input
        name="email"
        label={t("emailLabel")}
        type="email"
        autoComplete="email"
        maxLength={254}
        required
      />
      {error && <p role="alert">{errors(error)}</p>}
      {sent && <p role="status">{t("emailSent")}</p>}
      <Button variant="secondary" disabled={pending}>
        {t(pending ? "emailSending" : "sendAccess")}
      </Button>
    </PreservedForm>
  );
}
