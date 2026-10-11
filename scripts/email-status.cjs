const fs = require("node:fs/promises");
const path = require("node:path");
(async () => {
  const directory = path.resolve(
    process.env.EMAIL_STATUS_DIR || ".local/email-status",
  );
  for (const outcome of ["accepted", "failed"]) {
    try {
      const report = JSON.parse(
        await fs.readFile(path.join(directory, outcome + ".json"), "utf8"),
      );
      console.log(
        `${outcome === "accepted" ? "Dernier envoi accepté" : "Dernier échec"} : ${report.at} — ${report.category}${report.status ? " (HTTP " + report.status + ")" : ""}`,
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      console.log(
        `${outcome === "accepted" ? "Envoi accepté" : "Échec"} : aucun résultat enregistré.`,
      );
    }
  }
  console.log(
    "Accepté par le fournisseur ne signifie pas livré en boîte de réception. Aucun destinataire, lien ou secret enregistré.",
  );
})().catch(() => {
  console.error("Suivi email illisible.");
  process.exitCode = 1;
});
