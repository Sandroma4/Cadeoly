require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const {
  gmailConfiguration,
  sendGmailMail,
} = require("../src/lib/gmail-mail.ts");
const env = {
  GMAIL_USER: "cadeoly.test@gmail.com",
  GMAIL_REFRESH_TOKEN: "private-refresh",
  AUTH_GOOGLE_ID: "client",
  AUTH_GOOGLE_SECRET: "private-secret",
  MAIL_FROM: "Cadéoly <cadeoly.test@gmail.com>",
};
test("the shared mail adapter routes password recovery through Gmail instead of Resend", async () => {
  const previous = { ...process.env },
    previousFetch = global.fetch;
  const fs = require("node:fs"),
    os = require("node:os"),
    path = require("node:path");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cadeoly-gmail-"));
  try {
    Object.assign(process.env, env, {
      MAIL_TRANSPORT: "gmail",
      AUTH_URL: "https://cadeoly.up.railway.app",
      EMAIL_STATUS_DIR: directory,
    });
    let calls = 0;
    global.fetch = async (url, options) => {
      calls++;
      if (url === "https://oauth2.googleapis.com/token")
        return new Response(JSON.stringify({ access_token: "access" }));
      assert.equal(
        url,
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      );
      const raw = Buffer.from(
        JSON.parse(options.body).raw,
        "base64url",
      ).toString("utf8");
      const body = Buffer.from(
        raw.split("\r\n\r\n")[1].replace(/\s/g, ""),
        "base64",
      ).toString("utf8");
      assert.match(
        body,
        /https:\/\/cadeoly.up.railway.app\/fr\/reset-password\/synthetic-token/,
      );
      return new Response(JSON.stringify({ id: "sent" }));
    };
    const {
      mailConfiguration,
      sendResetMail,
    } = require("../src/lib/reset-mail.ts");
    assert.equal(mailConfiguration().file, false);
    await sendResetMail("guest@example.test", "synthetic-token", "fr");
    assert.equal(calls, 2);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(directory, "accepted.json"), "utf8"))
        .category,
      "gmail",
    );
  } finally {
    global.fetch = previousFetch;
    for (const key of Object.keys(process.env))
      if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test("Gmail requires OAuth credentials and the authenticated sender", () => {
  assert.equal(gmailConfiguration(env).user, env.GMAIL_USER);
  assert.throws(
    () => gmailConfiguration({ ...env, GMAIL_REFRESH_TOKEN: "" }),
    /emailUnavailable/,
  );
  assert.throws(
    () => gmailConfiguration({ ...env, MAIL_FROM: "Other <other@gmail.com>" }),
    /emailUnavailable/,
  );
});
test("Gmail refreshes OAuth over HTTPS and sends a safe UTF-8 message", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify(
        calls.length === 1
          ? { access_token: "temporary-access" }
          : { id: "sent" },
      ),
      { status: 200 },
    );
  };
  await sendGmailMail(
    {
      from: env.MAIL_FROM,
      to: "guest@example.test",
      subject: "Votre réservation",
      text: "Un petit mot : joyeux anniversaire !",
    },
    env,
    fetcher,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://oauth2.googleapis.com/token");
  assert.equal(
    calls[1].url,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  );
  const raw = Buffer.from(
    JSON.parse(calls[1].options.body).raw,
    "base64url",
  ).toString("utf8");
  assert.match(raw, /Content-Type: text\/plain; charset=UTF-8/);
  assert.match(raw, /To: guest@example.test/);
  assert.equal(raw.includes("private-refresh"), false);
  assert.equal(raw.includes("private-secret"), false);
  await assert.rejects(
    sendGmailMail(
      {
        from: env.MAIL_FROM,
        to: "guest@example.test\r\nBcc: other@example.test",
        subject: "Test",
        text: "Test",
      },
      env,
      fetcher,
    ),
    /emailUnavailable/,
  );
});
test("Gmail failures never disclose provider responses or secrets", async () => {
  const fetcher = async () => new Response("private-refresh", { status: 401 });
  await assert.rejects(
    sendGmailMail(
      {
        from: env.MAIL_FROM,
        to: "guest@example.test",
        subject: "Test",
        text: "Test",
      },
      env,
      fetcher,
    ),
    (error) => error.message === "emailDeliveryFailed",
  );
});
