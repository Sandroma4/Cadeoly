const fs = require("node:fs/promises");
const path = require("node:path");
require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { mailConfiguration } = require("../src/lib/reset-mail.ts");
async function main() {
  const checks = [];
  const add = (name, ready) => checks.push({ name, ready });
  const secret = process.env.AUTH_SECRET || "";
  add(
    "Secret de session défini (32 caractères minimum, sans valeur d’exemple)",
    secret.length >= 32 && !/replace|changeme|example/i.test(secret),
  );
  try {
    const url = new URL(process.env.AUTH_URL || "");
    add(
      "Adresse publique HTTPS configurée",
      url.protocol === "https:" &&
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
        !url.username &&
        !url.password,
    );
  } catch {
    add("Adresse publique HTTPS configurée", false);
  }
  try {
    const mail = mailConfiguration();
    add(
      "Configuration email réelle présente (autorisation Gmail ou domaine Resend à vérifier)",
      !mail.file && !process.env.MAIL_FROM?.includes("@resend.dev"),
    );
  } catch {
    add(
      "Configuration email réelle présente (autorisation Gmail ou domaine Resend à vérifier)",
      false,
    );
  }
  const external = process.env.BACKUP_EXTERNAL_DIR?.trim();
  let externalReady = false;
  if (external && path.isAbsolute(external))
    try {
      const resolved = await fs.realpath(external),
        project = await fs.realpath(path.resolve(__dirname, "..")),
        relative = path.relative(project, resolved);
      externalReady =
        (await fs.stat(resolved)).isDirectory() &&
        Boolean(relative) &&
        (relative === ".." ||
          relative.startsWith(".." + path.sep) ||
          path.isAbsolute(relative));
    } catch {}
  add(
    "Destination de sauvegarde externe existante, hors du projet",
    externalReady,
  );
  for (const check of checks)
    console.log(`${check.ready ? "OK" : "À préparer"} — ${check.name}`);
  console.log(
    "Ce contrôle n’envoie aucun email, ne publie rien et n’affiche aucun secret. Il ne valide pas le fournisseur email ni l’hébergement.",
  );
  if (checks.some((check) => !check.ready)) process.exitCode = 1;
}
main().catch(() => {
  console.error("Impossible de terminer le contrôle de préparation.");
  process.exitCode = 1;
});
