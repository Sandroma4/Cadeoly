import { BrandLogo } from "@/components/ui/BrandLogo";
import { DraftScope } from "@/components/ui/DraftScope";
import { cookies, headers } from "next/headers";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import styles from "./layout.module.css";
import { Link } from "@/i18n/routing";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { DashboardNavigation } from "@/components/dashboard/DashboardNavigation";
import { DashboardBreadcrumbs } from "@/components/dashboard/DashboardBreadcrumbs";
import { OptionsMenu } from "@/components/dashboard/OptionsMenu";
import { Tutorial, TutorialReplay } from "@/components/dashboard/Tutorial";
import { InstallApp } from "@/components/ui/InstallApp";
import { returnPath } from "@/lib/return-path";
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const destination = returnPath(
    (await headers()).get("x-cadeoly-return-path"),
    locale,
  );
  const login = "/" + locale + "/login?next=" + encodeURIComponent(destination);
  const session = await auth();
  if (!session?.user?.id) redirect(login);
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, tutorialCompletedAt: true },
  });
  if (!user) redirect(login);
  const t = await getTranslations("dashboard");
  const preferences = await cookies();
  const choice =
    preferences.get("cadeoly-theme")?.value ??
    preferences.get("wishi-theme")?.value;
  const theme = choice === "light" || choice === "dark" ? choice : "system";
  return (
    <DraftScope userId={session.user.id}>
      <Tutorial completed={Boolean(user.tutorialCompletedAt)}>
        <div className={styles.dashboard}>
          <a className="skip-link" href="#dashboard-content">
            {(await getTranslations("improvements"))("skip")}
          </a>
          <aside className={styles.sidebar}>
            <div className={styles.logo}>
              <h2>
                <BrandLogo />
              </h2>
            </div>
            <DashboardNavigation />
            <Link className="dashboard-search-link" href="/dashboard/search">
              {(await getTranslations("globalSearch"))("title")}
            </Link>
            <OptionsMenu
              className={styles.settings}
              label={t("displaySettings")}
            >
              <div className={styles.settingsPanel}>
                <Link
                  href="/dashboard/profile"
                  className={styles.optionsProfile}
                >
                  <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
                  </svg>
                  <span>{t("myProfile")}</span>
                  <span aria-hidden="true" className={styles.optionsArrow}>
                    ›
                  </span>
                </Link>
                <div className={`${styles.optionsGroup} ${styles.mobileOnly}`}>
                  <span className={styles.optionsLabel}>
                    {t("optionsLanguage")}
                  </span>
                  <LanguageSwitcher />
                </div>
                <div className={`${styles.optionsGroup} ${styles.mobileOnly}`}>
                  <span className={styles.optionsLabel}>
                    {t("optionsAppearance")}
                  </span>
                  <ThemeSwitcher initial={theme} />
                </div>
                <InstallApp />
                <div>
                  <TutorialReplay />
                </div>
                <Link href="/quick-add">
                  {(await getTranslations("convenience"))("quickAdd")}
                </Link>
                <Link href="/dashboard/gift-ideas">
                  {(await getTranslations("convenience"))("ideas")}
                </Link>
                <Link href="/dashboard/search">
                  {(await getTranslations("globalSearch"))("title")}
                </Link>
                <div className={styles.optionsLogout}>
                  <SignOutButton />
                </div>
              </div>
            </OptionsMenu>
            <div className={styles.desktopControls}>
              <div className={styles.desktopControlRow}>
                <LanguageSwitcher />
              </div>
              <div className={styles.desktopControlRow}>
                <ThemeSwitcher initial={theme} />
              </div>
            </div>
            <Link href="/dashboard/profile" className={styles.profile}>
              <div className={styles.avatar}>
                {user.name?.[0]?.toUpperCase() || "U"}
              </div>
              <span className={styles.userName}>
                {user.name || t("myProfile")}
              </span>
            </Link>
          </aside>
          <main id="dashboard-content" tabIndex={-1} className={styles.main}>
            <div className={styles.content}>
              <DashboardBreadcrumbs />
              {children}
            </div>
          </main>
        </div>
      </Tutorial>
    </DraftScope>
  );
}
