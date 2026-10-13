"use server";
import { listOwnerId } from "@/lib/action-auth";
import { prisma } from "@/lib/prisma";
import {
  productImageFromUrl,
  productTitleFromUrl,
  productUrl,
  readPublicResource,
} from "@/lib/product-preview";
import { readProductPage } from "@/lib/product-preview-rendered";
import sharp from "sharp";
const attempts = new Map<string, number>();
export async function previewProduct(
  wishlistId: string,
  url: string,
  capturedImage?: string,
) {
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
    const page = capturedImage
      ? {
          url: productUrl(url).toString(),
          data: {
            title: "",
            price: "",
            image: productUrl(capturedImage).toString(),
          },
        }
      : await readProductPage(url);
    const data = page.data;
    const imageUrl = data.image || productImageFromUrl(page.url);
    let photo = "";
    if (imageUrl)
      try {
        const image = await readPublicResource(
          imageUrl,
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
    const linkTitle =
      !data.title && !data.price && !photo ? productTitleFromUrl(url) : "";
    return {
      title: data.title || linkTitle,
      price: data.price,
      photo,
      fromLink: Boolean(linkTitle),
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production")
      console.warn(
        "Product preview failed:",
        error instanceof Error ? error.message : "unknown",
      );
    const title = productTitleFromUrl(url);
    return title
      ? { title, price: "", photo: "", fromLink: true }
      : { error: true };
  }
}
