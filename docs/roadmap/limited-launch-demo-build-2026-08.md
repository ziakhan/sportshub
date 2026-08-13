---
updated: 2026-08-12
tags: [theme/launch, type/design, status/building]
---

# Limited Launch — Demo Experience Build (design, 2026-08-12)

**Goal:** open the public site pre-launch: anyone can browse a curated, finished demo league; signing up unlocks a persona demo of the full app; every interactive itch converts to signup. One switch turns the whole demo era off on launch day.

**Content contract:** `docs/demo-world-spec-2026-08.md` (owner markup pending) defines WHAT the world contains. This doc defines HOW the machinery works. Experience rulings (owner, 2026-08-10→12): welcome pop-up → open browsing → big right-edge Demo drawer → **full signup required to enter personas** → read-only personas + whitelisted session-scoped actions with ghost replies → kill switch.

## Architecture

### 1. Demo flag (Phase 1a — this pass)
- `Tenant.isDemo` + `League.isDemo` booleans (additive, default false). Everything else derives: a season/team/game/post is demo iff its league/tenant is demo. No flag sprinkled on child tables.
- `PlatformSettings.demoModeEnabled` (singleton row) = the **kill switch**. Off: demo tenants/leagues vanish from all public listings, the drawer/pop-up never render, persona sessions refuse to start. Data stays, unlisted.
- `lib/demo/demo-mode.ts`: `isDemoModeEnabled()` (cached ~60s), `demoWhere` helpers for query exclusion, `isDemoLeague/Tenant` lookups.
- **Badges:** a `DemoBadge` component rendered on demo entity surfaces (league hub, club pages, game pages, feed cards from demo entities). Public API/queries gain an additive `isDemo` field so native can render the same badge (parity: web + mobile web in this pass; native render is a required follow-up in this arc before launch — additive field ships now so server never leads the client).
- **Directories:** real entities only in main lists; demo league shown in a labeled "Preview" section (leagues directory) when demo mode is on. Demo entity pages get `robots: noindex`.
- Existing demo world (NPH-shaped seeds) is NOT auto-flagged; the flag is for the NEW spec-built world. Seeder sets it.

### 2. Persona demo sessions (Phase 1b)
- Requires a real signed-in session (owner ruling: signup gates the demo).
- "Enter demo as X" sets a signed httpOnly cookie `demo_view={personaUserId,exp}`; personas are seeded users flagged in the spec world; entry endpoint validates: demo mode on + persona user isDemo-world member.
- Read path: a `getEffectiveViewerId()` seam beside `getSessionUserId()` — returns persona id when demo_view active AND route is a read. Impersonation law respected: APIs keep using the one helper.
- Write enforcement: middleware rejects mutating methods under demo_view with 409 `{demo:true}` → client shows the "sign up to do this for real / this is the demo" sheet. Exit-demo + whitelist (Phase 2c) bypass.
- Demo chrome: persistent banner ("You're exploring as Sam — demo data") + exit button.

### 3. Session-scoped writes + ghost replies (Phase 2c)
- Whitelisted actions (RSVP, chat send, offer accept, poll vote) execute for real but rows are stamped `demoSessionId` (from the demo_view cookie id). Reads in demo mode filter: shared demo rows + rows matching MY demoSessionId. Purge job: nightly reset deletes all demoSessionId rows.
- Ghost replies: a small responder queues canned coach replies (5-15s) to session chat messages; replies carry the same demoSessionId so only that visitor sees them.

### 4. Funnel chrome (Phase 2a/2b)
- Welcome pop-up (copy in world spec; once per browser, any entry page), right-edge Demo drawer (persona list), trigger actions on public league (follow/react/RSVP/calendar/notify → signup sheet). All render only when demo mode on.

### 5. Live game carousel (Phase 2d)
- Server driver scores 3 staggered exhibition games through the real pipeline; finalize → recap/POTG → cooldown → next fixture from the spec's pool. Exhibition flag keeps frozen standings intact. Runs as a managed loop (cron/daemon) only while demo mode on.

## Phasing
- **1a (this pass):** flag + switch + helpers + badges + directory/noindex.
- **1b:** persona sessions + gate + banner. → *launchable once 2a lands*
- **2a:** pop-up + drawer + trigger-action gates. **2b:** spec-driven seeder (world spec → data; owner markup drops in as data). **2c:** session writes + ghost replies. **2d:** carousel. **2e:** hint balloons.
- **3 (trails launch):** match-up preview + prediction post types; gamification posts after points/badges.

## Verification (testing-phase light gates)
tsc + targeted int tests per phase + one Playwright drive of: anonymous browse with badges → signup → enter persona → blocked write shows sheet → exit demo. Full sweep at the launch milestone.
