import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readEvent } from "@/lib/event-service";
import { eventCalendar } from "@/lib/event-calendar";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const event = await readEvent(prisma, id, session.user.id);
  if (!event) return new Response("Not found", { status: 404 });
  return new Response(eventCalendar(event), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cadeoly-event.ics"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
