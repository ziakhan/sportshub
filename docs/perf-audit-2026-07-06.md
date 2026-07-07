# Performance audit — 2026-07-06

Owner symptom: "app loads really slow locally, the game takes a long time,
even slower on Vercel." Asked for a database-index audit. This doc records
what the audit actually found, exactly what was changed, and what was left
alone — read it before touching perf again.

## Verdict: indexes were NOT the problem

Evidence gathered (local Docker Postgres, `pg_stat_user_tables`, timed curls
against the dev server with per-request scan deltas):

- **DB is tiny.** Largest table `GameEvent`: 35k rows / 44MB. Everything
  else ≤ a few hundred rows (160 games, 552 users, 191 tenants). Every
  query answers in microseconds; the planner *correctly prefers seq scans*
  at this size (EXPLAIN confirms — don't panic when you see them).
- **Warm server renders were already fast locally**: homepage 150ms,
  dashboard 150ms, scoring console 170ms, live page 80–190ms.
- The schema already had ~100 mostly-well-chosen indexes.

## What actually causes the perceived slowness

1. **Local = Next.js dev-mode compilation.** 1.1–2.5s first-hit compile per
   route, recompile on every edit. Vanishes in `next build`. Nothing to fix.
   (Dev also logs every SQL query to the terminal — packages/db logs
   `["query"]` when NODE_ENV=development.)
2. **Vercel = query COUNT × network round-trips, not query speed.** Each
   query is a 5–20ms hop to Neon; one anonymous homepage load touched
   tables ~96 times. Serialized chains multiply.
3. **Suspected but NOT confirmed (needs owner): Neon free-tier autosuspend.**
   DB pauses after ~5 min idle; first visitor pays a 1–5s wake. Perfectly
   matches "first prod load is brutal." Check Neon console → compute →
   autosuspend, or approve a read-only latency probe. Also: serverless cold
   start pays Prisma client init (~0.5–1s).
4. **"The game takes a long time" = the live page's polling was pathological**
   (see fix #1 below): every viewer re-downloaded the full 52KB bootstrap —
   all events + rosters + a full-season standings recompute — every 10s.

## Changes shipped (all verified end-to-end 2026-07-06, suites 229u/160i green)

### 1. Incremental live-game polling
- `apps/web/src/app/(public)/live/[gameId]/live-view.tsx` — poll now sends
  `?sinceSeq=<max seq seen>` after the initial full load; merges new events,
  reconciles voids, keeps rosters/records/averages from the first response.
- `apps/web/src/app/api/live/[gameId]/route.ts` — incremental responses
  (`sinceSeq > 0`) now include `voidedSequences` (sequences ≤ sinceSeq
  currently voided). **This is load-bearing: voids MUTATE event rows**
  (PATCH /api/games/[id]/events flips `voided`), they never append — so an
  events-only incremental stream would miss the scorer's undo. Also
  hardened `sinceSeq` parsing (`Number("banana")` = NaN previously → Prisma
  threw a 500; garbage/negative now falls back to full load).
- Measured: steady-state poll went **52,301 bytes / ~10 queries (incl. full
  standings recompute) → 621 bytes / 2 queries**. Void round-trip verified
  live (void → appears in `voidedSequences` → unvoid → gone).

### 2. Lightweight can-score probe
- The live page mounted with a `GET /api/games/[id]/scoring` fetch **just to
  read `res.ok`** for the Score button — pulling the whole console bootstrap
  (rosters, all events, lock, config; ~58KB).
- `apps/web/src/app/api/games/[id]/scoring/route.ts` — added `?probe=1`:
  runs the same authz, returns `{"canScore":true}` (17 bytes) before the
  fan-out. live-view.tsx now probes. Console bootstrap path untouched.
- Verified: admin 200/17B, anonymous 401, parent 403, `probe=0` → full payload.

### 3. getCurrentUser request-memoized
- `apps/web/src/lib/auth-helpers.ts` — wrapped in `cache()` from
  `lib/queries/request-cache` (React.cache in the server runtime, identity
  under vitest). The platform layout AND the page it wraps both call it per
  render — was a duplicated 3-level include (roles→tenant/team/league) on
  every authenticated page.

### 4. Platform layout tenant counts batched
- `apps/web/src/app/(platform)/layout.tsx` — was 3 count queries **per
  tenant** per authenticated page render. Now 2 fixed queries: team rows
  with a filtered `_count.offers(PENDING)` (rows double as team count) +
  one tryout groupBy.
- Verified vs DB truth (owner-lords@sportshub.demo → Teams 4 / Tryouts 4 /
  Offers 1). NOTE: owner-nph@ has NO tenant-scoped role (league operator) —
  it never renders sidebar counts; use owner-lords@ to test this path.

### 5. getYourTeams N+1 batched
- `apps/web/src/lib/queries/home.ts` — was 2 `game.findFirst` + up to 1
  `playerStat.findMany` PER followed/kid team (≤6 teams → up to ~18 queries)
  on every signed-in homepage. Now fixed 6 queries: one completed-games
  fetch + one upcoming-games fetch (sorted; first-hit-per-team picked in
  JS; take:300 safety bound) + one OR-of-pairs stat query.
- Verified output-identical vs DB truth incl. away-win W/L orientation and
  kid stat lines (parent@sportshub.demo).

### 6. Composite indexes (for scale, not today's symptom)
- `prisma/schema.prisma`: `Game(status, scheduledAt)` (scoreboard strips,
  /scores time-window queries), `Game(seasonId, status)` (standings,
  leaders), `Tenant(status)` (homepage/nav club filters over 191 rows,
  188 of them imported UNCLAIMED).
- Pushed to LOCAL db only (`db push --skip-generate`; index-only = no
  client regen, no dev-server restart needed). **Neon: runbook #11 in
  docs/pending-deploy-actions.md — NOT applied, awaiting deploy approval.**

## Deliberately NOT done (candidates for next pass)

- **Neon autosuspend confirmation** — owner-side (console) or approved probe.
- **Chat polling architecture** — dock summary every 30s per signed-in user
  on every public page (with per-team `teamMessage.count` fan-out), open
  chats every 5s, notification bell every 30s. Fine at demo scale; it is
  the dominant Vercel-invocation cost at real scale. Owner already queued a
  "chat scalability" discussion — fold it in there (realtime/push beats
  cleverer polling).
- **getSessionUserId PlatformAdmin lookup on every API call** — could ride
  the JWT instead of a per-call `userRole.findFirst`. Touches auth claims;
  do deliberately, not as a drive-by.
- **`getSeasonStandings` / `getSeasonLeaders` full-season fetch + JS
  aggregation** — fine at ≤160 games/season; revisit if seasons grow 10×
  or leaders start appearing on hot polls again.
- **`getPublicNav` tenant sort by `teams._count desc` take 40** on every
  public page — acceptable now; cache candidate later.

## How to re-measure (the harness used here)

```bash
# per-request DB scan delta (stats flush lags ~1-2s; idle box first)
A=$(docker exec youthbasketballhub_db psql -U postgres -d youthbasketballhub -t -A \
  -c "SELECT SUM(seq_scan)+SUM(idx_scan) FROM pg_stat_user_tables")
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" <url>   # -b cookies.txt for auth
sleep 2; B=$(... same ...); echo $((B-A))
# login: POST /api/auth/callback/credentials with csrfToken from /api/auth/csrf
# accounts: TestPass123! — admin@ / owner-lords@ / parent@ @sportshub.demo
```
