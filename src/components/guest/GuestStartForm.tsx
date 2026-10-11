"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { startGuestWishlist } from "@/app/actions/guest-list";
import { PreservedForm } from "@/components/ui/PreservedForm";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function GuestStartForm() {
  const t = useTranslations("guestStart");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(form: FormData) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await startGuestWishlist(form);
      if (!result.success) setError(result.error);
      else {
        router.push(`/guest/lists/${result.wishlistId}?welcome=1`);
        router.refresh();
      }
    } catch {
      setError("unexpected");
    } finally {
      setPending(false);
    }
  }
  return (
    <PreservedForm action={submit} className="stack" aria-busy={pending}>
      <Input
        name="idea"
        label={t("ideaLabel")}
        placeholder={t("ideaPlaceholder")}
        maxLength={2048}
        required
        aria-describedby="guest-start-help"
      />
      <p id="guest-start-help" className="form-hint">
        {t("ideaHelp")}
      </p>
      {error && <p role="alert">{errors(error)}</p>}
      <Button disabled={pending} fullWidth>
        {t(pending ? "starting" : "addFirst")} <span aria-hidden="true">→</span>
      </Button>
    </PreservedForm>
  );
}
