ALTER TABLE "Reservation" ADD COLUMN "preparationStatus" TEXT NOT NULL DEFAULT 'RESERVED';
ALTER TABLE "WishlistItem" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "wishlistId" ORDER BY "createdAt" DESC, "id" ASC) - 1 AS position
  FROM "WishlistItem"
)
UPDATE "WishlistItem" SET "position" = (SELECT position FROM ranked WHERE ranked.id = "WishlistItem".id);
CREATE TABLE "GiftFavorite" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GiftFavorite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WishlistItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GiftFavorite_userId_itemId_key" ON "GiftFavorite"("userId", "itemId");
CREATE INDEX "GiftFavorite_itemId_idx" ON "GiftFavorite"("itemId");
