"use client";

import LanguageSwitcher from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import styles from "./QuickOptions.module.css";

export function QuickOptions({
  initialTheme = "system",
  compact = true,
  className = "",
}: {
  initialTheme?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`${styles.dock} ${className}`}
      role="group"
      aria-label="Préférences"
    >
      <LanguageSwitcher compact={compact} />
      <span className={styles.divider} aria-hidden="true" />
      <ThemeSwitcher initial={initialTheme} compact={compact} />
    </div>
  );
}
