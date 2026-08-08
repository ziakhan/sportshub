# Scheduling — End-to-End Audit (2026-08-08, post-v2)

Owner asked: which of yesterday's suggestions survive, plus a complete
audit of gaps/problems/missing features to plan, plus thoughts on
day-of-week configuration and playoffs.

## 1. Yesterday's suggestions — verdict

DEAD (they solved v1 problems v2 made impossible):
- The judge fix (A) — shipped in v1's last night, then retired with v1.
- LNS repair for splits (B) — no splits exist to flatten.
- The travel law + polish passes — splits are structurally impossible.
- Venue clusters as an ENGINE feature (C2) — superseded by gym groups at
  the planning layer (recorded in requirements 6b, future).

STILL ALIVE:
- **Staged publish + publishedAt pinning** — the H5 completion; the top
  structural item left.
- Planned-slack knob (C) — planning-side, engine-agnostic, still useful.
- Disadvantage ledger polish (D) — mostly done via the burden table;
  remaining: v2-native columns are in, drill-down day view could show
  the weekend shape story.
- Gym groups (composite gyms) — future, planning layer.

## 2. URGENT — found by this audit

1. **The schedule tab's "Commit whole season" still runs v1.** Preview
   runs v2; commit posts to the legacy /schedule/commit (v1 engine).
   Pressing it resurrects splits and back-to-backs and breaks
   preview==commit. Highest-priority fix: rewire commit to replay the
   v2 proposal (or route it through the one-button), and retire
   Shuffle (a v1 variety-lottery — meaningless under v2 determinism),
   Scenarios, and Delete all from this tab (kill-list items 9-14).
2. **Box timezone is a deploy blocker.** v2 anchors days at LOCAL
   midnight; correct on the owner's Mac (America/Toronto). If the box
   process runs UTC (Ubuntu default), every schedule generated THERE
   shifts again. Before any box deploy: TZ=America/Toronto in the box
   service env (or an APP_TIMEZONE-driven anchor). Verify with one
   generated game's weekday after deploy.
3. Drive re-pin debt: verify-league-tuneup, snap-stage2,
   verify-schedule-board reference the removed session chooser.
