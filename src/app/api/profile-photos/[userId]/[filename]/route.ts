import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { photoName, readGiftPhoto } from "@/lib/gift-photos";
import { canReadProfilePhoto } from "@/lib/profile-photos";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string; filename: string }> },
) {
  const { userId, filename } = await params;
  if (!photoName.test(filename)) return new Response(null, { status: 404 });
  const session = await auth();
  if (!(await canReadProfilePhoto(prisma, userId, session?.user?.id)))
    return new Response(null, { status: 404 });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profilePhoto: true },
  });
  if (user?.profilePhoto !== filename)
    return new Response(null, { status: 404 });
  const bytes = await readGiftPhoto(filename);
  return bytes
    ? new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      })
    : new Response(null, { status: 404 });
}
