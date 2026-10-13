"use server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { ActionResult } from "@/lib/action-result";
import { reportBusinessEvent } from "@/lib/observability";
import { fields, registrationSchema } from "@/lib/validation";
import { auth } from "@/auth";
import { refreshWishlists } from "@/lib/refresh";
import { z } from "zod";
import { parseEmailReminderSettings } from "@/lib/email-reminder-settings";
import {
  allowAccountAttempt,
  changeAccountPassword,
} from "@/lib/account-service";
export async function registerUser(form: FormData): Promise<ActionResult> {
  const parsed = registrationSchema.safeParse(fields(form));
  if (!parsed.success) return { error: "registrationInvalid" };
  const { name, email, password } = parsed.data;
  if (!process.env.AUTH_SECRET) return { error: "unexpected" };
  if (
    !(await allowAccountAttempt(
      prisma,
      "signup-global",
      "all",
      process.env.AUTH_SECRET,
      100,
      60,
    )) ||
    !(await allowAccountAttempt(
      prisma,
      "signup",
      email,
      process.env.AUTH_SECRET,
      5,
      60,
    ))
  )
    return { error: "signupLimited" };
  try {
    await prisma.user.create({
      data: { name, email, password: await bcrypt.hash(password, 12) },
    });
    reportBusinessEvent("signup");
    return { success: true };
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "P2002"
    )
      return { error: "emailInUse" };
    return { error: "unexpected" };
  }
}
export async function changePassword(form: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  const current = form.get("currentPassword"),
    password = form.get("password");
  if (
    typeof current !== "string" ||
    typeof password !== "string" ||
    !process.env.AUTH_SECRET
  )
    return { error: "invalidFields" };
  if (password !== form.get("confirmation"))
    return { error: "passwordMismatch" };
  return changeAccountPassword(
    prisma,
    session.user.id,
    current,
    password,
    process.env.AUTH_SECRET,
  );
}
export async function updateProfile(form: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      locale: z.enum(["fr", "en"]),
    })
    .safeParse(fields(form));
  if (!parsed.success) return { error: "invalidFields" };
  let reminders;
  try {
    reminders = parseEmailReminderSettings(form);
  } catch {
    return { error: "invalidFields" };
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { ...parsed.data, ...reminders },
  });
  refreshWishlists();
  return { success: true };
}

export async function updateProfilePreferences(form: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  const locale = z.enum(["fr", "en"]).safeParse(form.get("locale"));
  if (!locale.success) return { error: "invalidFields" };
  let reminders;
  try {
    reminders = parseEmailReminderSettings(form);
  } catch {
    return { error: "invalidFields" };
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { locale: locale.data, ...reminders },
  });
  refreshWishlists();
  return { success: true };
}
