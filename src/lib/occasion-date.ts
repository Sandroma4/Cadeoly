/** Next occurrence, including today, in the user's local calendar. */
export function nextOccasionDate(kind: string, today = new Date()): string {
  if (!["Christmas", "SaintNicholas", "Easter"].includes(kind)) return "";
  const dateInYear = (year: number) => {
    if (kind === "Christmas") return `${year}-12-25`;
    if (kind === "SaintNicholas") return `${year}-12-06`;
    // Gregorian Easter (Meeus/Jones/Butcher computus).
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  const year = today.getFullYear();
  const current = `${year}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const date = dateInYear(year);
  return date >= current ? date : dateInYear(year + 1);
}
