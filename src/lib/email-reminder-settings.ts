export const EMAIL_REMINDER_DAYS = [1, 3, 7, 14] as const;
export function parseEmailReminderSettings(form: FormData) {
  const days = Number(form.get("emailReminderDays"));
  if (!EMAIL_REMINDER_DAYS.some((value) => value === days))
    throw new Error("invalidFields");
  return {
    emailRemindersEnabled: form.get("emailRemindersEnabled") === "on",
    emailReminderDays: days,
  };
}
