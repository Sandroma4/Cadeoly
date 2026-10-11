"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./Toast.module.css";

const eventName = "cadeoly:notification";

export function notify(message: string) {
  window.dispatchEvent(new CustomEvent(eventName, { detail: message }));
}

export function Toast() {
  const t = useTranslations("notifications");
  const [notice, setNotice] = useState<{
    message: string;
    version: number;
  } | null>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    function receive(event: Event) {
      const message = (event as CustomEvent<string>).detail;
      if (typeof message !== "string" || !message.trim()) return;
      setNotice((previous) => ({
        message,
        version: (previous?.version || 0) + 1,
      }));
    }
    window.addEventListener(eventName, receive);
    return () => window.removeEventListener(eventName, receive);
  }, []);
  useEffect(() => {
    if (!notice || paused) return;
    const timer = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [notice, paused]);
  return (
    <div
      className={styles.region}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {notice && (
        <div
          className={styles.notice}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <span className={styles.check} aria-hidden="true">
            ✓
          </span>
          <span key={notice.version}>{notice.message}</span>
          <button
            type="button"
            aria-label={t("dismiss")}
            onClick={() => {
              setNotice(null);
              setPaused(false);
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
