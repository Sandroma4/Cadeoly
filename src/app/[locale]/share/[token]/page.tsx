import { notFound, redirect } from "next/navigation";
import { getSharedWishlist } from "@/app/actions/wishlist";
import { auth } from "@/auth";
import { WishlistView } from "@/components/wishlist/WishlistView";
import { PublicListHeader } from "@/components/wishlist/PublicListHeader";
import { giftPageOptions } from "@/lib/gift-search";
import type { Metadata } from "next";
import { currentGuestOwner } from "@/lib/guest-list-access";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string; locale: string }>;
}): Promise<Metadata> {
  const { token, locale } = await params;
  const wishlist = await getSharedWishlist(token);
  if (!wishlist) return { robots: { index: false, follow: false } };
  const count = wishlist.items.length;
  const isEn = locale === "en";
  const title = `${wishlist.name} · Cadéoly`;
  const description =
    wishlist.description ||
    (isEn
      ? `Discover this wish list on Cadéoly with ${count} gift ${count === 1 ? "idea" : "ideas"}.`
      : `Découvrez la liste d’envies sur Cadéoly avec ${count} idée${count === 1 ? "" : "s"} cadeau.`);

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Cadéoly",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}
export default async function SharedPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token, locale } = await params;
  const wishlist = await getSharedWishlist(
    token,
    giftPageOptions(await searchParams, locale),
  );
  if (!wishlist) notFound();
  if (wishlist.isOwner && (await currentGuestOwner())?.id === wishlist.ownerId)
    redirect(`/${locale}/guest/lists/${wishlist.id}`);
  const session = await auth();
  return (
    <main className="public-container">
      <PublicListHeader />
      <WishlistView
        wishlist={wishlist}
        loggedIn={Boolean(session?.user?.id)}
        token={token}
      />
    </main>
  );
}
