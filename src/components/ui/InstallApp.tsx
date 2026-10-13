"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function AppRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
  }, []);
  return null;
}

export function InstallApp({ className = "" }: { className?: string }) {
  const t = useTranslations("installApp");
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(true);
  useEffect(() => {
    const media = window.matchMedia(
      "(display-mode: standalone), (display-mode: minimal-ui), (display-mode: fullscreen)",
    );
    const sync = () =>
      setInstalled(
        media.matches ||
          document.documentElement.dataset.native === "android" ||
          document.referrer.startsWith("android-app://") ||
          Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
      );
    const ready = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const complete = () => {
      setInstalled(true);
      setPrompt(null);
    };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", complete);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);
  if (installed) return null;
  return prompt ? (
    <button
      className={`install-app-button ${className}`}
      aria-label={t("button")}
      title={t("button")}
      type="button"
      onClick={async () => {
        const choice = prompt;
        setPrompt(null);
        await choice.prompt();
        if ((await choice.userChoice).outcome === "accepted")
          setInstalled(true);
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
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" />
      </svg>
      <span>{t("button")}</span>
    </button>
  ) : (
    <details className={`install-app-help ${className}`}>
      <summary aria-label={t("button")} title={t("button")}>
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
          <path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" />
        </svg>
        <span>{t("button")}</span>
      </summary>
      <p>{t("help")}</p>
    </details>
  );
}
