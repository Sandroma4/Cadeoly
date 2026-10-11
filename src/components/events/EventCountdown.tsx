import { utcCalendarDay } from "@/lib/event-countdown";
import { EventCountdownBadge } from "./EventCountdownBadge";

export function EventCountdown({ date }: { date: Date | string }) {
  return (
    <EventCountdownBadge
      date={typeof date === "string" ? date : date.toISOString()}
      initialDay={utcCalendarDay(new Date())}
    />
  );
}
