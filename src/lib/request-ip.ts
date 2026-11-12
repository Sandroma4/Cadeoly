import { headers } from "next/headers";

/** First client address set by the hosting proxy, used only for throttling. */
export async function requestIp() {
  return (
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
