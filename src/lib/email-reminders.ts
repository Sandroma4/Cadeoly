import { createHash } from "node:crypto";
import type { PrismaClient } from "@wishi/prisma-client";
import { readReminders } from "./reminders";

import { EMAIL_REMINDER_DAYS } from "./email-reminder-settings";
export { parseEmailReminderSettings } from "./email-reminder-settings";
export type ReminderMail = {
  email: string;
  locale: string;
  title: string;
  due: Date;
  href: string;
  idempotencyKey: string;
};
export async function runEmailReminders(
  db: PrismaClient,
  send: (message: ReminderMail) => Promise<void>,
  now = new Date(),
) {
  let sent = 0;
  let failed = 0;
  let cursor: string | undefined;
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const today = new Date(date + "T00:00:00Z");
  for (;;) {
    const users = await db.user.findMany({
      where: { emailRemindersEnabled: true, email: { not: null } },
      orderBy: { id: "asc" },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, email: true, locale: true, emailReminderDays: true },
    });
    if (!users.length) break;
    for (const user of users) {
      if (!EMAIL_REMINDER_DAYS.some((days) => days === user.emailReminderDays))
        continue;
      const reminders = await readReminders(db, user.id, now, { email: true });
      const candidates = [
        ...reminders.events.map((event) => ({
          id: "event:" + event.id,
          title: event.name,
          due: event.date,
          href: "/dashboard/events/" + event.id,
        })),
        ...reminders.gifts.map((gift) => ({ ...gift, id: "gift:" + gift.id })),
        ...reminders.lists
          .filter((list) => list.neededBy)
          .map((list) => ({
            id: "list:" + list.id,
            title: list.name,
            due: new Date(list.neededBy + "T12:00:00Z"),
            href: "/dashboard/wishlists/" + list.id,
          })),
      ];
      for (const candidate of candidates) {
        if (!candidate.due) continue;
        const dueDate = candidate.due.toISOString().slice(0, 10);
        const days = Math.round(
          (new Date(dueDate + "T00:00:00Z").getTime() - today.getTime()) /
            86400000,
        );
        if (days < 0 || days > user.emailReminderDays) continue;
        // Consent is checked again immediately before claiming a delivery.
        const consent = await db.user.findUnique({
          where: { id: user.id },
          select: { emailRemindersEnabled: true },
        });
        if (!consent?.emailRemindersEnabled) break;
        const id = createHash("sha256")
          .update(`${user.id}:${candidate.id}:${dueDate}`)
          .digest("hex");
        const leaseUntil = new Date(now.getTime() + 20 * 60 * 1000);
        try {
          await db.reminderDelivery.create({
            data: { id, userId: user.id, leaseUntil },
          });
        } catch (error) {
          if (
            !(
              typeof error === "object" &&
              error &&
              "code" in error &&
              error.code === "P2002"
            )
          )
            throw error;
          const claimed = await db.reminderDelivery.updateMany({
            where: { id, sentAt: null, leaseUntil: { lte: now } },
            data: { leaseUntil },
          });
          if (!claimed.count) continue;
        }
        try {
          await send({
            email: user.email!,
            locale: user.locale || "fr",
            title: candidate.title,
            due: candidate.due,
            href: candidate.href,
            idempotencyKey: id,
          });
        } catch {
          failed++;
          continue;
        }
        await db.reminderDelivery.update({
          where: { id },
          data: { sentAt: now },
        });
        sent++;
      }
    }
    cursor = users[users.length - 1].id;
  }
  return { sent, failed };
}
