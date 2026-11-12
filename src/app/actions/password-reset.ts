"use server";
import { prisma } from "@/lib/prisma";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { requestReset, resetPassword } from "@/lib/password-reset-service";
import { mailConfiguration, sendResetMail } from "@/lib/reset-mail";
import { allowAccountAttempt } from "@/lib/account-service";
import { requestIp } from "@/lib/request-ip";
export async function requestPasswordReset(form: FormData, locale: string) {
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { error: "invalidFields" };
  try {
    mailConfiguration();
  } catch {
    return { error: "emailUnavailable" };
  }
  if (!process.env.AUTH_SECRET) return { error: "emailUnavailable" };
  // Same response when limited, so the form never reveals throttling or accounts.
  if (
    !(await allowAccountAttempt(
      prisma,
      "reset-ip",
      await requestIp(),
      process.env.AUTH_SECRET,
      10,
      60,
    ))
  )
    return { success: true };
  await requestReset(
    prisma,
    email.data,
    (token) => sendResetMail(email.data, token, locale),
    process.env.AUTH_SECRET,
  );
  return { success: true };
}
export async function completePasswordReset(token: string, form: FormData) {
  const password = passwordSchema.safeParse(form.get("password"));
  if (!password.success) return { error: "invalidFields" };
  if (password.data !== form.get("confirmation"))
    return { error: "passwordMismatch" };
  return resetPassword(prisma, token, password.data);
}
