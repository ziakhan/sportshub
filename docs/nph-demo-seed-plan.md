# NPH production demo world — seed plan v2 (2026-07-07)

> **STATUS: BUILT + REHEARSED LOCALLY 2026-07-07.** `scripts/seed-nph-demo.ts`
> — world builds in ~20s, reset-idempotent. Local noise scrubbed (1,668 test
> users, sim tenants, old showcase). Full login audit green (§10). Chat v1.5
> shipped alongside. AWAITING OWNER: deploy train (push + runbook #10) before
> the prod run (`--report` → `--scrub-noise` → seed with `--yes-prod`).

One deterministic script (`scripts/seed-nph-demo.ts`) that builds a complete,
believable demo universe: real Toronto + West End NPH clubs, the full
tryout → offer → roster → league pipeline with history, TWO leagues (one
mid-season, one open for live tryout demos), and memorable logins.
Supersedes `scripts/seed-showcase.ts`.

v2 changes after owner review: real NPH grade-division structure (32 teams,
16 clubs incl. West United + Burlington Force + West End cohort), a second
OPEN league so tryouts make sense mid-season, one-command demo reset,
prod test-noise cleanup, chat mechanics documented + v1.5 options.

---

## 1. Why these numbers — the real NPH (from docs/research census)

NPH 2025-26 ran **230 team entries across 121 clubs** on three properties:
- **Showcase League F/W (146 entries)** — grade divisions: Gr7 ×12, Gr8 ×9,
  **Gr9 ×25, Gr10 ×42, Gr11 ×24, Gr12 ×26**, JrGirls ×8, in conferences
  (ARETE / PRIME / GAME SPEAKS / DMV CHILL)
- **D1 League (60)** — JrGirls/SrGirls/JrBoys/Scholastic/Academy
- **NPA (14) / WNPA (10)** — national prep, single divisions

So the *Showcase League* is the many-teams, many-age-groups league. The v1
plan's 14 teams was an artificial scale-down. v2 models the SL properly at
demo scale: **4 grade divisions × 8 teams = 32 teams** — big enough to feel
real, small enough to seed in minutes and audit by hand. (Real SL Gr10
alone has 42 entries; we can always grow later.)

## 2. Clubs — 16 real NPH programs, Toronto + West End

All names come straight from the census. 12 already exist as UNCLAIMED
tenants from the 188-club import → **adopted** (ACTIVE + owner + branding,
demo-tagged for clean wipe, restored to UNCLAIMED on reset). 4 created.

| # | Club | Region | Tenant | Teams (division) |
|---|---|---|---|---|
| 1 | **Toronto Lords** ⭐ primary demo club | Toronto | adopt `toronto-lords-basketball` | Gr8, Gr9, Gr11 |
| 2 | North Toronto Huskies | Toronto | create | Gr10, Gr11 |
| 3 | North York Lions | North York | adopt `north-york-lions` | Gr9, Gr10 |
| 4 | City Above Elite | Toronto | adopt `city-above-elite` | Gr8, Gr10 |
| 5 | Against The Six Prep | Toronto | adopt `against-the-six-prep` | Gr11 |
| 6 | Royal Crown | Scarborough | adopt `royal-crown-school` | Gr9, Gr10 |
| 7 | Uchenna Academy | Toronto | create | Gr11 |
| 8 | Kings Court | Hamilton | adopt `kings-court-academy` | Gr8, Gr9 |
| 9 | **West United Prep** | West GTA | adopt `west-united` | Gr10, Gr11 |
| 10 | **Burlington Force** | Burlington | adopt `burlington-force-elite` | Gr9, Gr10 |
| 11 | Burloak Elite | Burlington/Oakville | adopt `burloak-elite` | Gr8, Gr9 |
| 12 | Mississauga Monarchs | Mississauga | adopt `monarchs-basketball-rep-aau` | Gr8, Gr9 |
| 13 | Oakville Panthers | Oakville | create | Gr9, Gr10 |
| 14 | CKATT Basketball | Mississauga | adopt `ckatt-cooksville` | Gr8, Gr10 |
| 15 | PDM Basketball | Oakville | adopt `pdm-basketball` | Gr8, Gr11 |
| 16 | Polaris Prep | Burlington | adopt `polaris-prep` | Gr10, Gr11 |

= 8 teams per division (Gr8/Gr9/Gr10/Gr11), 32 teams. Toronto Lords +
Burlington Force get the **Featured** flag (gold spotlight on /club browse).
Reviews (12–15, 4–5★ with text) spread across clubs; city pills give
Toronto / Burlington / Mississauga / Oakville "near me" filtering.

## 3. Two leagues — the answer to "tryouts while the league runs"

Real clubs recruit for the *next* season mid-season — and the demo makes
that literal with two leagues:

**League A (running): NPH Showcase League — Winter 2026** · owner `owner-nph@`
- 4 grade divisions × 8 teams, rosters finalized + locked, submitted long ago
- Full schedule at 3 real-named venues (Toronto/Mississauga/Burlington):
  28 games per division = **112 games**: **~64 COMPLETED** (full
  play-by-play, box scores, PlayerStat, auto-recaps w/ covers → standings +
  leaders + team/player pages), **3 LIVE right now**, **~45 SCHEDULED** over
  the next three weekends
- Referees assigned across completed/live/upcoming; completed games carry
  referee sign-off (signature on scoresheet, verified badge)
- Each club has a PAID $3,990 "team entry — Winter 2026" obligation to the
  league (the real NPH SL fee) → `owner-nph` sees league revenue

**League B (open): NPH Spring Circuit — Spring 2026** · same owner
- Registration OPEN, roster deadline ~3 weeks out
- 8 clubs recruiting NOW: spring tryouts live on the public marketplace
- 3 clubs already finalized + submitted (so League B shows submitted teams)
- **Toronto Lords is mid-pipeline — the on-stage arc:**
  1. Lords spring tryout is dated TOMORROW: 12 signups, 5 already
     checked in → open mobile **check-in**, tap kids in live
  2. Send an **offer from a template** to a checked-in kid
  3. `parent@sportshub.demo` has an **open offer** → accept it on a phone
     (package, sizes, jersey numbers, payment plan)
  4. Watch the **roster** and **Order Sheet** update
  5. **Finalize** the roster → **one-click submit** to Spring Circuit → lock

## 4. Offer templates & the pipeline history (per Winter team)

2–3 templates per club, varied so no two clubs look identical:
**Standard** (uniform+ball, $425–475, 1 payment) · **Premium** (uniform+
shoes+bag+tracksuit+ball, $749–849, 3 installments) · **Returning Player**
(uniform, $325–375, 2 installments) · **Elite All-In** (2 clubs, $999,
4 installments). Teams use different templates by grade.

Every Winter team's history (dated ~10 weeks back): published tryout →
14–16 signups → offers from templates: **10 ACCEPTED** (sizes + jersey
prefs → Order Sheet totals + CSV) · **2 DECLINED** · **1 EXPIRED** · a
couple PENDING on the spring cycle. Roster auto-formed, jerseys assigned,
submitted, locked.

**Money:** every accepted offer → PaymentObligation; ~80% PAID via recorded
offline payments (e-transfer/cash/cheque), installments partially collected
(2 of 3), a few PENDING → `/clubs/[id]/payments` shows real
**Collected / Outstanding** tiles per club. Parents see their own payment
history. (Deeper revenue reporting stays on the backlog; Stripe online
checkout needs prod env vars — owner-side.)

## 5. Chat — how it works today, and what I propose to add

**Availability: default-on for every team, zero setup.** Membership is
automatic and always current: team staff (coaches/managers), club
owners/managers, and the parents of every rostered player. Kids 13+ who
self-registered are their own account so they're in; under-13s don't have
logins (COPPA) — their parents are the members. Staff can moderate
(remove) any message; anyone can delete their own.

**How it's built:** a `TeamMessage` table + REST APIs; the chat page
**polls every 5 seconds** while open. No WebSockets — Vercel serverless
can't hold persistent connections; true realtime would come from a hosted
realtime service (Pusher/Ably) later.

**Notifications, honestly:**
| Situation | Today |
|---|---|
| Chat page open | New messages appear within ~5s |
| Elsewhere in the app | **Nothing** (deliberate v1 — no bell spam per message) |
| App closed | **Nothing** — no push. Web push = PWA + service worker + Web Push API, a real build, not started |

**Proposed chat v1.5 (small, can build before the demo — say go):**
1. **Members panel** — "who's in this chat": staff + each family with
   player names (answers "the chat interface can have all the players")
2. **Unread badges** — on the dashboard team links + team hub pill
3. **Debounced bell notification** — first unread message per channel
   notifies once (no per-message spam) until you visit the chat

Web push + realtime sockets stay on the roadmap as bigger pieces.

**Seeded chat:** every Winter team gets an 8–12 message thread (coach
announcements, parent replies, STAFF badges); Lords spring chat has a
fresh thread; demo parent is active in two chats.

## 6. Repeatable demos — one command

`npx tsx scripts/seed-nph-demo.ts --reset` = wipe world + reseed
deterministically. Everything you did live on stage (check-ins, the
accepted offer, the submitted roster, chat messages you typed) is erased
and the exact pre-demo state comes back. Run it before every demo.

Wipe is surgical: only rows tagged to this world (`@sportshub.demo`
accounts, demo-tagged tenants/league/posts). Adopted real tenants revert
to UNCLAIMED. The other ~172 imported clubs and real user accounts are
never touched.

## 7. Cleaning up existing noise (your "wipe some of this data" ask)

The script gets two extra modes:
- `--report` — dry run: lists every tenant that is NOT from the 188-club
  import and NOT part of this demo world (i.e., test-created noise), plus
  stray test accounts (`*.world`, `*.local`, `@sportshub.test`,
  `@showcase.demo`), with row counts — you review the list
- `--scrub-noise` — deletes what `--report` listed (old showcase world
  included by default)

Nothing is deleted without you seeing the report first.

## 8. Script design & safety

Deterministic RNG · idempotent · reuses proven showcase machinery
(game-event generator, round-robin scheduler, referee sign-off, recap
publisher) · batched inserts (~800 users, ~550 offers, ~8k game events —
minutes, not hours) · **prod rail:** prints `SELECT current_database()` +
host and requires `--yes-prod` for any non-localhost DB · prints the full
credentials cheat sheet on completion.

## 9. Execution order (unchanged — nothing moves without your go)

1. You approve v2 (+ answer open questions below)
2. I build the script, run **locally**, full per-login surface audit, fix
   anything empty
3. You click through localhost
4. **Deploy train (your explicit go):** push local commits → Vercel; apply
   Neon runbook #10 (chat/check-in/featured schema must exist on prod)
5. `--report` on prod → you approve scrub → seed with `--yes-prod`
6. Spot-check prod together with the cheat sheet

## 10. Open questions

1. Chat v1.5 (members panel + unread badges + debounced bell) — build
   before the demo, or data first and chat v1.5 after?
2. Password: keep `TestPass123!` everywhere?
3. Girls division (real SL has JrGirls) — add one in this pass or later?
4. Demo parent display name "Jordan Reyes" ok, or your name?
5. Anything missing from the club list in §2?

---

## Appendix — ALL credentials (also printed by the script)

**Password for every account: `TestPass123!`** · Referee PIN: **1234**

| Login (@sportshub.demo) | Who / role |
|---|---|
| `admin@` | Platform admin |
| `owner-nph@` | NPH league owner (both leagues) |
| `owner-lords@` | Toronto Lords ⭐ primary club demo |
| `owner-huskies@` | North Toronto Huskies |
| `owner-lions@` | North York Lions |
| `owner-cityabove@` | City Above Elite |
| `owner-six@` | Against The Six Prep |
| `owner-crown@` | Royal Crown |
| `owner-uchenna@` | Uchenna Academy |
| `owner-kings@` | Kings Court |
| `owner-west@` | West United Prep |
| `owner-force@` | Burlington Force |
| `owner-burloak@` | Burloak Elite |
| `owner-monarchs@` | Mississauga Monarchs |
| `owner-panthers@` | Oakville Panthers |
| `owner-ckatt@` | CKATT Basketball |
| `owner-pdm@` | PDM Basketball |
| `owner-polaris@` | Polaris Prep |
| `parent@` | ⭐ Demo parent — 2 kids, open offer, payments, chat |
| `parent2@` | Second parent — declined/expired history |
| `coach-<club>-gr<N>@` (e.g. `coach-lords-gr9@`) | Head coach per team (32) |
| `ref-mike@` `ref-sarah@` `ref-james@` `ref-priya@` | Referees, PIN 1234 |
| `parent-<club>-NN@` | ~300 generated background parents (never needed) |
