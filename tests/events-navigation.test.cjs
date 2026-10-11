require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const {
  utcCalendarDay,
  eventCountdownDays,
  millisecondsUntilNextUtcDay,
} = require("../src/lib/event-countdown.ts");
const { dashboardBreadcrumbs } = require("../src/lib/dashboard-breadcrumbs.ts");

test("countdown uses UTC calendar days for today, future and past events", () => {
  const today = utcCalendarDay("2026-10-10T23:59:59Z");
  assert.equal(eventCountdownDays("2026-10-10T12:00:00Z", today), 0);
  assert.equal(eventCountdownDays("2026-10-11T12:00:00Z", today), 1);
  assert.equal(eventCountdownDays("2026-10-09T12:00:00Z", today), -1);
  assert.equal(
    eventCountdownDays(
      "2028-03-01T12:00:00Z",
      utcCalendarDay("2028-02-28T00:00:00Z"),
    ),
    2,
  );
  assert.equal(
    eventCountdownDays(
      "2026-10-26T12:00:00Z",
      utcCalendarDay("2026-10-24T23:00:00Z"),
    ),
    2,
  );
  assert.equal(
    millisecondsUntilNextUtcDay(Date.parse("2026-12-31T23:59:59Z")),
    1000,
  );
  assert.equal(
    millisecondsUntilNextUtcDay(Date.parse("2027-01-01T00:00:00Z")),
    86400000,
  );
});

test("countdown keeps server day for hydration and subscribes to day changes with cleanup", () => {
  const compiled = ts.transpileModule(
    fs.readFileSync("src/components/events/EventCountdownBadge.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const exports = {};
  let store,
    scheduled,
    cleared,
    changes = 0;
  const listeners = new Map();
  const surface = {
    addEventListener: (event, callback) => listeners.set(event, callback),
    removeEventListener: (event) => listeners.delete(event),
  };
  new Function(
    "require",
    "exports",
    "document",
    "window",
    "setTimeout",
    "clearTimeout",
    compiled,
  )(
    (id) => {
      if (id === "react")
        return {
          useSyncExternalStore: (...args) => {
            store = args;
            return args[2]();
          },
        };
      if (id === "react/jsx-runtime")
        return { jsx: (type, props) => ({ type, props }) };
      if (id === "next-intl") return { useTranslations: () => (key) => key };
      if (id === "@/lib/event-countdown")
        return require("../src/lib/event-countdown.ts");
      if (id.endsWith(".css")) return { default: { badge: "badge" } };
      throw new Error(id);
    },
    exports,
    surface,
    surface,
    (callback, delay) => {
      scheduled = { callback, delay };
      return 7;
    },
    (timer) => {
      cleared = timer;
    },
  );
  const initialDay = utcCalendarDay("2026-10-10T23:59:59Z");
  const output = exports.EventCountdownBadge({
    date: "2026-10-10T12:00:00Z",
    initialDay,
  });
  assert.equal(output.props.children, "today");
  assert.equal(store[2](), initialDay);
  assert.equal(store[1](), utcCalendarDay(Date.now()));
  const cleanup = store[0](() => changes++);
  assert.ok(scheduled.delay > 0 && scheduled.delay <= 86400010);
  scheduled.callback();
  assert.equal(changes, 1);
  listeners.get("visibilitychange")();
  assert.equal(changes, 2);
  cleanup();
  assert.equal(listeners.size, 0);
  assert.equal(cleared, 7);
});

test("breadcrumbs show known localized keys and safe parent links", () => {
  assert.deepEqual(dashboardBreadcrumbs("/dashboard"), []);
  assert.deepEqual(dashboardBreadcrumbs("/dashboard/events/event-secret"), [
    { key: "home", href: "/dashboard" },
    { key: "events", href: "/dashboard/events" },
    { key: "eventDetails" },
  ]);
  assert.equal(
    dashboardBreadcrumbs("/dashboard/wishlists/create?eventId=secret").at(-1)
      .key,
    "createWishlist",
  );
  assert.equal(
    dashboardBreadcrumbs("/dashboard/wishlists/list-secret").at(-1).key,
    "wishlistDetails",
  );
  assert.deepEqual(dashboardBreadcrumbs("/share/guest-secret"), []);
  assert.deepEqual(dashboardBreadcrumbs("/dashboard/guest-secret"), []);
  for (const section of [
    "family",
    "reservations",
    "profile",
    "feedback",
    "gift-ideas",
    "search",
  ]) {
    assert.deepEqual(dashboardBreadcrumbs(`/dashboard/${section}/`).at(-1), {
      key: section,
    });
  }
});
