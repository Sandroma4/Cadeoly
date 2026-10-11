PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Reservation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "preparationStatus" TEXT NOT NULL DEFAULT 'RESERVED',
  "accessTokenHash" TEXT,
  "itemId" TEXT NOT NULL,
  "userId" TEXT,
  "guestFirstName" TEXT,
  "guestEmail" TEXT,
  "guestSessionHash" TEXT,
  "personalMessage" TEXT,
  "messageReleasedAt" DATETIME,
  "managementTokenHash" TEXT,
  "managementExpiresAt" DATETIME,
  "recapSentAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Reservation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WishlistItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Reservation" ("id","quantity","preparationStatus","accessTokenHash","itemId","userId","createdAt","updatedAt")
SELECT "id","quantity","preparationStatus","accessTokenHash","itemId","userId","createdAt","updatedAt" FROM "Reservation";
DROP TABLE "Reservation";
ALTER TABLE "new_Reservation" RENAME TO "Reservation";
CREATE UNIQUE INDEX "Reservation_itemId_key" ON "Reservation"("itemId");
CREATE UNIQUE INDEX "Reservation_managementTokenHash_key" ON "Reservation"("managementTokenHash");
CREATE INDEX "Reservation_userId_idx" ON "Reservation"("userId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
