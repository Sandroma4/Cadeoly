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
import { QuickOptions } from "@/components/ui/QuickOptions";
import { currentGuestOwner } from "@/lib/guest-list-access";
import { GuestFeatureGate } from "@/components/dashboard/GuestFeatureGate";
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
  const guestMode = !session?.user?.id;
  const guest = guestMode ? await currentGuestOwner() : null;
  const account = await getTranslations("guestAccount");
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, tutorialCompletedAt: true },
      })
    : { name: account("guestName"), tutorialCompletedAt: new Date() };
  if (!user) redirect(login);
  const t = await getTranslations("dashboard");
  const preferences = await cookies();
  const choice =
    preferences.get("cadeoly-theme")?.value ??
    preferences.get("wishi-theme")?.value;
  const theme = choice === "light" || choice === "dark" ? choice : "system";
  return (
    <DraftScope userId={session?.user?.id || guest?.id || "guest"}>
      <Tutorial
        guestMode={guestMode}
        completed={Boolean(user.tutorialCompletedAt)}
      >
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
            <Link
              className={`${styles.navItem} ${styles.searchLink} dashboard-search-link`}
              href="/dashboard/search"
            >
              <span aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              <span className={styles.navLabel}>
                {(await getTranslations("globalSearch"))("title")}
              </span>
            </Link>
            <div className={styles.sidebarFooter}>
              <div className={styles.desktopControls}>
                <QuickOptions initialTheme={theme} compact />
              </div>
              <OptionsMenu
                className={styles.settings}
                label={t("displaySettings")}
                mobilePortal
                mobileAction={<InstallApp className={styles.installControl} />}
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
                  <div
                    className={`${styles.optionsGroup} ${styles.mobileOnly}`}
                  >
                    <span className={styles.optionsLabel}>
                      {t("optionsLanguage")}
                    </span>
                    <LanguageSwitcher />
                  </div>
                  <div
                    className={`${styles.optionsGroup} ${styles.mobileOnly}`}
                  >
                    <span className={styles.optionsLabel}>
                      {t("optionsAppearance")}
                    </span>
                    <ThemeSwitcher initial={theme} />
                  </div>
                  <div>
                    <TutorialReplay />
                  </div>
                  <Link href="/quick-add">
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v8M8 12h8" />
                    </svg>
                    <span>
                      {(await getTranslations("convenience"))("quickAdd")}
                    </span>
                  </Link>
                  <Link href="/dashboard/gift-ideas">
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
                    </svg>
                    <span>
                      {(await getTranslations("convenience"))("ideas")}
                    </span>
                  </Link>
                  <Link href="/dashboard/search">
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                    <span>
                      {(await getTranslations("globalSearch"))("title")}
                    </span>
                  </Link>
                  <div className={styles.optionsLogout}>
                    {guestMode ? (
                      <Link href={login}>
                        {(await getTranslations("auth"))("signIn")}
                      </Link>
                    ) : (
                      <SignOutButton />
                    )}
                  </div>
                </div>
              </OptionsMenu>
              <Link href="/dashboard/profile" className={styles.profile}>
                <div className={styles.avatar}>
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
                <span className={styles.userName}>
                  {user.name || t("myProfile")}
                </span>
              </Link>
            </div>
          </aside>
          <main id="dashboard-content" tabIndex={-1} className={styles.main}>
            <div id="dashboard-scroll" className={styles.content}>
              <DashboardBreadcrumbs />
              <GuestFeatureGate guestMode={guestMode}>
                {children}
              </GuestFeatureGate>
            </div>
          </main>
        </div>
      </Tutorial>
    </DraftScope>
  );
}
