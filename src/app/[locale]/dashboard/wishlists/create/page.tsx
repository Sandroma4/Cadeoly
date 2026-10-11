import { getEvents, getEvent } from "@/app/actions/event";
import { WishlistForm } from "@/components/wishlist/WishlistForm";
import { WishlistHelp } from "@/components/wishlist/WishlistHelp";
import { getMyFamilies } from "@/app/actions/family";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sharedProduct } from "@/lib/convenience";
export default async function CreateWishlistPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string; url?: string; title?: string }>;
}) {
  const [availableEvents, families] = await Promise.all([
    getEvents(),
    getMyFamilies(),
  ]);
  const events = availableEvents.map(({ id, name }) => ({ id, name }));
  const requested = (await searchParams).eventId;
  const shared = sharedProduct(await searchParams);
  if (requested && !events.some((event) => event.id === requested)) {
    const event = await getEvent(requested);
    if (event) events.push({ id: event.id, name: event.name });
  }
  const defaultEventId = events.some((event) => event.id === requested)
    ? requested
    : undefined;
  const session = await auth();
  const recipients = session?.user?.id
    ? await prisma.recipient.findMany({
        where: { ownerId: session.user.id },
        select: { id: true, name: true },
      })
    : [];
  return (
    <div className="stack focused-page wishlist-create-page">
      <WishlistForm
        events={events}
        defaultEventId={defaultEventId}
        hasFamily={families.length > 0}
        recipients={recipients}
        quickAdd={shared.url || shared.title ? shared : undefined}
      />
      <WishlistHelp />
    </div>
  );
}
