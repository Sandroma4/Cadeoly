"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { changePassword } from "@/app/actions/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import styles from "@/app/[locale]/dashboard/profile/page.module.css";
import type { ComponentProps } from "react";

function PasswordField(props: ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  const t = useTranslations("profileSettings");
  return (
    <div className={styles.passwordField}>
      <Input {...props} type={visible ? "text" : "password"} />
      <Button
        type="button"
        variant="ghost"
        aria-label={t(visible ? "hidePassword" : "showPassword")}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        <svg
          aria-hidden="true"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="m3 3 18 18" />}
        </svg>
      </Button>
    </div>
  );
}
export function ChangePasswordForm() {
  const t = useTranslations("accountSecurity"),
    a = useTranslations("auth"),
    errors = useTranslations("errors"),
    locale = useLocale();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function submit(form: FormData) {
    setPending(true);
    setError("");
    try {
      const result = await changePassword(form);
      if (result.error) setError(errors(result.error));
      else await signOut({ callbackUrl: `/${locale}/login?passwordChanged=1` });
    } catch {
      setError(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }
  return (
    <form action={submit} className="stack">
      <h3>{t("title")}</h3>
      <p>{t("hint")}</p>
      <PasswordField
        id="current-password"
        name="currentPassword"
        type="password"
        label={t("currentPassword")}
        autoComplete="current-password"
        maxLength={128}
        required
      />
      <PasswordField
        id="change-new-password"
        name="password"
        type="password"
        label={t("newPassword")}
        autoComplete="new-password"
        minLength={12}
        maxLength={72}
        required
      />
      <p>{a("passwordHint")}</p>
      <PasswordField
        id="change-confirmation"
        name="confirmation"
        type="password"
        label={t("confirmation")}
        autoComplete="new-password"
        minLength={12}
        maxLength={72}
        required
      />
      {error && <p role="alert">{error}</p>}
      <Button disabled={pending}>{t(pending ? "saving" : "save")}</Button>
    </form>
  );
}
