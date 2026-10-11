"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { completeTutorial } from "@/app/actions/tutorial";
import { Button } from "@/components/ui/Button";
import { OccasionIcon } from "@/components/ui/OccasionIcon";
import styles from "./Tutorial.module.css";

const Replay = createContext<(() => void) | null>(null);
const steps = ["welcome", "list", "share", "reserve"] as const;
const icons = ["gift", "list", "people", "giving"] as const;

export function Tutorial({
  completed,
  guestMode = false,
  children,
}: {
  completed: boolean;
  guestMode?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("tutorial");
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!completed && !dialog.current?.open) {
      dialog.current?.showModal();
      heading.current?.focus();
    }
  }, [completed]);
  useEffect(() => {
    if (dialog.current?.open) heading.current?.focus();
  }, [step]);

  function replay() {
    setStep(0);
    setError(false);
    dialog.current?.showModal();
    heading.current?.focus();
  }

  async function finish(createList = false) {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      const result = guestMode ? { success: true } : await completeTutorial();
      if ("error" in result && result.error) {
        setError(true);
        return;
      }
      dialog.current?.close();
      if (createList) router.push("/dashboard/wishlists/create");
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <Replay.Provider value={replay}>
      {children}
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="tutorial-title"
        aria-describedby="tutorial-description"
        aria-busy={pending}
        onCancel={(event) => {
          event.preventDefault();
          void finish();
        }}
      >
        <div className={styles.headerProgress} role="presentation">
          <div
            className={styles.headerProgressFill}
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className={styles.sheetHandle} aria-hidden="true" />

        <div className={styles.topline}>
          <p className={styles.progress} aria-live="polite">
            {t("progress", { current: step + 1, total: steps.length })}
          </p>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            className={styles.skipButton}
            onClick={() => void finish()}
          >
            {t("skip")}
          </Button>
        </div>

        <div className={styles.cardContent}>
          <div className={styles.illustrationWrapper} data-step={step}>
            <div className={styles.halo} aria-hidden="true" />
            <div key={step} className={styles.illustration}>
              <OccasionIcon kind={icons[step]} />
            </div>
          </div>

          <h2
            id="tutorial-title"
            ref={heading}
            tabIndex={-1}
            className={styles.title}
          >
            {t(`${steps[step]}Title`)}
          </h2>

          <p id="tutorial-description" className={styles.description}>
            {t(`${steps[step]}Description`)}
          </p>

          <div className={styles.dots} aria-hidden="true">
            {steps.map((key, index) => (
              <span key={key} data-active={index === step} />
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className={styles.errorText}>
            {t("saveError")}
          </p>
        )}

        <div className={styles.actions}>
          {step > 0 && (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              className={styles.backButton}
              onClick={() => setStep(step - 1)}
            >
              {t("back")}
            </Button>
          )}
          <Button
            type="button"
            fullWidth
            disabled={pending}
            className={styles.nextButton}
            onClick={() =>
              step === steps.length - 1 ? void finish(true) : setStep(step + 1)
            }
          >
            {t(
              pending
                ? "saving"
                : step === 0
                  ? "discover"
                  : step === steps.length - 1
                    ? "createList"
                    : "next",
            )}
          </Button>
        </div>

        {step === steps.length - 1 && (
          <Button
            type="button"
            variant="ghost"
            fullWidth
            disabled={pending}
            className={styles.exploreButton}
            onClick={() => void finish()}
          >
            {t("explore")}
          </Button>
        )}
      </dialog>
    </Replay.Provider>
  );
}

export function TutorialReplay() {
  const replay = useContext(Replay);
  const t = useTranslations("tutorial");
  return (
    <button
      type="button"
      className={styles.replay}
      onClick={(event) => {
        const menu = event.currentTarget.closest("details");
        if (menu) menu.open = false;
        replay?.();
      }}
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polygon points="10 8 16 12 10 16 10 8" />
      </svg>
      <span>{t("replay")}</span>
    </button>
  );
}
