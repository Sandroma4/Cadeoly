import { OccasionIcon } from "@/components/ui/OccasionIcon";
import { auth } from "@/auth";
import styles from "./page.module.css";
import { getMyFamilies } from "@/app/actions/family";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { FamilyActions } from "@/components/family/FamilyActions";
import { InviteMemberForm } from "@/components/family/InviteMemberForm";
import { PendingInvitations } from "@/components/family/PendingInvitations";
import { MemberManagement } from "@/components/family/MemberManagement";
import { FamilyWishlists } from "@/components/family/FamilyWishlists";
import { getTranslations } from "next-intl/server";

export default async function FamilyPage() {
  const [families, t, session, flow, management] = await Promise.all([
    getMyFamilies(),
    getTranslations("family"),
    auth(),
    getTranslations("dailyFlow"),
    getTranslations("familyManagement"),
  ]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("title")}</h1>
          <p className="page-intro">{t("intro")}</p>
        </div>
        {families.length > 0 && <FamilyActions join />}
      </header>

      <div className={styles.grid}>
        <div className={styles.mainContent}>
          {families.length === 0 ? (
            <Card className={styles.emptyCard}>
              <CardContent className={styles.emptyContent}>
                <div className="empty-art">
                  <OccasionIcon kind="people" />
                </div>
                <p>{t("noFamily")}</p>
                <p>{flow("emptyFamily")}</p>
                <FamilyActions join />
              </CardContent>
            </Card>
          ) : (
            families.map((family) => (
              <Card key={family.id} className={styles.familyCard}>
                <CardHeader>
                  <CardTitle>{family.name}</CardTitle>
                  <CardDescription>
                    {t("membersCount", { count: family.members.length })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {family.description && (
                    <p className={styles.description}>{family.description}</p>
                  )}

                  <div className={styles.membersList}>
                    <h4 className={styles.sectionTitle}>{t("members")}</h4>
                    <ul className={styles.list}>
                      {family.members.map((member) => (
                        <li key={member.id} className={styles.memberItem}>
                          <UserAvatar name={member.user.name || ""} className={styles.avatar} src={member.user.profilePhoto && (member.userId === session?.user?.id || ["FAMILY", "MEMBERS"].includes(member.user.profilePhotoVisibility)) ? profilePhotoUrl(member.userId, member.user.profilePhoto) : null} />
                          <div>
                            <p className={styles.memberName}>
                              {member.user.name}
                            </p>
                            <span
                              className={`${styles.memberRole} ${member.role === "ADMIN" ? styles.adminRole : ""}`}
                            >
                              {t(
                                member.role === "ADMIN"
                                  ? "roleAdmin"
                                  : "roleMember",
                              )}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {family.members.some(
                    (member) =>
                      member.userId === session?.user?.id &&
                      member.role === "ADMIN",
                  ) && (
                    <details className="form-options invitation-panel">
                      <summary
                        className={`creation-trigger ${styles.inviteTrigger}`}
                      >
                        {t("invite")}
                      </summary>
                      <div className="stack">
                        <InviteMemberForm familyId={family.id} />
                        <PendingInvitations familyId={family.id} />
                      </div>
                    </details>
                  )}

                  <FamilyWishlists familyId={family.id} />
                  {session?.user?.id && (
                    <details className="form-options">
                      <summary className={styles.manageTrigger}>
                        {management("title")}
                      </summary>
                      <MemberManagement
                        familyId={family.id}
                        ownerId={family.ownerId}
                        userId={session.user.id}
                        members={family.members}
                      />
                    </details>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
import { UserAvatar } from "@/components/ui/UserAvatar";
import { profilePhotoUrl } from "@/lib/profile-photo-url";
