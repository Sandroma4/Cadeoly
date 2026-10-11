import { mkdir, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { emailSchema } from "./validation";
import type { ReminderMail } from "./email-reminders";
import { gmailConfiguration, sendGmailMail } from "./gmail-mail";
async function recordDelivery(
  outcome: "accepted" | "failed",
  category: string,
  status?: number,
) {
  try {
    const directory = path.resolve(
      /* turbopackIgnore: true */ process.env.EMAIL_STATUS_DIR ||
        ".local/email-status",
    );
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = path.join(directory, randomUUID() + ".tmp");
    await writeFile(
      temporary,
      JSON.stringify({
        at: new Date().toISOString(),
        outcome,
        category,
        ...(status ? { status } : {}),
      }) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    await rename(temporary, path.join(directory, outcome + ".json"));
  } catch {
    console.error("Cadéoly email monitoring unavailable");
  }
}
export function mailConfiguration() {
  if (!process.env.AUTH_URL) throw new Error("emailUnavailable");
  const base = new URL(process.env.AUTH_URL);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  const file = process.env.MAIL_TRANSPORT === "file";
  const gmail = process.env.MAIL_TRANSPORT === "gmail";
  if (
    process.env.MAIL_TRANSPORT &&
    !["file", "gmail", "resend"].includes(process.env.MAIL_TRANSPORT)
  )
    throw new Error("emailUnavailable");
  if (
    base.username ||
    base.password ||
    !["http:", "https:"].includes(base.protocol) ||
    (!local && base.protocol !== "https:") ||
    (file && !local)
  )
    throw new Error("emailUnavailable");
  if (gmail) gmailConfiguration();
  if (
    !file &&
    !gmail &&
    (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
  )
    throw new Error("emailUnavailable");
  if (!file) {
    const from = process.env.MAIL_FROM!.trim();
    const address = from.includes("<")
      ? from.match(/^[^<>\r\n]{1,120}<([^<>]+)>$/)?.[1]
      : from;
    if (
      !address ||
      /[\r\n]/.test(from) ||
      !emailSchema.safeParse(address).success
    )
      throw new Error("emailUnavailable");
  }
  return { base, file };
}
export async function sendResetMail(
  email: string,
  token: string,
  locale: string,
) {
  const { base, file } = mailConfiguration();
  const url = new URL(
    `/${locale === "en" ? "en" : "fr"}/reset-password/${token}`,
    base,
  ).toString();
  const english = locale === "en";
  const message = {
    from: (process.env.MAIL_FROM || "Cadéoly <local@example.test>").replace(
      /^Wishi(?=\s*<)/,
      "Cadéoly",
    ),
    to: email,
    subject: english
      ? "Reset your Cadéoly password"
      : "Réinitialiser votre mot de passe Cadéoly",
    text: english
      ? `Choose a new password using this link (valid for 30 minutes, once only):\n${url}\n\nIf you did not request this, ignore this email.`
      : `Choisissez un nouveau mot de passe avec ce lien (valable 30 minutes, une seule fois) :\n${url}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet email.`,
  };
  return deliverMail(message, file);
}
export async function sendReminderMail(reminder: ReminderMail) {
  const { base, file } = mailConfiguration();
  const english = reminder.locale === "en";
  const locale = english ? "en" : "fr";
  const url = new URL(`/${locale}${reminder.href}`, base).toString();
  const settings = new URL(`/${locale}/dashboard/profile`, base).toString();
  const date = reminder.due.toLocaleDateString(english ? "en-GB" : "fr-FR", {
    timeZone: "Europe/Paris",
  });
  return deliverMail(
    {
      from: process.env.MAIL_FROM || "Cadéoly <local@example.test>",
      to: reminder.email,
      subject: english ? "Your Cadéoly reminder" : "Votre rappel Cadéoly",
      text: english
        ? `${reminder.title} — ${date}\n${url}\n\nChange or disable email reminders in your profile:\n${settings}`
        : `${reminder.title} — ${date}\n${url}\n\nModifiez ou désactivez les rappels par email dans votre profil :\n${settings}`,
    },
    file,
    reminder.idempotencyKey,
  );
}
export async function deliverMail(
  message: { from: string; to: string; subject: string; text: string },
  file: boolean,
  idempotencyKey?: string,
) {
  if (file) {
    const directory = path.resolve(
      /* turbopackIgnore: true */ process.env.EMAIL_OUTBOX_DIR || ".local/mail",
    );
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, (idempotencyKey || randomUUID()) + ".json"),
      JSON.stringify(message, null, 2),
      { flag: "wx", mode: 0o600 },
    ).catch((error: NodeJS.ErrnoException) => {
      if (!idempotencyKey || error.code !== "EEXIST") throw error;
    });
    return;
  }
  if (process.env.MAIL_TRANSPORT === "gmail") {
    try {
      await sendGmailMail(message);
    } catch {
      await recordDelivery("failed", "gmail");
      throw new Error("emailDeliveryFailed");
    }
    await recordDelivery("accepted", "gmail");
    return;
  }
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify({ ...message, to: [message.to] }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    await recordDelivery("failed", "network");
    throw new Error("emailDeliveryFailed");
  }
  if (!response.ok) {
    await recordDelivery(
      "failed",
      response.status === 401
        ? "authentication"
        : response.status === 403
          ? "sender-or-recipient"
          : response.status === 429
            ? "rate-limit"
            : "provider",
      response.status,
    );
    throw new Error("emailDeliveryFailed");
  }
  await recordDelivery("accepted", "provider", response.status);
}
