"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import {
  setReservationPreparation,
  saveReservationNote,
} from "@/app/actions/reservation-preparation";
import { Button } from "@/components/ui/Button";
import styles from "./ReservationPreparation.module.css";
const statuses = ["RESERVED", "BOUGHT", "WRAPPED", "GIVEN"] as const;

const statusIcons: Record<(typeof statuses)[number], React.ReactNode> = {
  RESERVED: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  BOUGHT: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  WRAPPED: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  ),
  GIVEN: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
    </svg>
  ),
};

export function ReservationPreparation({
  itemId,
  status,
  personalMessage,
}: {
  itemId: string;
  status: string;
  personalMessage?: string | null;
}) {
  const id = useId();
  const t = useTranslations("preparation");
  const guest = useTranslations("guestReservation");
  const [note, setNote] = useState(personalMessage || "");
  const errors = useTranslations("errors");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  async function change(value: string) {
    setPending(true);
    setError("");
    setSaved(false);
    try {
      const result = await setReservationPreparation(itemId, value);
      if (result.error) setError(errors(result.error));
      else {
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError(errors("unexpected"));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className={`stack ${styles.container}`} aria-busy={pending}>
      <span className={styles.stepperLabel}>{t("label")}</span>
      <div className={styles.stepper} role="radiogroup" aria-label={t("label")}>
        {statuses.map((value) => {
          const isActive = status === value;
          return (
            <button
              key={value}
              type="button"
              disabled={pending}
              className={`${styles.stepButton} ${isActive ? styles.stepActive : ""}`}
              onClick={() => change(value)}
              role="radio"
              aria-checked={isActive}
              title={t(value)}
            >
              <span className={styles.stepIcon}>{statusIcons[value]}</span>
              <span className={styles.stepText}>{t(value)}</span>
            </button>
          );
        })}
      </div>
      <div className={styles.selectFallback}>
        <label htmlFor={id}>{t("label")}</label>
        <select
          id={id}
          className={styles.selectInput}
          value={status}
          disabled={pending}
          onChange={(event) => change(event.target.value)}
        >
          {statuses.map((value) => (
            <option value={value} key={value}>
              {t(value)}
            </option>
          ))}
        </select>
      </div>
      <p className="form-hint">{t("private")}</p>
      <details>
        <summary>{guest("message")}</summary>
        <form
          className="stack"
          action={async () => {
            setPending(true);
            setError("");
            setSaved(false);
            try {
              const result = await saveReservationNote(itemId, note);
              if (result.error) setError(errors(result.error));
              else {
                setSaved(true);
                router.refresh();
              }
            } catch {
              setError(errors("unexpected"));
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="stack">
            {guest("message")}
            <textarea
              maxLength={1000}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <p className="form-hint">{guest("messageHelp")}</p>
          <Button disabled={pending} variant="secondary">
            {guest("save")}
          </Button>
        </form>
      </details>
      {saved && (
        <p role="status" className={styles.savedBadge}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {t("saved")}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