4. Quality tuning queued: same-day pairing at construction (fresh
   solves settle at ~44 two-date weekends vs ~10 when sticky; teach
   construction to place a team's weekend pair as a unit).

## 3. Day-of-week lock-in (owner's observation — CONFIRMED, real)

Measured on the live schedule: **52 of 145 teams play only ONE weekday
all season** (27 all-Sunday, 25 all-Saturday), and another ~35 are at
9-of-10 on one day. Cause: the grade→day choice falls out of
deterministic construction; nothing in the burden currency counts
weekday variety, so a grade that fits one day stays there forever.

Owner's instinct (make it a configuration) is right, because both
behaviors are legitimate products:
- Predictability: "we are a Saturday grade" lets families plan life.
- Variety: alternating frees every family's Saturdays half the season.

**Proposed config — "Weekend rhythm" (league level, planning surface):**
- Day mode: **ROTATE** (engine balances each grade's Sat/Sun across the
  season via a ledger tally — recommended default) · **FIXED** (each
  grade anchored to a day, set per grade in planning — the natural
  sibling of "a grade lives in its gym": it lives in a day too) ·
  **FREE** (today's fit-driven behavior).
- Doubleheader style: the per-team weekendStyle (both games one day vs
  split) already exists but is buried — surface it beside the day mode,
  with the league default.
- Swap action: "swap this grade's Sat/Sun on weekend N" = a planning
  edit + minimal re-solve (engine machinery already exists).
- If ROTATE ships, add a "Saturdays / Sundays" pair to the fairness
  table so the rotation is visible and auditable.

## 4. Playoffs — current state and the plan

What exists (lib/playoffs/generate.ts): bracket generation from
standings with a seed preview, BUT round 1 only with real teams (its own
comment: a "winner of semifinal 1" placeholder row can't exist), naive
time assignment, its own session, no connection to planned/booked
playoff weekends, no v2-quality placement.

Owner's ask is the right design — **schedule the structure now, name the
teams later**:
1. Playoff plan inputs: qualifiers per division (e.g. top 8), format
   (single-elim / round-robin pools / both), consolation games or not,
   which booked playoff weekends host which rounds (planning already
   has playoff-phase sessions).
2. Generate the FULL structural schedule: games carry placeholder
   participants ("Seed 1 vs Seed 8", "Winner of QF1 vs Winner of QF2")
   — needs schema room for placeholder identity (nullable team ids +
   a slot label, or a PlayoffSlot model). Times and courts placed by
   the same v2 cell placer over the playoff weekends' bookings — the
   burden ladder (no b2b, drive-time laws) applies to playoff days too.
3. Seed resolution: when regular season finalizes (or per division),
   standings fill Seed 1..N; winners propagate as results land. Public
   surfaces show "TBD — Seed 3" until then; the publish layer decides
   when families see it.
4. Auditor extends naturally: "your playoff plan needs 14 court-slots
   on Mar 7-8; Six Park holds 12."

Sizing: schema (small, additive) + generator rework (medium) + seed
resolution + public TBD rendering (medium). A clean post-v2 arc.

### Research findings (2026-08-08, two web investigations)

**NPH's real 2024-25 playoffs (verified from live Exposure Events
bracket pages, sources in the research transcript):**
- 6 boys divisions (Gr 7-12), 12 to ~28 teams each. Playoffs = one
  "Championship Weekend" per grade cluster (Mar 1-2 / Mar 8-9) — matches
  the tiered finals weekends already in our season's PLAYOFF sessions.
- **Not everybody qualifies: ~65-75% per division.** Gr 7: 8 of 12
  (clean bracket). Gr 8: **14 of 19 with top-2 seeds getting round-1
  byes**, then QF/SF/Final + a 3rd-place game. Gr 9-12 (big divisions,
  16-18 qualifiers): NOT knockout — a championship POOL/round-robin
  format producing full final standings, which is how NPH delivers its
  advertised "10-game season + 2 guaranteed playoff games."
- So NPH itself mixes formats by division size: brackets small,
  pools big, byes when the count isn't a power of 2.

**Industry conventions (multi-source):**
- Byes are pure math: byes = next-power-of-2 − field, top seeds, round 1
  only; after round 1 a bracket is always a clean power of 2. 6 teams →
  top 2 bye into semis; 10 → top 6 bye, 7-10 play in; 12 → top 4 bye.
- Seed pairing: the recursive 1-8-4-5-3-6-2-7 order; youth uses FIXED
  brackets (no reseeding found anywhere in youth practice).
- "Everybody plays" is a first-class youth pattern: X-game-guarantee
  brackets + consolation ladders exist as named products; pool-play →
  medal rounds for development-focused events.
- Tiebreakers (de facto youth standard): head-to-head → point
  differential CAPPED per game (sportsmanship rule distinctive to
  youth) → points scored → coin flip/lottery.
- Placeholder scheduling before teams are known is established platform
  practice (TeamSnap, LeagueLobster): "Seed 1", "Winner of Game 3"
  slots scheduled up front; public schedules show only resolved games.
- No universal same-day rest rule exists in youth basketball (soft
  advisories only) — our zero-b2b ladder is STRICTER than industry.

### The playoff configuration (per division)

1. **Qualifiers**: a number, "all", or "top %" (NPH's real band is
   65-75%; suggest defaults from division size, bracket-friendly).
2. **Format**: BRACKET (single-elim; auto-byes by the formula; optional
   3rd-place game; optional consolation bracket) · POOLS (round-robin
   pools ~4 → medal round; the guaranteed-games shape for big
   divisions) · GUARANTEE (X-game guarantee with consolation ladder).
3. **Guaranteed playoff games**: a promised number (NPH promises 2) the
   chosen format must satisfy — audited against booked weekend capacity
   BEFORE generating, same voice as the season auditor.
4. **Seeding**: standard recursive pairing, fixed bracket; tiebreaker
   chain configurable with the capped-differential youth default.
5. **Placement**: the full structural schedule (placeholders) placed by
   the v2 cell placer into the booked playoff weekends; the day-shape
   ladder applies (zero b2b holds in playoffs too, which beats industry
   practice); public shows TBD until seeds/winners resolve.
6. **Weekend mapping**: grade clusters to finals weekends, exactly as
   the real NPH calendar already books them.

## 5. Missing-features inventory (plan for the future)

Game-level operations:
- **Add a game manually** (makeup/exhibition): exists partially via
  admin game creation; needs a first-class flow that pins the new game
  and shows the ripple.
- **Remove a game**: per-game delete exists, but nothing re-opens the
  promise (teams silently sit at 9 of 10; the table shows Games short
  but no repair offer). Needs: delete → "these 2 teams drop below the
  promise; add a catch-up game on weekend N?" flow.
- **Manual move with consequences**: the design's "this move bumps 2
  games; burden delta: Rockets +3" preview — engine ready (pins +
  minimal re-solve), UI not built.
- **Postponement/cancellation flow** (weather): cancel a day →
  absorbability check (the research's 10-13% cancellation reality) →
  catch-up placement into spare capacity.

Team-level operations:
- **Team drops/adds mid-season**: engine proven (A4: everyone re-whole,
  73%+ untouched); needs the UI flow with ripple preview.

Publishing & trust:
- **Staged publish by session + session locks + publishedAt pinning**
  (H5 completion) — the biggest missing piece of the v2 contract.
- Change notifications when a published game moves.
- Per-team schedule export (iCal) on the public surfaces.

Engine/infra:
- eslint determinism fence for lib/scheduler-v2 (no Date.now/random/
  key-order iteration), CI triple-run byte-diff + A6 perf budget.
- Same-day pairing construction tuning (twoDates 44 → ~10 target).
- Day-of-week rotation (section 3).
- Court-variety: currently a tie-break; top-court % can still run high —
  acceptable per S7 (report-only), revisit only if the owner cares.

Later (recorded, not planned):
- Gym groups (composite gyms) at planning.
- Cross-league joint planning (org planner v2).
- Referee assignment against the generated schedule.

## 6. Recommended order

1. Kill-list pass: commit/Shuffle/Scenarios/Delete-all rewired or
   removed (fixes the URGENT v1 trap) + drive re-pins.
2. Staged publish + locks + publishedAt pinning.
3. Weekend rhythm config (day mode + doubleheader style + swap action).
4. Playoffs arc (structure-now-teams-later).
5. Game/team operation flows (add/remove/move with ripple previews).
6. CI fences + pairing tuning alongside.
