require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
// Sending requires an explicit operator action; ordinary invocation is a dry run.
if (!process.argv.includes("--send")) {
  console.log(
    "No email sent. To run scheduled reminders: node --env-file-if-exists=.env scripts/email-reminders.cjs --send",
  );
} else {
  const { PrismaClient } = require("@wishi/prisma-client");
  const { runEmailReminders } = require("../src/lib/email-reminders.ts");
  const {
    sendReminderMail,
    mailConfiguration,
  } = require("../src/lib/reset-mail.ts");
  const db = new PrismaClient();
  Promise.resolve()
    .then(() => {
      mailConfiguration();
      return runEmailReminders(db, sendReminderMail);
    })
    .then(({ sent, failed }) => {
      console.log(`Reminder emails accepted: ${sent}; failed: ${failed}`);
      if (failed) process.exitCode = 1;
    })
    .catch(() => {
      console.error(
        "Reminder run failed; check email configuration and database. Unfinished deliveries can retry after 20 minutes.",
      );
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
