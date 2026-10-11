const staticSegments = new Set([
  "fr",
  "en",
  "api",
  "database",
  "dashboard",
  "wishlists",
  "lists",
  "share",
  "events",
  "profile",
  "family",
  "reservations",
  "gift-ideas",
  "search",
  "login",
  "register",
  "quick-add",
  "feedback",
  "create",
  "auth",
  "calendar",
  "account-import",
  "account-export",
]);
function safeRoute(path: string) {
  return path
    .split(/[?#]/, 1)[0]
    .split("/")
    .map((segment) =>
      !segment || staticSegments.has(segment) ? segment : ":id",
    )
    .join("/")
    .slice(0, 200);
}
export function reportServerError(_error: unknown, route: string) {
  // Never log error messages, SQL, request bodies, cookies or dynamic path values.
  console.error(
    JSON.stringify({
      at: new Date().toISOString(),
      event: "server_error",
      route: safeRoute(route),
    }),
  );
}
export function reportSlowOperation(operation: "database", durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs < 250) return;
  console.warn(
    JSON.stringify({
      at: new Date().toISOString(),
      event: "slow_operation",
      operation,
      durationMs: Math.round(durationMs),
    }),
  );
}

export function reportBusinessEvent(
  event: "signup" | "wishlist_created" | "gift_reserved",
) {
  // Aggregate one-count events in the existing log pipeline; no personal data.
  console.info(
    JSON.stringify({ at: new Date().toISOString(), event, count: 1 }),
  );
}
