import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { readReminders } from "@/lib/reminders";
export async function Reminders({
  reminders,
}: {
  reminders:
    | Awaited<ReturnType<typeof readReminders>>
    | ReturnType<typeof readReminders>;
}) {
  reminders = await reminders;
  const [t, locale] = await Promise.all([
    getTranslations("improvements"),
    getLocale(),
  ]);
  const date = (value: Date) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(value);
  const empty =
    !reminders.events.length &&
    !reminders.gifts.length &&
    !reminders.lists.length;
  if (empty) return null;
  return (
    <section
      className="stack reminder-panel"
      aria-labelledby="reminders-heading"
    >
      <h2 id="reminders-heading">{t("reminders")}</h2>
      <p className="reminder-help">{t("reminderHelp")}</p>
      <ul className="reminder-list">
        {reminders.lists.map((list) => (
          <li key={list.id}>
            <Link href={`/dashboard/wishlists/${list.id}`}>{list.name}</Link>
            <span>
              {t(list._count.items ? "reviewWishes" : "completeList")}
              {list.neededBy
                ? ` · ${date(new Date(list.neededBy + "T12:00:00Z"))}`
                : ""}
            </span>
          </li>
        ))}
        {reminders.events.map((event) => (
          <li key={event.id}>
            <Link href={`/dashboard/events/${event.id}`}>{event.name}</Link>
            <time dateTime={event.date.toISOString()}>{date(event.date)}</time>
          </li>
        ))}
        {reminders.gifts.map((gift) => (
          <li key={gift.id}>
            <Link href={gift.href}>{gift.title}</Link>
            <span>
              {t(
                gift.kind === "contribution"
                  ? "contributedGift"
                  : "reservedGift",
                { name: gift.recipient },
              )}{" "}
              · {gift.due ? date(gift.due) : t("noDate")}
            </span>
          </li>
        ))}
      </ul>
      <Link className="secondary-link" href="/dashboard/reservations">
        {t("myReservations")} <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
