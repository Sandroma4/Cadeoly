"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./Onboarding.module.css";

export function OnboardingDisclosure({
  userId,
  label,
  hideLabel,
  children,
}: {
  userId: string;
  label: string;
  hideLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const key = `cadeoly:first-steps-hidden:${userId}`;
  useEffect(() => {
    try {
      if (ref.current)
        ref.current.hidden = localStorage.getItem(key) === "true";
    } catch {
      /* Storage may be unavailable. */
    }
  }, [key]);
  return (
    <details ref={ref} className={styles.disclosure}>
      <summary>{label}</summary>
      <div className={styles.nextAction}>
        {children}
        <button
          type="button"
          onClick={() => {
            if (ref.current) ref.current.hidden = true;
            try {
              localStorage.setItem(key, "true");
            } catch {
              /* Hide for this visit. */
            }
          }}
        >
          {hideLabel}
        </button>
      </div>
    </details>
  );
}
