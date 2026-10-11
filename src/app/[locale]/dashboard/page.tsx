import styles from "./page.module.css";
import { OccasionIcon } from "@/components/ui/OccasionIcon";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { getTranslations, getLocale } from "next-intl/server";
import { getEvents } from "@/app/actions/event";
import { getMyWishlists, getFamilyWishlists } from "@/app/actions/wishlist";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/routing";
import { Reminders } from "@/components/dashboard/Reminders";
import { readReminders } from "@/lib/reminders";
import { Onboarding } from "@/components/dashboard/Onboarding";
import { readOnboarding } from "@/lib/onboarding";
import { Suspense } from "react";
import { EventCountdown } from "@/components/events/EventCountdown";
export default async function DashboardPage() {
  const [
    t,
    w,
    c,
    improvements,
    convenience,
    locale,
    events,
    lists,
    familyLists,
    session,
  ] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("wishlist"),
    getTranslations("common"),
    getTranslations("improvements"),
    getTranslations("convenience"),
    getLocale(),
    getEvents(false, 3),
    getMyWishlists("active", 3),
    getFamilyWishlists(undefined, 5),
    auth(),
  ]);
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true },
      })
    : null;
  const reminders = session?.user?.id
    ? readReminders(prisma, session.user.id)
    : null;
  const onboarding = session?.user?.id
    ? readOnboarding(prisma, session.user.id)
    : null;
  return (
    <div className="stack">
      <header className={styles.greeting}>
        <h1>
          {t("hello", {
            name: user?.name?.trim().split(/\s+/)[0] || c("unknown"),
          })}
        </h1>
        <p>{t("intro")}</p>
      </header>
      {onboarding && (
        <Suspense fallback={null}>
          <Onboarding progress={onboarding} />
        </Suspense>
      )}
      <div className="button-row dashboard-actions">
        <Link className="primary-link" href="/quick-add">
          {convenience("quickAdd")}
        </Link>
        <Link
          className="dashboard-secondary-action"
          href="/dashboard/gift-ideas"
        >
          {convenience("ideas")}
        </Link>
      </div>
      <div className={styles.overview}>
        {reminders && (
          <Suspense
            fallback={
              <section className="reminder-panel" aria-busy="true">
                <h2>{improvements("reminders")}</h2>
                <p role="status">{improvements("loadingReminders")}</p>
              </section>
            }
          >
            <Reminders reminders={reminders} />
          </Suspense>
        )}
      </div>
      <div className={styles.grid}>
        <Card className={`${styles.summaryCard} ${styles.listsCard}`}>
          <CardHeader>
            <CardTitle>{t("myWishlists")}</CardTitle>
          </CardHeader>
          <CardContent className={styles.cardBody}>
            {!lists.length ? (
              <div className={styles.emptyContent}>
                <span className={styles.emptyIcon}>
                  <OccasionIcon kind="gift" />
                </span>
                <p>{w("empty")}</p>
              </div>
            ) : (
              <ul className={styles.entries}>
                {lists.map((list) => (
                  <li key={list.id}>
                    <Link href={"/dashboard/wishlists/" + list.id}>
                      {list.name}
                    </Link>
                    <p>{w("itemsCount", { count: list._count.items })}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              className={`primary-link ${styles.cardAction}`}
              href="/dashboard/wishlists/create"
            >
              <span aria-hidden="true">+</span>
              {t("newWishlist")}
            </Link>
          </CardContent>
        </Card>
        <Card className={styles.summaryCard}>
          <CardHeader>
            <CardTitle>{t("upcomingEvents")}</CardTitle>
          </CardHeader>
          <CardContent className={styles.cardBody}>
            {!events.length ? (
              <div className={styles.emptyContent}>
                <span className={styles.emptyIcon}>
                  <OccasionIcon kind="calendar" />
                </span>
                <p>{t("noEvents")}</p>
              </div>
            ) : (
              <ul className={styles.entries}>
                {events.map((event) => (
                  <li key={event.id}>
                    <Link href={`/dashboard/events/${event.id}`}>
                      {event.name}
                    </Link>
                    <p>
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "long",
                        timeZone: "UTC",
                      }).format(event.date)}{" "}
                      · {event.family.name}
                    </p>
                    <EventCountdown date={event.date} />
                  </li>
                ))}
              </ul>
            )}
            <Link
              className={`secondary-link ${styles.cardAction}`}
              href="/dashboard/events"
            >
              <span aria-hidden="true">+</span>
              {t("createEvent")}
            </Link>
          </CardContent>
        </Card>
        <Card className={styles.summaryCard}>
          <CardHeader>
            <CardTitle>{t("familyActivity")}</CardTitle>
          </CardHeader>
          <CardContent className={styles.cardBody}>
            {!familyLists.length ? (
              <div className={styles.emptyContent}>
                <span className={styles.emptyIcon}>
                  <OccasionIcon kind="people" />
                </span>
                <p>{t("noActivity")}</p>
              </div>
            ) : (
              <ul className={styles.entries}>
                {familyLists.map((list) => (
                  <li key={list.id}>
                    <Link href={"/dashboard/wishlists/" + list.id}>
                      {list.name}
                    </Link>
                    <p>
                      {w("byOwner", { name: list.owner.name || c("unknown") })}{" "}
                      · {w("itemsCount", { count: list._count.items })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              className={`secondary-link ${styles.cardAction}`}
              href="/dashboard/family"
            >
              <span aria-hidden="true">+</span>
              {t("invite")}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
