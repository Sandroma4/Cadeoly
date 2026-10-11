import { EventDate } from "@/components/events/EventDate";
import { EventCountdown } from "@/components/events/EventCountdown";
import { OccasionIcon } from "@/components/ui/OccasionIcon";
import { getEvent } from "@/app/actions/event";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { EventEditor } from "@/components/events/EventEditor";
import { EventDuplicateForm } from "@/components/events/EventDuplicateForm";
import { Card, CardContent } from "@/components/ui/Card";
export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  const t = await getTranslations("events"),
    w = await getTranslations("wishlist"),
    c = await getTranslations("common");
  const locale = await getLocale();
  const flow = await getTranslations("dailyFlow");
  return (
    <div className="stack">
      <Link href="/dashboard/events">{t("back")}</Link>
      <div className="event-heading">
        <EventDate date={event.date} locale={locale} />
        <h1>{event.name}</h1>
      </div>
      <EventCountdown date={event.date} />
      <p>
        {new Intl.DateTimeFormat(locale, {
          dateStyle: "long",
          timeZone: "UTC",
        }).format(event.date)}{" "}
        · {event.family.name}
      </p>
      {event.description && <p>{event.description}</p>}
      <a href={`/api/events/${encodeURIComponent(id)}/calendar`} download>
        {t("downloadCalendar")}
      </a>
      <EventDuplicateForm event={{ id: event.id, name: event.name }} />
      <h2>{t("wishlists")}</h2>
      <p>{flow("eventListsHelp")}</p>
      <Link
        className="primary-link"
        href={{
          pathname: "/dashboard/wishlists/create",
          query: { eventId: id },
        }}
      >
        {flow("createEventList")}
      </Link>
      {!event.wishlists.length && (
        <div className="empty-state">
          <OccasionIcon />
          <p>{t("noWishlists")}</p>
        </div>
      )}
      <div className="gift-grid">
        {event.wishlists.map((list) => (
          <Card key={list.id}>
            <CardContent>
              <div className="stack">
                <h3>{list.name}</h3>
                <p>{w("byOwner", { name: list.owner.name || c("unknown") })}</p>
                <p>{t("giftCount", { count: list._count.items })}</p>
                <Link href={`/dashboard/wishlists/${list.id}`}>
                  {w("viewList")}
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {event.canManage && (
        <EventEditor
          key={JSON.stringify([event.name, event.date, event.description])}
          event={{
            id: event.id,
            name: event.name,
            description: event.description,
            date: event.date.toISOString().slice(0, 10),
          }}
        />
      )}
    </div>
  );
}
