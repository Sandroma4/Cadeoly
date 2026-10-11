import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readGiftIdeas } from "@/lib/gift-ideas";
import { GiftIdeas } from "@/components/wishlist/GiftIdeas";
import { GiftImage } from "@/components/wishlist/GiftDetails";
import { Link } from "@/i18n/routing";
import { getTranslations, getLocale } from "next-intl/server";
import { ReserveButton } from "@/components/wishlist/ReserveButton";
import { FavoriteButton } from "@/components/wishlist/FavoriteButton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";
export default async function Page() {
  const session = await auth(),
    t = await getTranslations("convenience"),
    locale = await getLocale();
  const items = session?.user?.id
    ? await readGiftIdeas(prisma, session.user.id)
    : [];
  return (
    <GiftIdeas
      gifts={items.map((item) => ({
        ...item,
        recipient:
          item.wishlist.recipient?.name || item.wishlist.owner.name || "—",
        event: item.wishlist.event?.name || "",
        card: (
          <Card className="gift-card">
            <GiftImage gift={item} />
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                {item.wishlist.recipient?.name || item.wishlist.owner.name} ·{" "}
                {item.wishlist.name}
              </p>
              {item.priceCents !== null && (
                <p>
                  {new Intl.NumberFormat(locale, {
                    style: "currency",
                    currency: item.currency || "EUR",
                  }).format(item.priceCents / 100)}
                </p>
              )}
              {item.wishlist.event && (
                <p>
                  {item.wishlist.event.name} ·{" "}
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  }).format(item.wishlist.event.date)}
                </p>
              )}
              <Link href={`/dashboard/wishlists/${item.wishlist.id}`}>
                {t("openList")}
              </Link>
            </CardContent>
            <CardFooter>
              <FavoriteButton itemId={item.id} isFavorite={item.isFavorite} />
              {item.isGroupGift ? (
                <Link href={`/dashboard/wishlists/${item.wishlist.id}`}>
                  {t("contribute")}
                </Link>
              ) : (
                <ReserveButton
                  itemId={item.id}
                  isReserved={item.isReserved}
                  reservedByMe={item.reservedByMe}
                />
              )}
            </CardFooter>
          </Card>
        ),
      }))}
    />
  );
}
