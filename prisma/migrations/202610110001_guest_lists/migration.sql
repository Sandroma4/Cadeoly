ALTER TABLE "User" ADD COLUMN "guestTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "guestExpiresAt" DATETIME;
CREATE UNIQUE INDEX "User_guestTokenHash_key" ON "User"("guestTokenHash");
