"use client";

import LanguageSwitcher from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import styles from "./QuickOptions.module.css";

export function QuickOptions({
  initialTheme = "system",
  compact = true,
  className = "",
  showLanguage = true,
}: {
  initialTheme?: string;
  compact?: boolean;
  className?: string;
  showLanguage?: boolean;
}) {
  return (
    <div
      className={`${styles.dock} ${className}`}
      role="group"
      aria-label={
        showLanguage
          ? "Préférences d'affichage et langue"
          : "Préférences d'affichage"
      }
    >
      {showLanguage && (
        <>
          <div className={styles.segment}>
            <LanguageSwitcher compact={compact} />
          </div>
          <span className={styles.divider} aria-hidden="true" />
        </>
      )}
      <div className={styles.segment}>
        <ThemeSwitcher initial={initialTheme} compact={compact} />
      </div>
    </div>
  );
}
