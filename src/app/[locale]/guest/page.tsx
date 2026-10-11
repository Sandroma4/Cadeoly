import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { Link } from "@/i18n/routing";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { OccasionIcon } from "@/components/ui/OccasionIcon";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import styles from "./page.module.css";
import { auth } from "@/auth";
import { GuestInteractiveDemo } from "@/components/guest/GuestInteractiveDemo";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

export default async function GuestPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const requested = (await searchParams).section;
  const section =
    requested === "family" || requested === "events" ? requested : "lists";
  const [t, home, authText, locale, session, preferences] = await Promise.all([
    getTranslations("guest"),
    getTranslations("home"),
    getTranslations("auth"),
    getLocale(),
    auth(),
    cookies(),
  ]);
  const choice =
    preferences.get("cadeoly-theme")?.value ??
    preferences.get("wishi-theme")?.value;
  const theme = choice === "light" || choice === "dark" ? choice : "system";
  return (
    <main className={styles.container}>
      <header className={styles.topbar}>
        <Link href="/" aria-label={t("home")}>
          <BrandLogo />
        </Link>
        <div className={styles.topbarControls}>
          <LanguageSwitcher />
          <ThemeSwitcher initial={theme} />
          <Link
            href={
              session?.user?.id
                ? "/dashboard"
                : { pathname: "/login", query: { next: `/${locale}/guest` } }
            }
            className="secondary-link"
          >
            {session?.user?.id ? t("myAccount") : authText("signIn")}
          </Link>
        </div>
      </header>
      <div className={styles.intro}>
        <span className="visual-badge">{t("badge")}</span>
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
      </div>
      <nav
        className={`button-row segmented-filters ${styles.tabs}`}
        aria-label={t("navigation")}
      >
        {(["lists", "family", "events"] as const).map((key) => (
          <Link
            key={key}
            href={{ pathname: "/guest", query: { section: key } }}
            aria-current={section === key ? "page" : undefined}
          >
            {t(key)}
          </Link>
        ))}
      </nav>
      <section className="stack" aria-labelledby="guest-section-title">
        <h2 id="guest-section-title">{t(`${section}Title`)}</h2>
        <p className={styles.help}>{t(`${section}Help`)}</p>
        {section === "lists" ? (
          <GuestInteractiveDemo locale={locale} />
        ) : section === "family" ? (
          <Card>
            <CardHeader>
              <div className={styles.icon}>
                <OccasionIcon kind="people" />
              </div>
              <CardTitle>{t("familyExample")}</CardTitle>
              <CardDescription>{t("familyExampleHelp")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className={styles.members}>
                {["Camille", "Alex", "Lou"].map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className={styles.icon}>
                <OccasionIcon kind="calendar" />
              </div>
              <CardTitle>{t("eventExample")}</CardTitle>
              <CardDescription>{t("eventExampleHelp")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p>{home("exampleTitle")}</p>
            </CardContent>
          </Card>
        )}
      </section>
      <aside className={styles.signup}>
        <span className="visual-badge" style={{ fontSize: "0.8rem" }}>
          {t("badgeTrust")}
        </span>
        <h2>{t("ready")}</h2>
        <p>{t("accountHelp")}</p>
        <Link
          href={{
            pathname: "/register",
            query: { next: `/${locale}/dashboard/wishlists/create` },
          }}
          className="primary-link"
        >
          {home("getStarted")}
        </Link>
      </aside>
    </main>
  );
}
