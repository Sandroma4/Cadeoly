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

export function InstallApp() {
  const t = useTranslations("installApp");
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const sync = () =>
      setInstalled(
        media.matches ||
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
      className="install-app-button"
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
        <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
        <path d="M12 18h.01" />
      </svg>
      <span>{t("button")}</span>
    </button>
  ) : (
    <details className="install-app-help">
      <summary>
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
          <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
          <path d="M12 18h.01" />
        </svg>
        <span>{t("button")}</span>
      </summary>
      <p>{t("help")}</p>
    </details>
  );
}
