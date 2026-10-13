import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { sharedProduct } from "@/lib/convenience";
import { QuickAdd } from "@/components/wishlist/QuickAdd";
import { DraftScope } from "@/components/ui/DraftScope";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Link } from "@/i18n/routing";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    url?: string;
    text?: string;
    title?: string;
    price?: string;
    image?: string;
  }>;
}) {
  const { locale } = await params,
    product = sharedProduct(await searchParams),
    session = await auth();
  if (!session?.user?.id) {
    const next = `/${locale}/quick-add?${new URLSearchParams(product)}`;
    redirect(`/${locale}/login?next=${encodeURIComponent(next)}`);
  }
  const lists = await prisma.wishlist.findMany({
    where: { ownerId: session.user.id, deletedAt: null, archivedAt: null },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <DraftScope userId={session.user.id}>
      <main className="public-container stack">
        <Link href="/dashboard">
          <BrandLogo />
        </Link>
        <QuickAdd lists={lists} {...product} />
      </main>
    </DraftScope>
  );
}
