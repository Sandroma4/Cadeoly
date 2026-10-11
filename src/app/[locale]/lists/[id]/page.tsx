import { notFound } from "next/navigation";
import { getPublicWishlist } from "@/app/actions/wishlist";
import { auth } from "@/auth";
import { WishlistView } from "@/components/wishlist/WishlistView";
import { PublicListHeader } from "@/components/wishlist/PublicListHeader";
import { giftPageOptions } from "@/lib/gift-search";
export default async function PublicListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, locale } = await params;
  const list = await getPublicWishlist(
    id,
    giftPageOptions(await searchParams, locale),
  );
  if (!list) notFound();
  const session = await auth();
  return (
    <main className="public-container">
      <PublicListHeader />
      <WishlistView wishlist={list} loggedIn={Boolean(session?.user?.id)} />
    </main>
  );
}
