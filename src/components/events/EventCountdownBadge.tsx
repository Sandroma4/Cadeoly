"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  eventCountdownDays,
  millisecondsUntilNextUtcDay,
  utcCalendarDay,
} from "@/lib/event-countdown";
import styles from "./EventCountdown.module.css";

function currentDay() {
  return utcCalendarDay(Date.now());
}

function subscribe(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  function refresh() {
    clearTimeout(timer);
    onChange();
    timer = setTimeout(refresh, millisecondsUntilNextUtcDay(Date.now()) + 10);
  }
  timer = setTimeout(refresh, millisecondsUntilNextUtcDay(Date.now()) + 10);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("focus", refresh);
  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("focus", refresh);
  };
}

export function EventCountdownBadge({
  date,
  initialDay,
}: {
  date: string;
  initialDay: number;
}) {
  const t = useTranslations("eventCountdown");
  const today = useSyncExternalStore(subscribe, currentDay, () => initialDay);
  const days = eventCountdownDays(date, today);
  if (!Number.isFinite(days)) return null;
  return (
    <span className={styles.badge} data-today={days === 0 || undefined}>
      {days === 0
        ? t("today")
        : days > 0
          ? t("future", { count: days })
          : t("past", { count: Math.abs(days) })}
    </span>
  );
}
