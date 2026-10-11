// Local-only OAuth authorization; credentials are written to ignored .env, never stdout.
const http = require("node:http");
const fs = require("node:fs");
const { randomBytes, createHash, timingSafeEqual } = require("node:crypto");
const email = (
  process.argv.find((value) => value.startsWith("--email="))?.slice(8) ||
  process.env.GMAIL_USER ||
  ""
)
  .trim()
  .toLowerCase();
const clientId = process.env.GMAIL_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
const clientSecret =
  process.env.GMAIL_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;
const redirectUri = "http://127.0.0.1:3008/gmail-callback";
if (
  !/^[A-Za-z0-9._%+-]+@gmail\.com$/.test(email) ||
  !clientId ||
  !clientSecret
) {
  console.error(
    "Renseigner le client Google dans .env puis lancer : npm run email:setup:gmail -- --email=adresse@gmail.com",
  );
  process.exit(1);
}
const state = randomBytes(32).toString("base64url"),
  verifier = randomBytes(32).toString("base64url");
let processing = false;
const server = http.createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Referrer-Policy", "no-referrer");
  const url = new URL(request.url, "http://127.0.0.1:3008");
  if (url.pathname !== "/gmail-callback") {
    response.writeHead(404);
    response.end();
    return;
  }
  const received = url.searchParams.get("state") || "";
  if (
    processing ||
    request.method !== "GET" ||
    !/^[A-Za-z0-9_-]{43}$/.test(received) ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(state))
  ) {
    response.writeHead(400);
    response.end("Autorisation invalide.");
    return;
  }
  processing = true;
  let failure = "Connexion au service Google impossible. Relancer la commande.";
  try {
    const code = url.searchParams.get("code");
    if (!code) {
      failure = "Autorisation refusee ou annulee dans Google. Relancer la commande.";
      throw new Error();
    }
    const result = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!result.ok) {
      failure = "Google a refuse l'echange du code OAuth. Verifier les identifiants et relancer avec un nouveau lien.";
      throw new Error();
    }
    const tokens = await result.json();
    if (!tokens.scope
        ?.split(" ")
        .includes("https://www.googleapis.com/auth/gmail.send")
    ) {
      failure = "Permission Gmail manquante. Relancer et cocher l'autorisation d'envoyer des emails en votre nom sur l'ecran Google.";
      throw new Error();
    }
    if (typeof tokens.refresh_token !== "string" || typeof tokens.access_token !== "string") {
      failure = "Google n'a pas fourni l'autorisation hors connexion. Relancer la commande.";
      throw new Error();
    }
    const identity = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!identity.ok) {
      failure = "Impossible de verifier l'identite Google. Relancer la commande.";
      throw new Error();
    }
    const user = await identity.json();
    if (user.email?.toLowerCase() !== email || user.email_verified !== true) {
      failure = "Compte Google incorrect ou non verifie. Choisir le compte Gmail dedie indique dans la commande.";
      throw new Error();
    }
    failure = "Impossible d'enregistrer l'autorisation dans le fichier .env local.";
    let source = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
    for (const [key, value] of Object.entries({
      MAIL_TRANSPORT: "gmail",
      GMAIL_USER: email,
      MAIL_FROM: `Cadéoly <${email}>`,
      GMAIL_REFRESH_TOKEN: tokens.refresh_token,
    })) {
      const line = `${key}=${JSON.stringify(value)}`;
      const pattern = new RegExp(`^${key}=.*$`, "m");
      source = pattern.test(source)
        ? source.replace(pattern, () => line)
        : source.replace(/\s*$/, "\n") + line + "\n";
    }
    fs.writeFileSync(".env", source, { mode: 0o600 });
    response.end(
      "Gmail configure pour Cadeoly. Vous pouvez fermer cette page. Aucun email envoye.",
    );
    console.log(
      "Autorisation Gmail enregistrée dans .env. Aucun secret affiché, aucun email envoyé. Redémarrer le serveur et reporter les variables privées sur Railway.",
    );
  } catch {
    response.writeHead(400);
    response.end(failure);
    console.error(failure);
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
    server.close();
  }
});
server.on("error", () => {
  console.error("Le port local 3008 est indisponible.");
  process.exitCode = 1;
  clearTimeout(timeout);
});
const timeout = setTimeout(
  () => {
    console.error("Autorisation expirée. Relancer la commande.");
    server.close();
    process.exitCode = 1;
  },
  5 * 60 * 1000,
);
server.listen(3008, "127.0.0.1", () => {
  console.log(
    "Si le projet OAuth est en mode Test, Google fait expirer cette autorisation après 7 jours. Prévoir le mode Production pour un envoi durable.",
  );
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  for (const [key, value] of Object.entries({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email https://www.googleapis.com/auth/gmail.send",
    access_type: "offline",
    prompt: "consent",
    login_hint: email,
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }))
    url.searchParams.set(key, value);
  console.log(
    "Activer Gmail API dans Google Cloud et ajouter cette URI de redirection au client OAuth : " +
      redirectUri,
  );
  console.log(
    "Ouvrir ce lien sur cet ordinateur et autoriser le compte Gmail dédié (lien valable 5 minutes) :\n" +
      url,
  );
});
