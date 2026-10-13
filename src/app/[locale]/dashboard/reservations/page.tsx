import styles from "./page.module.css";
import { OccasionIcon } from "@/components/ui/OccasionIcon";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readMyReservations } from "@/lib/wishlist-service";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ReserveButton } from "@/components/wishlist/ReserveButton";
import { GiftDetails } from "@/components/wishlist/GiftDetails";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { readMyContributions } from "@/lib/contribution-service";
import { ContributionForm } from "@/components/wishlist/ContributionForm";
import { GiftBudget } from "@/components/dashboard/GiftBudget";
import { ReservationPreparation } from "@/components/dashboard/ReservationPreparation";
import { ReservationsFilterView } from "@/components/dashboard/ReservationsFilterView";
import { partitionGiftHistory } from "@/lib/gift-suggestions";
import { budgetCurrencies } from "@/lib/gift-budget";
export default async function ReservationsPage() {
  const session = await auth();
  const locale = await getLocale();
  if (!session?.user?.id) redirect("/" + locale + "/login");
  const reservations = await readMyReservations(prisma, session.user.id);
  const { active, history } = partitionGiftHistory(reservations);
  const contributions = await readMyContributions(prisma, session.user.id);
  const budgets = await prisma.giftBudget.findMany({
    where: { userId: session.user.id },
    select: { scope: true, currency: true, amountCents: true },
  });
  const familyCount = await prisma.familyMember.count({
    where: { userId: session.user.id },
  });
  const audit = await getTranslations("auditUI");
  const group = await getTranslations("contributions");
  const t = await getTranslations("reservations");
  const historyText = await getTranslations("giftHistory");
  return (
    <div className={`stack ${styles.page}`}>
      <header className="page-heading">
        <h1>{t("title")}</h1>
        <p className="page-intro">{t("intro")}</p>
      </header>
      <p className="privacy-note">
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V6a4 4 0 0 1 8 0v4" />
        </svg>{" "}
        {t("privacy")}
      </p>
      <div className={`stack ${styles.reservations}`}>
        {!active.length && !history.length && (
          <Card>
            <CardContent className="welcoming-empty">
              <div className="empty-art">
                <OccasionIcon kind="giving" />
              </div>
              <p>{t("empty")}</p>
              <Link className="primary-link" href="/dashboard/family">
                {familyCount ? t("explore") : audit("startFamily")}{" "}
                <span aria-hidden="true">→</span>
              </Link>
            </CardContent>
          </Card>
        )}
        {active.length > 0 && (
          <section className="stack" aria-labelledby="active-gifts">
            <h2 id="active-gifts">{historyText("active")}</h2>
            <ReservationsFilterView
              items={active.map(
                ({ itemId, gift, preparationStatus, personalMessage }) => ({
                  itemId,
                  title: gift?.title || "",
                  recipient: gift?.recipient || "",
                  event: gift?.event,
                  card: (
                    <Card key={itemId}>
                      <CardContent>
                        <div className="stack">
                          {gift ? (
                            <>
                              <h3>{gift.title}</h3>
                              <p>
                                {t("for", {
                                  name: gift.recipient || t("unknown"),
                                })}
                              </p>
                              {gift.event && <p>{gift.event}</p>}
                              <GiftDetails gift={gift} token={gift.token} />
                              {gift.priceCents !== null && (
                                <p>
                                  {new Intl.NumberFormat(locale, {
                                    style: "currency",
                                    currency: gift.currency || "EUR",
                                  }).format(gift.priceCents / 100)}
                                </p>
                              )}
                              <Link href={gift.href}>{gift.listName}</Link>
                              <ReservationPreparation
                                itemId={itemId}
                                status={preparationStatus || "RESERVED"}
                                personalMessage={personalMessage}
                              />
                            </>
                          ) : (
                            <>
                              <h3>{t("unavailable")}</h3>
                              <p>{t("accessChanged")}</p>
                            </>
                          )}
                          <ReserveButton
                            itemId={itemId}
                            isReserved
                            reservedByMe
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ),
                }),
              )}
            />
          </section>
        )}
        {!!contributions.length && (
          <section className="stack">
            <h2>{group("title")}</h2>
            {contributions.map((row) => (
              <Card key={row.itemId}>
                <CardContent>
                  <h3>{row.title || t("unavailable")}</h3>
                  {row.href && <Link href={row.href}>{group("open")}</Link>}
                  <ContributionForm
                    itemId={row.itemId}
                    mine={row.amountCents}
                    cancelOnly
                  />
                </CardContent>
              </Card>
            ))}
          </section>
        )}
        {(history.length > 0 || active.length > 0) && (
          <section className="stack" aria-labelledby="gift-history">
            <h2 id="gift-history">{historyText("title")}</h2>
            <p>{historyText("help")}</p>
            {!history.length ? (
              <p>{historyText("empty")}</p>
            ) : (
              <div className="gift-grid">
                {history.map(
                  ({ itemId, gift, preparationStatus, personalMessage }) => (
                    <Card key={itemId}>
                      <CardContent>
                        <div className="stack">
                          {gift ? (
                            <>
                              <h3>{gift.title}</h3>
                              <p>
                                {t("for", {
                                  name: gift.recipient || t("unknown"),
                                })}
                              </p>
                              {gift.event && <p>{gift.event}</p>}
                              <GiftDetails gift={gift} token={gift.token} />
                              {gift.priceCents !== null && (
                                <p>
                                  {new Intl.NumberFormat(locale, {
                                    style: "currency",
                                    currency: gift.currency || "EUR",
                                  }).format(gift.priceCents / 100)}
                                </p>
                              )}
                              <Link href={gift.href}>{gift.listName}</Link>
                              <ReservationPreparation
                                itemId={itemId}
                                status={preparationStatus}
                                personalMessage={personalMessage}
                              />
                            </>
                          ) : (
                            <>
                              <h3>{t("unavailable")}</h3>
                              <p>{t("accessChanged")}</p>
                            </>
                          )}
                          <ReserveButton
                            itemId={itemId}
                            isReserved
                            reservedByMe
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ),
                )}
              </div>
            )}
          </section>
        )}
      </div>
      <GiftBudget
        reservations={reservations}
        contributions={contributions}
        budgets={budgets}
        currencyOptions={budgetCurrencies}
      />
    </div>
  );
}
