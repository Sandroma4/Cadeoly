"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
export function ThemeSwitcher({ initial = "system" }: { initial?: string }) {
  const t = useTranslations("theme");
  const [theme, setTheme] = useState(initial);
  return (
    <div
      className="theme-switcher theme-buttons"
      role="group"
      aria-label={t("label")}
    >
      {(["light", "dark", "system"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          title={t(value)}
          onClick={() => {
            document.documentElement.dataset.theme = value;
            document.cookie = `cadeoly-theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
            setTheme(value);
          }}
        >
          <span aria-hidden="true">
            {value === "light" ? "☀" : value === "dark" ? "☾" : "◐"}
          </span>
          <span>{t(value === "system" ? "auto" : value)}</span>
        </button>
      ))}
    </div>
  );
}
