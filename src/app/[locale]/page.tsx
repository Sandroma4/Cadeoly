import { cookies } from "next/headers";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { OccasionIcon } from "@/components/ui/OccasionIcon";
import styles from "./page.module.css";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { QuickOptions } from "@/components/ui/QuickOptions";
import { InstallApp } from "@/components/ui/InstallApp";

export default async function Home() {
  const [t, guest, preferences] = await Promise.all([
    getTranslations("home"),
    getTranslations("guest"),
    cookies(),
  ]);
  const choice =
    preferences.get("cadeoly-theme")?.value ??
    preferences.get("wishi-theme")?.value;
  const theme = choice === "light" || choice === "dark" ? choice : "system";
  return (
    <main className={styles.container}>
      <div className={styles.topControls}>
        <InstallApp className={styles.installApp} />
        <QuickOptions initialTheme={theme} compact />
      </div>
      <div className={styles.illustration} aria-hidden="true">
        <BrandLogo iconOnly />
      </div>
      <header className={styles.header}>
        <h1>
          {t.rich("title", {
            brand: (chunks) => <span className={styles.brand}>{chunks}</span>,
          })}
        </h1>
        <p>{t("description")}</p>
      </header>
      <section className={styles.content}>
        <Link href="/register" className={styles.button}>
          {t("getStarted")}
        </Link>
        <Link href="/login" className={styles.secondaryButton}>
          {t("signIn")}
        </Link>
        <Link href="/guest" className={styles.secondaryButton}>
          {guest("continue")}
        </Link>
      </section>
      <section className={styles.benefits} aria-label={t("benefits")}>
        {["wishes", "duplicates", "surprise"].map((key) => (
          <article key={key}>
            <h2>{t(key + "Title")}</h2>
            <p>{t(key + "Help")}</p>
          </article>
        ))}
      </section>
      <section className={styles.example} aria-labelledby="example-title">
        <div>
          <span className={styles.badge}>{t("exampleBadge")}</span>
          <h2 id="example-title">{t("exampleTitle")}</h2>
          <p>{t("exampleHelp")}</p>
        </div>
        <ul>
          {["book", "headphones", "weekend"].map((key) => (
            <li key={key}>
              <OccasionIcon kind="gift" />
              <span>{t("example" + key)}</span>
              <span className={styles.badge}>
                {t(
                  key === "book"
                    ? "available"
                    : key === "headphones"
                      ? "reserved"
                      : "group",
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
