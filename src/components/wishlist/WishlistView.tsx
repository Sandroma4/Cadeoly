import { OccasionIcon } from "@/components/ui/OccasionIcon";
import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashShareToken } from "@/lib/wishlist-service";
import { MerchantLinks } from "./MerchantLinks";
import { readWishlist } from "@/lib/wishlist-service";
import { AddItemForm } from "./AddItemForm";
import { ReserveButton } from "./ReserveButton";
import { GuestReservation } from "./GuestReservation";
import { GiftDetails, GiftImage } from "./GiftDetails";
import { GiftBrowser } from "./GiftBrowser";
import { GiftOrderControls } from "./GiftOrderControls";
import { ContributionForm } from "./ContributionForm";
import { GiftFunding } from "./GiftFunding";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";
export async function WishlistView({
  wishlist,
  loggedIn,
  token,
  previewOnly = false,
}: {
  wishlist: NonNullable<Awaited<ReturnType<typeof readWishlist>>>;
  loggedIn: boolean;
  token?: string;
  previewOnly?: boolean;
}) {
  const t = await getTranslations("wishlist");
  const c = await getTranslations("common");
  const flow = await getTranslations("dailyFlow");
  const locale = await getLocale();
  const total = wishlist.pagination?.total ?? wishlist.items.length;
  const guestSession = !loggedIn
    ? (await cookies()).get("cadeoly-guest")?.value
    : undefined;
  const guestReservations = guestSession
    ? await prisma.reservation.findMany({
        where: {
          userId: null,
          guestSessionHash: hashShareToken(guestSession),
          managementExpiresAt: { gt: new Date() },
          itemId: { in: wishlist.items.map((item) => item.id) },
        },
        select: { id: true, itemId: true },
      })
    : [];
  const releasedNotes = wishlist.isOwner
    ? await prisma.reservation.findMany({
        where: {
          itemId: { in: wishlist.items.map((item) => item.id) },
          messageReleasedAt: { not: null },
          personalMessage: { not: null },
        },
        select: { itemId: true, personalMessage: true },
      })
    : [];
  const targetDate = wishlist.event?.date
    ? new Date(wishlist.event.date)
    : wishlist.neededBy
      ? new Date(wishlist.neededBy + "T00:00:00Z")
      : null;
  const daysLeft = targetDate
    ? Math.ceil((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="stack" id="list-gifts">
      <header>
        <h1>{wishlist.name}</h1>
        <div className="wishlist-header-meta">
          <p>{t("byOwner", { name: wishlist.owner.name || c("unknown") })}</p>
          {wishlist.recipient && (
            <p>{t("forRecipient", { name: wishlist.recipient.name })}</p>
          )}
          {wishlist.event && (
            <p>
              {t("event")}: {wishlist.event.name}
            </p>
          )}
          {wishlist.occasion && (
            <p>
              {t("occasion")}: {wishlist.occasion}
            </p>
          )}
          {wishlist.neededBy && (
            <p>
              {t("neededBy")}:{" "}
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "long",
                timeZone: "UTC",
              }).format(new Date(wishlist.neededBy + "T00:00:00Z"))}
            </p>
          )}
        </div>
      </header>
      {daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && (
        <div
          className="event-urgency-banner"
          role="status"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius)",
            background: "color-mix(in srgb, var(--accent) 15%, var(--card))",
            border:
              "1px solid color-mix(in srgb, var(--accent) 35%, var(--border))",
            fontSize: "0.9rem",
            fontWeight: 500,
          }}
        >
          {t("eventApproaching", { count: daysLeft })}
        </div>
      )}
      {wishlist.description && <p>{wishlist.description}</p>}
      {wishlist.preferences && (
        <p style={{ whiteSpace: "pre-wrap" }}>{wishlist.preferences}</p>
      )}
      {wishlist.isOwner && (
        <>
          <p className="wishlist-privacy-note">
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="5" y="10" width="14" height="11" rx="2" />
              <path d="M8 10V6a4 4 0 0 1 8 0v4" />
            </svg>{" "}
            {t("surprise")}
          </p>
          {wishlist.canEdit && total > 0 && (
            <div id="gift-add-section">
              <AddItemForm wishlistId={wishlist.id} />
            </div>
          )}
        </>
      )}
      {!total && (
        <div className="empty-state wishlist-empty">
          <div className="wishlist-empty-intro">
            <div className="empty-art">
              <OccasionIcon />
            </div>
            <p>{wishlist.canEdit ? flow("firstWish") : t("noItems")}</p>
            <p>
              {flow(wishlist.canEdit ? "emptyGiftsOwner" : "emptyGiftsVisitor")}
            </p>
          </div>
          {wishlist.canEdit && <AddItemForm wishlistId={wishlist.id} />}
        </div>
      )}
      {total > 0 && (
        <>
          {wishlist.canEdit &&
            (!wishlist.pagination ||
              wishlist.pagination.filters.sort === "manual") && (
              <p className="form-hint">{t("orderHelp")}</p>
            )}
          <GiftBrowser
            owner={wishlist.isOwner}
            pagination={wishlist.pagination}
            gifts={wishlist.items.map((item) => ({
              ...item,
              card: (
                <Card key={item.id} className="gift-card">
                  <GiftImage gift={item} token={token} />
                  <CardHeader>
                    <CardTitle>{item.title}</CardTitle>
                    {item.isGroupGift && (
                      <p className="visual-badge gift-group-badge">
                        {t("groupGift")}
                      </p>
                    )}
                    <p className="gift-price">
                      {item.priceCents !== null
                        ? new Intl.NumberFormat(locale, {
                            style: "currency",
                            currency: item.currency || "EUR",
                          }).format(item.priceCents / 100)
                        : ""}{" "}
                      <span
                        className="visual-badge gift-priority"
                        data-priority={item.priority}
                      >
                        {t(
                          "priority" +
                            item.priority[0] +
                            item.priority.slice(1).toLowerCase(),
                        )}
                      </span>
                    </p>
                  </CardHeader>
                  <CardContent>
                    {releasedNotes.find((row) => row.itemId === item.id)
                      ?.personalMessage && (
                      <blockquote style={{ whiteSpace: "pre-wrap" }}>
                        {
                          releasedNotes.find((row) => row.itemId === item.id)
                            ?.personalMessage
                        }
                      </blockquote>
                    )}
                    {!wishlist.isOwner && !previewOnly && (
                      <p
                        className="gift-availability"
                        data-reserved={item.isReserved}
                      >
                        {t(item.isReserved ? "reserved" : "available")}
                      </p>
                    )}
                    {!wishlist.isOwner && !previewOnly && item.isGroupGift && (
                      <GiftFunding
                        total={item.contributedCents}
                        target={item.priceCents}
                        currency={item.currency}
                      />
                    )}
                    {(item.size ||
                      item.color ||
                      item.model ||
                      item.description ||
                      item.alternativeUrls) && (
                      <details className="gift-details-panel">
                        <summary>{t("details")}</summary>
                        <div className="stack">
                          <GiftDetails
                            gift={item}
                            token={token}
                            showImage={false}
                          />
                          {item.description && (
                            <p className="gift-description">
                              {item.description}
                            </p>
                          )}
                          {(item.alternativeUrls || "")
                            .split("\n")
                            .filter((url) => /^https?:\/\//.test(url))
                            .map((url, index) => (
                              <a
                                key={url}
                                className="product-link"
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {t("alternativeLink", { number: index + 1 })} ↗
                              </a>
                            ))}
                        </div>
                      </details>
                    )}
                    {item.url &&
                      (item.url.startsWith("https://") ||
                        item.url.startsWith("http://")) && (
                        <a
                          className="product-link"
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("viewProduct")} <span aria-hidden="true">↗</span>
                        </a>
                      )}
                  </CardContent>
                  <CardFooter>
                    {previewOnly ? (
                      <p>{t("previewOnly")}</p>
                    ) : wishlist.isOwner ? (
                      wishlist.canEdit && (
                        <div className="stack">
                          {(!wishlist.pagination ||
                            wishlist.pagination.filters.sort === "manual") && (
                            <GiftOrderControls
                              itemId={item.id}
                              title={item.title}
                              canMoveUp={Boolean(item.canMoveUp)}
                              canMoveDown={Boolean(item.canMoveDown)}
                            />
                          )}
                          <AddItemForm wishlistId={wishlist.id} item={item} />
                          {(item.url || item.alternativeUrls) && (
                            <details className="gift-details-panel">
                              <summary>{t("linkTools")}</summary>
                              <MerchantLinks itemId={item.id} />
                            </details>
                          )}
                        </div>
                      )
                    ) : loggedIn && item.isGroupGift ? (
                      <ContributionForm
                        key={item.myContributionCents}
                        itemId={item.id}
                        mine={item.myContributionCents}
                        total={item.contributedCents}
                        target={item.priceCents || 0}
                        currency={item.currency}
                        showProgress={false}
                        token={token}
                      />
                    ) : loggedIn ? (
                      <ReserveButton
                        itemId={item.id}
                        isReserved={item.isReserved}
                        reservedByMe={item.reservedByMe}
                        token={token}
                      />
                    ) : (
                      <GuestReservation
                        wishlistId={wishlist.id}
                        itemId={item.id}
                        token={token}
                        reserved={item.isReserved}
                        group={item.isGroupGift}
                        managementId={
                          guestReservations.find(
                            (row) => row.itemId === item.id,
                          )?.id
                        }
                      />
                    )}
                  </CardFooter>
                </Card>
              ),
            }))}
          />
        </>
      )}
      {wishlist.canEdit && total > 0 && !previewOnly && (
        <a
          href="#gift-add-section"
          className="mobile-fab"
          aria-label={t("addItem")}
          title={t("addItem")}
        >
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </a>
      )}
    </div>
  );
}
