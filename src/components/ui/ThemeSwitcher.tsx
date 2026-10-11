"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function ThemeSwitcher({
  initial = "system",
  compact = false,
  className = "",
}: {
  initial?: string;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("theme");
  const [theme, setTheme] = useState(initial);
  return (
    <div
      className={`theme-switcher theme-buttons ${compact ? "theme-buttons-compact" : ""} ${className}`}
      role="group"
      aria-label={t("label")}
    >
      {(["light", "dark", "system"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          aria-label={t(value === "system" ? "auto" : value)}
          title={t(value === "system" ? "auto" : value)}
          className={theme === value ? "active" : undefined}
          onClick={() => {
            document.documentElement.dataset.theme = value;
            document.cookie = `cadeoly-theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
            setTheme(value);
          }}
        >
          <span className="theme-icon" aria-hidden="true">
            {value === "light" ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : value === "dark" ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            )}
          </span>
          <span className={compact ? "sr-only" : undefined}>
            {t(value === "system" ? "auto" : value)}
          </span>
        </button>
      ))}
    </div>
  );
}
