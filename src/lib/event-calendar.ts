type CalendarEvent = {
  id: string;
  name: string;
  description: string | null;
  date: Date;
};

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldLine(value: string) {
  const lines: string[] = [];
  let line = "";
  let bytes = 0;
  for (const character of value) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > 75) {
      lines.push(line);
      line = " ";
      bytes = 1;
    }
    line += character;
    bytes += size;
  }
  lines.push(line);
  return lines.join("\r\n");
}

export function eventCalendar(event: CalendarEvent, now = new Date()) {
  const end = new Date(event.date);
  end.setUTCDate(end.getUTCDate() + 1);
  const date = (value: Date) =>
    value.toISOString().slice(0, 10).replace(/-/g, "");
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Cadeoly//Events//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${encodeURIComponent(event.id)}@cadeoly`,
      `DTSTAMP:${now
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z")}`,
      `DTSTART;VALUE=DATE:${date(event.date)}`,
      // Calendar all-day end dates are exclusive.
      `DTEND;VALUE=DATE:${date(end)}`,
      `SUMMARY:${escapeText(event.name)}`,
      ...(event.description
        ? [`DESCRIPTION:${escapeText(event.description)}`]
        : []),
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(foldLine)
      .join("\r\n") + "\r\n"
  );
}
