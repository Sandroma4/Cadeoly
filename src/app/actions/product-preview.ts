"use server";
import { listOwnerId } from "@/lib/action-auth";
import { prisma } from "@/lib/prisma";
import { parseProduct, readPublicResource } from "@/lib/product-preview";
import sharp from "sharp";
const attempts = new Map<string, number>();
export async function previewProduct(wishlistId: string, url: string) {
  const userId = await listOwnerId();
  if (!userId) return { error: true };
  if (
    !(await prisma.wishlist.findFirst({
      where: {
        id: wishlistId,
        ownerId: userId,
        archivedAt: null,
        deletedAt: null,
      },
      select: { id: true },
    }))
  )
    return { error: true };
  const user = userId;
  if ((attempts.get(user) || 0) > Date.now() - 10000) return { error: true };
  if (attempts.size > 1000)
    for (const [key, time] of attempts)
      if (time < Date.now() - 60000) attempts.delete(key);
  attempts.set(user, Date.now());
  try {
    const page = await readPublicResource(url, 4 * 1024 * 1024, "html");
    const data = parseProduct(page.bytes.toString("utf8"), page.url);
    let photo = "";
    if (data.image)
      try {
        const image = await readPublicResource(
          data.image,
          5 * 1024 * 1024,
          "image",
        );
        const bytes = await sharp(image.bytes, { limitInputPixels: 25_000_000 })
          .rotate()
          .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        if (bytes.length <= 700000) photo = bytes.toString("base64");
      } catch {}
    return { title: data.title, price: data.price, photo };
  } catch (error) {
    if (process.env.NODE_ENV !== "production")
      console.warn(
        "Product preview failed:",
        error instanceof Error ? error.message : "unknown",
      );
    return { error: true };
  }
}
