# Audit improvements implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent tasks; validate the integrated result once.

**Goal:** Apply the six improvements accepted by the user on 2026-10-09.
**Architecture:** Preserve the existing services and UI. Keep access checks local to each read operation. Select lightweight search metadata on the server, then retrieve and render full gift records only for the requested page.
**Tech Stack:** Next.js, next-intl, Prisma/SQLite, React, Node tests, Playwright.
**Spec:** The six-row proposal in this chat, approved by “Applique”.

## Global constraints

- No added dependencies or unrelated refactoring; preserve existing uncommitted changes.
- Preserve surprise/privacy rules, revoked links and access changes.
- Validate French/English and desktop/mobile UI; no publication requested.

## Review focus

- Navigation destinations must reject external redirects and retain useful query parameters.
- Recipient fallback must handle lists without recipients.
- Request-local access caching must never survive a new read or link rotation.
- Collective reminders must not reveal inaccessible gifts or double-count entries.
- Paged search must retain accents, totals, filters, owner privacy and clamped pages.

## Task 1: Navigation and editor

Files: `src/proxy.ts`, `src/lib/return-path.ts`, `src/app/globals.css`, related tests.
- [x] Add failing tests for protected-page return paths and desktop editor width.
- [x] Preserve safe localized dashboard destinations at login.
- [x] Let an open gift editor span the gift grid without mobile overflow.
- [x] Run targeted unit checks; leave integrated browser runs to the root agent.

## Task 2: Reservations, access checks and reminders

Files: `src/lib/wishlist-service.ts` (reservation reads only), `src/lib/contribution-service.ts`, `src/lib/reminders.ts`, `src/components/dashboard/Reminders.tsx`, translations, related tests.
- [x] Add failing tests for recipients, collective reminders, inaccessible gifts and repeated access checks.
- [x] Use recipient names with owner fallback.
- [x] Create a per-read access checker shared by rows belonging to the same owner/list access context.
- [x] Include collective contributions in date-ordered reminders with a distinct translated label.
- [x] Run targeted tests with real SQLite plus query-count checks.

## Task 3: Server pagination

Files: `src/lib/wishlist-service.ts` (wishlist read only), `src/lib/gift-search.ts`, wishlist actions/pages, `src/components/wishlist/GiftBrowser.tsx`, `src/components/wishlist/WishlistView.tsx`, related tests.
- [x] Add failing tests for 49 gifts, filtered totals, accent matching, bounds and privacy.
- [x] Extend `readWishlist` with optional page/filter options, retaining compatibility for existing service callers.
- [x] Select lightweight metadata for matching/totals and load full details for at most 24 gifts.
- [x] Drive pagination/filter requests through URL parameters, retaining preview/from/share context.
- [x] Verify owner preview cannot expose reservation or contribution state.

## Integrated verification

- [x] Review all diffs, run lint, typecheck and relevant service tests.
- [x] Run Playwright once across affected flows in both locales and device projects.
- [x] Inspect desktop/mobile screenshots; resolve failures and rerun affected checks only.
- [x] Report implemented changes, verification and any remaining limitation.

## Execution ledger

- Ruling: Use lightweight metadata for existing accent-aware search and currency totals; full gift content and card rendering are bounded to 24. This avoids changing search semantics or adding a SQLite extension, while metadata processing remains proportional to list size.
- Ruling: Work in the current checkout to preserve the prior audit changes; independently assigned edits have explicit file/section ownership.

- Completed: 80 Node tests validated (78 initial passes plus 2 successful sandbox-related retries); 40 Playwright scenarios validated (35 initial passes plus 5 successful fixture/selector retries), both locales/devices. Lint and typecheck passed. Desktop editor and desktop/mobile collective-reminder screenshots inspected. Independent review and scoped re-review found no remaining material issue.
