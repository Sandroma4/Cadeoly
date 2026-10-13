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
  const [t, w, c, convenience, locale, events, lists, familyLists, session] =
    await Promise.all([
      getTranslations("dashboard"),
      getTranslations("wishlist"),
      getTranslations("common"),
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
    <div className={`stack ${styles.home}`}>
      <header className={styles.greeting}>
        <h1>
          {t("hello", {
            name:
              user?.name?.trim().split(/\s+/)[0] ||
              (await getTranslations("guestAccount"))("guestName"),
          })}
        </h1>
        <p>{t("intro")}</p>
      </header>
      <div className={styles.primary}>
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
                    {list._count.items === 0 ? (
                      <Link
                        className={styles.addWish}
                        href={`/dashboard/wishlists/${list.id}`}
                      >
                        {w("addItem")}
                      </Link>
                    ) : (
                      <p>{w("itemsCount", { count: list._count.items })}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {lists.length === 3 && (
              <Link href="/dashboard/wishlists">{t("viewAllLists")}</Link>
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
      </div>
      {onboarding && (
        <Suspense fallback={null}>
          <Onboarding progress={onboarding} userId={session!.user!.id!} />
        </Suspense>
      )}
      <div className={`button-row dashboard-actions ${styles.quickActions}`}>
        <Link
          className="primary-link"
          href={
            session?.user?.id ? "/quick-add" : "/dashboard/wishlists/create"
          }
        >
          {convenience("quickAdd")}
        </Link>
        <Link
          className="dashboard-secondary-action"
          href="/dashboard/gift-ideas"
        >
          {convenience("ideas")}
        </Link>
      </div>
      {reminders && (
        <Suspense fallback={null}>
          <Reminders reminders={reminders} />
        </Suspense>
      )}
      <div className={styles.supporting}>
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
            <Link className={styles.supportAction} href="/dashboard/events">
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
            <Link className={styles.supportAction} href="/dashboard/family">
              <span aria-hidden="true">+</span>
              {t("invite")}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
