export type SocialChannel = "whatsapp" | "sms" | "email";

export function socialShareUrl(
  channel: SocialChannel,
  title: string,
  message: string,
  appleMobile = false,
) {
  const body = encodeURIComponent(message);
  if (channel === "whatsapp") return `https://wa.me/?text=${body}`;
  if (channel === "sms") return `sms:${appleMobile ? "&" : "?"}body=${body}`;
  return `mailto:?subject=${encodeURIComponent(title)}&body=${body}`;
}
