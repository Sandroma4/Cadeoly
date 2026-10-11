require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { mailConfiguration } = require("../src/lib/reset-mail.ts");
const missing = [
  "AUTH_URL",
  ...(process.env.MAIL_TRANSPORT === "file"
    ? []
    : process.env.MAIL_TRANSPORT === "gmail"
      ? [
          "GMAIL_USER",
          "GMAIL_REFRESH_TOKEN",
          "MAIL_FROM",
          process.env.GMAIL_CLIENT_ID ? "GMAIL_CLIENT_ID" : "AUTH_GOOGLE_ID",
          process.env.GMAIL_CLIENT_SECRET
            ? "GMAIL_CLIENT_SECRET"
            : "AUTH_GOOGLE_SECRET",
        ]
      : ["RESEND_API_KEY", "MAIL_FROM"]),
].filter((key) => !process.env[key]);
if (missing.length) {
  console.log(
    "À renseigner dans .env : " + missing.join(", ") + ". Aucun email envoyé.",
  );
  process.exitCode = 1;
} else
  try {
    const config = mailConfiguration();
    console.log(
      config.file
        ? "Mode de test local configuré. Aucun email réel envoyé."
        : process.env.MAIL_TRANSPORT === "gmail"
          ? "Configuration Gmail API présente. Vérifier l’autorisation Gmail et activer Gmail API dans Google Cloud. Aucun email envoyé par ce contrôle."
          : process.env.MAIL_FROM?.includes("onboarding@resend.dev")
            ? "Configuration de test Resend présente : utiliser uniquement l’adresse du compte Resend. Aucun email envoyé par ce contrôle."
            : "Configuration Resend présente. Vérifier le domaine expéditeur dans Resend avant un essai depuis le formulaire. Aucun email envoyé par ce contrôle.",
    );
  } catch {
    console.log(
      "Configuration invalide : vérifier AUTH_URL, MAIL_FROM et le mode local. Aucun secret affiché, aucun email envoyé.",
    );
    process.exitCode = 1;
  }
