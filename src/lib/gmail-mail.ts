import { emailSchema } from "./validation";
type Mail = { from: string; to: string; subject: string; text: string };
export function gmailConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const user = env.GMAIL_USER?.trim().toLowerCase();
  const clientId = env.GMAIL_CLIENT_ID || env.AUTH_GOOGLE_ID;
  const clientSecret = env.GMAIL_CLIENT_SECRET || env.AUTH_GOOGLE_SECRET;
  const refreshToken = env.GMAIL_REFRESH_TOKEN;
  const from = env.MAIL_FROM?.trim() || "";
  const match = from.match(/^([^<>\r\n]{1,120})<([^<>\r\n]+)>$/);
  const address = (match ? match[2] : from).trim().toLowerCase();
  if (
    !user ||
    !emailSchema.safeParse(user).success ||
    !clientId ||
    !clientSecret ||
    !refreshToken ||
    address !== user ||
    /[\r\n]/.test(from)
  )
    throw new Error("emailUnavailable");
  return {
    user,
    clientId,
    clientSecret,
    refreshToken,
    displayName: match?.[1].trim(),
  };
}
const encodedHeader = (text: string) =>
  `=?UTF-8?B?${Buffer.from(text).toString("base64")}?=`;
export async function sendGmailMail(
  message: Mail,
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
) {
  const config = gmailConfiguration(env);
  if (
    message.from !== env.MAIL_FROM ||
    !emailSchema.safeParse(message.to).success ||
    /[\r\n]/.test(message.to + message.subject) ||
    message.subject.length > 200
  )
    throw new Error("emailUnavailable");
  const mime = [
    `From: ${config.displayName ? encodedHeader(config.displayName) + " " : ""}<${config.user}>`,
    `To: ${message.to}`,
    `Subject: ${encodedHeader(message.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(message.text)
      .toString("base64")
      .match(/.{1,76}/g)
      ?.join("\r\n") || "",
  ].join("\r\n");
  try {
    const response = await fetcher("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error();
    const auth = await response.json();
    if (typeof auth.access_token !== "string" || !auth.access_token)
      throw new Error();
    const sent = await fetcher(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: Buffer.from(mime).toString("base64url") }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!sent.ok) throw new Error();
  } catch {
    throw new Error("emailDeliveryFailed");
  }
}
