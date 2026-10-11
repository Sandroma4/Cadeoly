import { FamilyActions } from "@/components/family/FamilyActions";
import { EventDate } from "@/components/events/EventDate";
import { EventCountdown } from "@/components/events/EventCountdown";
import { OccasionIcon } from "@/components/ui/OccasionIcon";
import styles from "./page.module.css";
import { Link } from "@/i18n/routing";
import { getEvents, getEventFamilies } from "@/app/actions/event";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { CreateEventForm } from "@/components/events/CreateEventForm";
import { getTranslations, getLocale } from "next-intl/server";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const past = (await searchParams).period === "past";
  const [events, families, t, locale, flow] = await Promise.all([
    getEvents(past),
    getEventFamilies(),
    getTranslations("events"),
    getLocale(),
    getTranslations("dailyFlow"),
  ]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("title")}</h1>
          <p className="page-intro">{t("visualIntro")}</p>
        </div>
      </header>
      <nav className="button-row segmented-filters" aria-label={t("period")}>
        <Link
          href="/dashboard/events"
          aria-current={!past ? "page" : undefined}
        >
          {t("upcoming")}
        </Link>
        <Link
          href="/dashboard/events?period=past"
          aria-current={past ? "page" : undefined}
        >
          {t("past")}
        </Link>
      </nav>

      <div className={styles.grid}>
        <div className={styles.mainContent}>
          {events.length === 0 ? (
            <Card className={styles.emptyCard}>
              <CardContent className={styles.emptyContent}>
                <div className="empty-art">
                  <OccasionIcon kind="calendar" />
                </div>
                <p>{t("empty")}</p>
                <p>
                  {flow(
                    past
                      ? "noPastEvents"
                      : families.length
                        ? "emptyEvents"
                        : "familyFirst",
                  )}
                </p>
                {!past && !families.length && <FamilyActions join />}
              </CardContent>
            </Card>
          ) : (
            events.map((event) => (
              <Card key={event.id} className={styles.eventCard}>
                <CardHeader>
                  <div className="event-heading">
                    <EventDate date={event.date} locale={locale} />
                    <div className="stack">
                      <CardTitle>{event.name}</CardTitle>
                      <EventCountdown date={event.date} />
                      <span className="visual-badge">{event.family.name}</span>
                    </div>
                  </div>
                  <CardDescription>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "long",
                      timeZone: "UTC",
                    }).format(event.date)}{" "}
                    • {event.family.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/dashboard/events/${event.id}`}>
                    {t("view")}
                  </Link>
                  {event.description && (
                    <p className={styles.description}>{event.description}</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className={styles.sideContent}>
          {families.length > 0 && (
            <details className="form-options creation-panel">
              <summary className="creation-trigger">{t("createEvent")}</summary>
              <CreateEventForm families={families} showTitle={false} />
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
