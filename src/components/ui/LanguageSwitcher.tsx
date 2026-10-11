"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { useTransition } from "react";
import styles from "./LanguageSwitcher.module.css";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(nextLocale: "fr" | "en") {
    if (locale === nextLocale) return;

    startTransition(() => {
      router.replace(pathname + window.location.search + window.location.hash, {
        locale: nextLocale,
      });
    });
  }

  return (
    <div
      className={`${styles.toggleContainer} ${isPending ? styles.pending : ""}`}
    >
      <button
        type="button"
        className={`${styles.toggleBtn} ${locale === "fr" ? styles.active : ""}`}
        onClick={() => switchLocale("fr")}
        disabled={isPending}
        aria-label="Français"
        title="Français"
        aria-pressed={locale === "fr"}
      >
        <svg
          aria-hidden="true"
          width="24"
          height="16"
          viewBox="0 0 60 40"
          className={styles.flag}
        >
          <path fill="#002395" d="M0 0h20v40H0z" />
          <path fill="#fff" d="M20 0h20v40H20z" />
          <path fill="#ed2939" d="M40 0h20v40H40z" />
        </svg>
      </button>
      <button
        type="button"
        className={`${styles.toggleBtn} ${locale === "en" ? styles.active : ""}`}
        onClick={() => switchLocale("en")}
        disabled={isPending}
        aria-label="English"
        title="English"
        aria-pressed={locale === "en"}
      >
        <svg
          aria-hidden="true"
          width="24"
          height="16"
          viewBox="0 0 60 40"
          className={styles.flag}
        >
          <path fill="#012169" d="M0 0h60v40H0z" />
          <path stroke="#fff" strokeWidth="8" d="m0 0 60 40M60 0 0 40" />
          <path stroke="#c8102e" strokeWidth="3" d="m0 0 60 40M60 0 0 40" />
          <path stroke="#fff" strokeWidth="12" d="M30 0v40M0 20h60" />
          <path stroke="#c8102e" strokeWidth="7" d="M30 0v40M0 20h60" />
        </svg>
      </button>
    </div>
  );
}
