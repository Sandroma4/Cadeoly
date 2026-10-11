const DAY = 86_400_000;

export function utcCalendarDay(value: Date | string | number): number {
  const date = new Date(value);
  return Math.floor(date.getTime() / DAY);
}

export function eventCountdownDays(date: Date | string, today: number): number {
  return utcCalendarDay(date) - today;
}

export function millisecondsUntilNextUtcDay(now: number): number {
  return DAY - (now % DAY);
}
