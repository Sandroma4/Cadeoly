ALTER TABLE "User" ADD COLUMN "emailRemindersEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "emailReminderDays" INTEGER NOT NULL DEFAULT 3;
CREATE TABLE "ReminderDelivery" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "leaseUntil" DATETIME NOT NULL,
 "sentAt" DATETIME,
 CONSTRAINT "ReminderDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReminderDelivery_userId_idx" ON "ReminderDelivery"("userId");
CREATE TABLE "GiftBudget" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "userId" TEXT NOT NULL,
 "scope" TEXT NOT NULL DEFAULT 'ALL',
 "currency" TEXT NOT NULL,
 "amountCents" INTEGER NOT NULL,
 "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "GiftBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GiftBudget_userId_scope_currency_key" ON "GiftBudget"("userId", "scope", "currency");
