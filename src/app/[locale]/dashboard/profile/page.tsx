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
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/" + (await getLocale()) + "/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
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
  return (
    <div className="stack focused-page">
      <ProfileForm
        key={`${user.name}-${user.locale}`}
        name={user.name || ""}
        email={user.email || ""}
        locale={user.locale || "fr"}
        emailRemindersEnabled={user.emailRemindersEnabled}
        emailReminderDays={user.emailReminderDays}
      />
      {googleAuthEnabled() && (
        <section className="stack">
          <h2>{google("title")}</h2>
          {user.accounts.length ? (
            <p role="status">{google("linked")}</p>
          ) : (
            <>
              <p>{google("linkHelp")}</p>
              <GoogleButton next={`/${locale}/dashboard/profile`} link />
            </>
          )}
        </section>
      )}
      {user.password ? <ChangePasswordForm /> : <p>{google("passwordHelp")}</p>}
      <RecipientManager recipients={recipients} />
      <section className="stack">
        <h2>{t("exportTitle")}</h2>
        <p>{t("exportHelp")}</p>
        <a className="primary-link" href="/api/account-export" download>
          {t("exportDownload")}
        </a>
      </section>
      <PersonalImport />
    </div>
  );
}
