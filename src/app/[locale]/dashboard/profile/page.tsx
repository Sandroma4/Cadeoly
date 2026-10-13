import { GoogleButton } from "@/components/auth/GoogleButton";
import { googleAuthEnabled } from "@/lib/google-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { RecipientManager } from "@/components/auth/RecipientManager";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { PersonalImport } from "@/components/auth/PersonalImport";
import { ProfilePhotoForm } from "@/components/auth/ProfilePhotoForm";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { profilePhotoUrl } from "@/lib/profile-photo-url";
import styles from "./page.module.css";
import { Link } from "@/i18n/routing";
import { OccasionIcon } from "@/components/ui/OccasionIcon";
import { ProfileViewFocus } from "@/components/auth/ProfileViewFocus";
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const sections = [
    "identity",
    "preferences",
    "security",
    "people",
    "data",
  ] as const;
  const requested = (await searchParams).section;
  const section = sections.find((value) => value === requested);
  const show = (value: (typeof sections)[number]) =>
    !section || section === value;
  const session = await auth();
  if (!session?.user?.id) redirect("/" + (await getLocale()) + "/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      profilePhoto: true,
      profilePhotoVisibility: true,
      email: true,
      locale: true,
      emailRemindersEnabled: true,
      emailReminderDays: true,
      password: true,
      accounts: { where: { provider: "google" }, select: { id: true } },
    },
  });
  if (!user) notFound();
  const recipients = await prisma.recipient.findMany({
    where: { ownerId: session.user.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const locale = await getLocale();
  const google = await getTranslations("googleAuth");
  const t = await getTranslations("convenience");
  const settings = await getTranslations("profileSettings");
  const authText = await getTranslations("auth");
  return (
    <div
      className={styles.page}
      data-profile-page
      data-profile-section={section || "menu"}
    >
      <ProfileViewFocus section={section || "menu"} />
      {section && (
        <div className={styles.subviewHeader}>
          <Link href="/dashboard/profile" className={styles.backLink}>
            ← {authText("profile")}
          </Link>
          <h1 tabIndex={-1}>{settings(section)}</h1>
        </div>
      )}
      {!section && (
        <header className={styles.header}>
          <UserAvatar
            name={user.name || ""}
            src={
              user.profilePhoto
                ? profilePhotoUrl(session.user.id, user.profilePhoto)
                : null
            }
            size={64}
          />
          <div>
            <h1 tabIndex={-1}>{authText("profile")}</h1>
            <p className={styles.desktopIntro}>{settings("intro")}</p>
            <p className={styles.mobileIdentity}>
              {user.name}
              <br />
              {user.email}
            </p>
          </div>
        </header>
      )}
      {!section && (
        <nav className={styles.mobileMenu} aria-label={settings("navigation")}>
          {(
            [
              {
                title: "accountGroup",
                entries: ["identity", "preferences", "security"],
              },
              { title: "familyGroup", entries: ["people"] },
              { title: "dataGroup", entries: ["data"] },
            ] as const
          ).map((group) => (
            <section key={group.title}>
              <h2>{settings(group.title)}</h2>
              <div className={styles.menuGroup}>
                {group.entries.map((entry) => (
                  <Link
                    key={entry}
                    href={`/dashboard/profile?section=${entry}`}
                  >
                    <span className={styles.menuIcon}>
                      {entry === "security" || entry === "preferences" ? (
                        <svg
                          aria-hidden="true"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          {entry === "security" ? (
                            <>
                              <rect
                                x="5"
                                y="10"
                                width="14"
                                height="11"
                                rx="2"
                              />
                              <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
                            </>
                          ) : (
                            <>
                              <path d="M4 7h16M4 17h16" />
                              <circle cx="9" cy="7" r="3" fill="var(--card)" />
                              <circle
                                cx="16"
                                cy="17"
                                r="3"
                                fill="var(--card)"
                              />
                            </>
                          )}
                        </svg>
                      ) : (
                        <OccasionIcon
                          kind={
                            entry === "identity" || entry === "people"
                              ? "people"
                              : "list"
                          }
                        />
                      )}
                    </span>
                    <span>{settings(entry)}</span>
                    <span aria-hidden="true" className={styles.chevron}>
                      ›
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>
      )}
      <div
        className={`${styles.layout} ${!section ? styles.overviewContent : styles.subviewContent}`}
      >
        <nav
          className={`${styles.navigation} ${section ? styles.hide : ""}`}
          aria-label={settings("navigation")}
        >
          {(
            ["identity", "preferences", "security", "people", "data"] as const
          ).map((section) => (
            <a key={section} href={`#profile-${section}`}>
              {settings(section)}
            </a>
          ))}
        </nav>
        <div className={`stack ${styles.content}`}>
          {show("identity") && (
            <ProfilePhotoForm
              userId={session.user.id}
              name={user.name || ""}
              photo={user.profilePhoto}
              visibility={user.profilePhotoVisibility}
            />
          )}
          {(show("identity") || show("preferences")) && (
            <ProfileForm
              key={section || "overview"}
              name={user.name || ""}
              email={user.email || ""}
              locale={user.locale || "fr"}
              emailRemindersEnabled={user.emailRemindersEnabled}
              emailReminderDays={user.emailReminderDays}
              section={
                section === "identity" || section === "preferences"
                  ? section
                  : undefined
              }
            />
          )}
          {show("security") && (
            <section
              id="profile-security"
              className={styles.card}
              aria-labelledby="security-heading"
            >
              <header>
                <h2 id="security-heading">{settings("security")}</h2>
                <p className={styles.hint}>{settings("securityHelp")}</p>
              </header>
              {googleAuthEnabled() && (
                <section className="stack">
                  <h3>{google("title")}</h3>
                  {user.accounts.length ? (
                    <p role="status">{google("linked")}</p>
                  ) : (
                    <>
                      <p>{google("linkHelp")}</p>
                      <GoogleButton
                        next={`/${locale}/dashboard/profile`}
                        link
                      />
                    </>
                  )}
                </section>
              )}
              {user.password ? (
                <ChangePasswordForm />
              ) : (
                <p>{google("passwordHelp")}</p>
              )}
            </section>
          )}
          {show("people") && (
            <div id="profile-people" className={styles.card}>
              <RecipientManager recipients={recipients} />
            </div>
          )}
          {show("data") && (
            <section
              id="profile-data"
              className={styles.card}
              aria-labelledby="data-heading"
            >
              <header>
                <h2 id="data-heading">{t("exportTitle")}</h2>
              </header>
              <section className="stack">
                <h3>{t("exportDownload")}</h3>
                <p>{settings("exportHelp")}</p>
                <details className={styles.help}>
                  <summary>{settings("learnMore")}</summary>
                  <p>{t("exportHelp")}</p>
                </details>
                <a className="primary-link" href="/api/account-export" download>
                  {t("exportDownload")}
                </a>
              </section>
              <PersonalImport />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
