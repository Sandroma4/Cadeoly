require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

const event = {
  id: "event-1",
  name: "Anniversaire",
  description: "Une belle journée",
  date: new Date("2026-12-31T12:00:00Z"),
};

test("calendar exports an all-day event with exclusive next-day end and stable UID", () => {
  const { eventCalendar } = require("../src/lib/event-calendar.ts");
  const calendar = eventCalendar(event, new Date("2026-10-09T09:08:07Z"));
  assert.ok(calendar.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(calendar.endsWith("END:VCALENDAR\r\n"));
  assert.ok(calendar.includes("DTSTART;VALUE=DATE:20261231\r\n"));
  assert.ok(calendar.includes("DTEND;VALUE=DATE:20270101\r\n"));
  assert.ok(calendar.includes("UID:event-1@cadeoly\r\n"));
  assert.ok(calendar.includes("DTSTAMP:20261009T090807Z\r\n"));
});

test("calendar escapes user text and folds UTF-8 lines without splitting characters", () => {
  const { eventCalendar } = require("../src/lib/event-calendar.ts");
  const name = "É🎁".repeat(40) + "\\,;\r\nBEGIN:VEVENT\rX-EVIL:1";
  const calendar = eventCalendar({ ...event, name, description: "one\ntwo" });
  for (const line of calendar.split("\r\n")) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75);
    assert.ok(!line.includes("\ufffd"));
  }
  const unfolded = calendar.replace(/\r\n /g, "");
  assert.ok(
    unfolded.includes(
      "SUMMARY:" +
        "É🎁".repeat(40) +
        "\\\\\\,\\;\\nBEGIN:VEVENT\\nX-EVIL:1\r\n",
    ),
  );
  assert.ok(unfolded.includes("DESCRIPTION:one\\ntwo\r\n"));
  assert.equal(calendar.split("\r\nBEGIN:VEVENT\r\n").length, 2);
});

test("calendar handles leap days and omits absent descriptions", () => {
  const { eventCalendar } = require("../src/lib/event-calendar.ts");
  const calendar = eventCalendar({
    ...event,
    date: new Date("2028-02-29T12:00:00Z"),
    description: null,
  });
  assert.ok(calendar.includes("DTEND;VALUE=DATE:20280301\r\n"));
  assert.ok(!calendar.includes("DESCRIPTION:"));
});

function route(session, accessibleEvent) {
  const source = fs.readFileSync(
    "src/app/api/events/[id]/calendar/route.ts",
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  const calls = [];
  new Function("require", "exports", compiled)((id) => {
    if (id === "@/auth") return { auth: async () => session };
    if (id === "@/lib/prisma") return { prisma: "database" };
    if (id === "@/lib/event-service")
      return {
        readEvent: async (...args) => {
          calls.push(args);
          return accessibleEvent;
        },
      };
    if (id === "@/lib/event-calendar")
      return require("../src/lib/event-calendar.ts");
    throw new Error("Unexpected import: " + id);
  }, exports);
  return { GET: exports.GET, calls };
}

test("calendar endpoint requires authentication and existing event access", async () => {
  const context = { params: Promise.resolve({ id: "event-1" }) };
  const anonymous = route(null, event);
  assert.equal(
    (await anonymous.GET(new Request("https://example.com"), context)).status,
    401,
  );
  assert.equal(anonymous.calls.length, 0);
  const denied = route({ user: { id: "outsider" } }, null);
  assert.equal(
    (await denied.GET(new Request("https://example.com"), context)).status,
    404,
  );
  assert.deepEqual(denied.calls, [["database", "event-1", "outsider"]]);
  const allowed = route({ user: { id: "member" } }, event);
  const response = await allowed.GET(
    new Request("https://example.com"),
    context,
  );
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("Content-Type"),
    "text/calendar; charset=utf-8",
  );
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(
    response.headers.get("Content-Disposition"),
    'attachment; filename="cadeoly-event.ics"',
  );
  assert.ok((await response.text()).includes("SUMMARY:Anniversaire\r\n"));
  assert.deepEqual(allowed.calls, [["database", "event-1", "member"]]);
});
