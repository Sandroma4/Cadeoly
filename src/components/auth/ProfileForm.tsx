"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { updateProfile, updateProfilePreferences } from "@/app/actions/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EMAIL_REMINDER_DAYS } from "@/lib/email-reminder-settings";
import styles from "@/app/[locale]/dashboard/profile/page.module.css";
export function ProfileForm({
  name,
  email,
  locale,
  emailRemindersEnabled,
  emailReminderDays,
  section,
}: {
  name: string;
  email: string;
  locale: string;
  emailRemindersEnabled: boolean;
  emailReminderDays: number;
  section?: "identity" | "preferences";
}) {
  const t = useTranslations("auth"),
    c = useTranslations("common"),
    errors = useTranslations("errors"),
    reminders = useTranslations("emailReminders"),
    settings = useTranslations("profileSettings");
  const router = useRouter(),
    search = useSearchParams();
  const [pending, setPending] = useState(false),
    [preferredLocale, setPreferredLocale] = useState(locale),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [enabled, setEnabled] = useState(emailRemindersEnabled),
    [days, setDays] = useState(emailReminderDays);
  async function submit(form: FormData, preferences: boolean) {
    if (pending) return;
    setPending(true);
    setMessage("");
    setFailed(false);
    try {
      const result = await (preferences
        ? updateProfilePreferences(form)
        : updateProfile(form));
      if (result.error) {
        setFailed(true);
        setMessage(errors(result.error));
      } else {
        setMessage(settings("saved"));
        const query = search.toString();
        router.replace(`/dashboard/profile${query ? `?${query}` : ""}`, {
          locale: form.get("locale") === "en" ? "en" : "fr",
          scroll: false,
        });
        router.refresh();
      }
    } catch {
      setFailed(true);
      setMessage(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="stack">
      {section !== "preferences" && (
        <section
          className={styles.card}
          aria-labelledby="profile-details-heading"
        >
          <h2 id="profile-details-heading">{settings("details")}</h2>
          <form
            action={(form) => submit(form, false)}
            className="stack"
            aria-busy={pending}
          >
            <input type="hidden" name="locale" value={locale} />
            <input
              type="hidden"
              name="emailReminderDays"
              value={emailReminderDays}
            />
            {emailRemindersEnabled && (
              <input type="hidden" name="emailRemindersEnabled" value="on" />
            )}
            <Input
              id="profile-name"
              name="name"
              label={t("fullName")}
              defaultValue={name}
              maxLength={120}
              required
              disabled={pending}
            />
            <Input
              id="profile-email"
              label={t("email")}
              value={email}
              readOnly
            />
            <Button disabled={pending}>
              {pending ? c("saving") : settings("saveDetails")}
            </Button>
          </form>
        </section>
      )}
      {section !== "identity" && (
        <section
          id="profile-preferences"
          className={styles.card}
          aria-labelledby="preferences-heading"
        >
          <h2 id="preferences-heading">{settings("preferences")}</h2>
          <form
            action={(form) => submit(form, true)}
            className="stack"
            aria-busy={pending}
            onChange={(event) => event.currentTarget.requestSubmit()}
          >
            <label htmlFor="profile-locale">{t("preferredLanguage")}</label>
            <select
              id="profile-locale"
              name="locale"
              value={preferredLocale}
              onChange={(event) => setPreferredLocale(event.target.value)}
              disabled={pending}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
            <label className={styles.switchRow}>
              <span>{reminders("title")}</span>
              <input
                className={styles.switch}
                type="checkbox"
                role="switch"
                name="emailRemindersEnabled"
                checked={enabled}
                disabled={pending}
                onChange={(event) => setEnabled(event.target.checked)}
              />
            </label>
            <p className={styles.hint}>{settings("remindersHelp")}</p>
            <label htmlFor="email-reminder-days">{reminders("leadTime")}</label>
            {!enabled && (
              <input type="hidden" name="emailReminderDays" value={days} />
            )}
            <select
              id="email-reminder-days"
              name="emailReminderDays"
              value={days}
              disabled={!enabled || pending}
              onChange={(event) => setDays(Number(event.target.value))}
            >
              {EMAIL_REMINDER_DAYS.map((day) => (
                <option key={day} value={day}>
                  {reminders("days", { days: day })}
                </option>
              ))}
            </select>
            {failed && (
              <Button type="submit" variant="secondary" disabled={pending}>
                {settings("savePreferences")}
              </Button>
            )}
          </form>
        </section>
      )}
      {(pending || message) && (
        <p role={failed ? "alert" : "status"}>
          {pending ? c("saving") : message}
        </p>
      )}
    </div>
  );
}
