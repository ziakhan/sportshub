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

### Validation against NPH's real 2024-25 Grade 8 bracket (2026-08-08)

Fetched their live Exposure Events bracket page and compared structurally
against buildBracket(14, thirdPlace=true):

| Property | NPH's real bracket | Our generator | Match |
|---|---|---|---|
| Field | 14 of 19 teams | configurable, tested at 14 | ✓ |
| Byes | 2, to Royal Crown + Cooksville (top 2) | 2, to seeds 1-2 (formula) | ✓ |
| Round-1 games | 6 | 6 | ✓ |
| Bye entry | round of 8, OPPOSITE halves (they met only in placement; Royal Crown won the final from one half) | seedOrder guarantees top-2 in opposite halves | ✓ |
| 3rd-place game | yes (Cooksville won it) | thirdPlace flag | ✓ |
| Shape | R1+QF+SF Sat, F+3rd Sun (up to 3 games/day) | tier cascade, maxGamesPerDay 3 | ✓ |

NOT validated (honest limits):
- Exact seed→pairing map: the page shows no seed numbers, so whether NPH
  paired exactly 8v9/7v10 etc. is unverifiable; ours is the multi-source
  industry convention.
- Grades 9-12 pool internals: NPH's actual pool composition was not
  reconstructable (only final standings); our POOLS format is
  industry-standard practice, not an NPH replica. Their champions going
  4-0 suggests a similar-but-not-identical internal structure.
- Their game times/rest gaps: not extracted; our zero-back-to-back +
  1-slot-rest rule is deliberately stricter than anything they enforce.

### Forensic reconstruction of NPH Grades 9-12 (2026-08-08, from raw game data)

Owner's insight proved right: the games themselves were on the public
bracket pages, and who-played-whom decomposes the format exactly. This
OVERTURNS the earlier "pools" characterization (which came from a first
researcher's guess at the standings) — grades 9-11 were NOT pools:

**Grades 9/10/11 (18 teams, 18 games each) — a bye-gauntlet knockout:**
1. Seeds 1-2 bye; seeds 3-18 play Round 1 (8 games). The 8 losers are
   done after ONE game (their "2 guaranteed playoff games" marketing did
   not survive contact with the bracket).
2. Saturday gauntlet (6 games): EACH bye team plays TWO different R1
   winners (a double quarterfinal — verified: RSB beat City Above at
   2:45 and Eurostep at 6:30); the remaining four R1 winners pair off.
   10 teams -> 4 in one day.
3. Sunday final four: semifinals + final + 3rd place (4 games).
   Records confirm the shape exactly: one 4-0 champion, 3-1 finalist,
   3-1 third, 2-2 fourth, six 1-1, eight 0-1 = 36 team-games = 18 ✓.

**Grade 12 (16 teams, 16 games) — a clean 16-bracket + 3rd place**
(8+4+2+1+1), no byes needed.

**Rest-gap validation:** NPH's own double-game days kept >= 1 empty slot
between a team's games (City Above 12:15 -> 2:45; RSB 2:45 -> 6:30) —
our no-b2b + 1-slot-rest playoff rule matches their real practice.

**Can our tool express what they did?** Grade 12: yes, exactly (BRACKET,
16, 3rd place on). Grades 9-11: everything EXCEPT the double-QF
gauntlet — our byes skip into a single quarterfinal, giving top seeds
one fewer Saturday game. If the owner wants last year reproduced
verbatim, that is one named format variant to add ("bye teams play two
qualifying games"); alternatively our standard bracket is the
conventional version of the same weekend. Data caveats: a handful of
extracted scores are noisy (one Gr11 opponent missing, one Gr12
apparent duplicate, standings tab sort quirks) — structure conclusions
rest on game counts and records, which are consistent across all three
grades.

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

### "Everybody makes playoffs" at 20-28 teams — the design (owner ask)

Three formats cover every field size when nobody is cut; all three are
fully schedulable UP FRONT with placeholders:

**A. POOLS → MEDAL SUNDAY (recommended default for 17+ teams).**
- Seed everyone from regular-season standings; snake-deal into pools of
  4 (24 teams → 6 pools: pool A gets seeds 1,12,13,24; pool B
  2,11,14,23; ...). Odd remainders make one pool of 5, never a pool of
  3 (research: "one larger pool beats one tiny pool").
- Saturday: pool round-robin — 3 games per team, 36 games total for 24.
  Every pairing is known the moment seeds resolve, so the whole Saturday
  is schedulable as "Seed 1 vs Seed 12" placeholders weeks ahead.
- Sunday: medal rounds by pool finish — 6 pool winners + 2 best
  runners-up → 8-team GOLD bracket (QF/SF/F, 7 games); remaining
  runners-up + thirds → SILVER crossovers; fourths → BRONZE crossovers.
  EVERYONE plays Sunday. Guarantee: 4+ games per team.
- Sunday's slots are booked and published as CONDITIONAL games — "Pool A
  winner vs Pool F winner, 10:00 Court 2" — the universal tournament
  idiom: a family knows when and where they'd play in every scenario;
  the opponent resolves Saturday night automatically from scores.
- CAPACITY MATH, 24 teams: 36 + ~16-18 games ≈ 52-54 = exactly one
  6-court gym × 9 slots × 2 days (54). One big building hosts the whole
  division's championship weekend. The auditor states this arithmetic
  before generating.

**B. FULL-FIELD BRACKET + CONSOLATION LADDER (10-16 teams).** Everyone
enters one bracket (byes by the formula); every loser drops into a
consolation bracket ("3-game guarantee" shape). Champion + placement
games; ~1.5x the games of a pure bracket.

**C. PLACEMENT ROUNDS (NPH's own Gr 9-12 format).** No elimination at
all: every team plays exactly G championship games (NPH: teams went
4-0 etc.) against seed-adjacent opponents; the championship standings
crown the winner. Cheapest in court time (N×G/2 games), zero dependency
scheduling (all pairings seed-derived), the entire playoff publishable
the day standings finalize.

**Playoff-weekend day-shape exception (needs the owner's ruling):** the
regular-season law "never a 3-game day" cannot hold at a pools weekend
(3 pool games Saturday is the format). Proposed: playoff cells allow up
to maxGamesPerDay (default 3) with a minimum gap of 1 slot between a
team's games — back-to-backs stay forbidden even here, which is already
stricter than industry practice (no youth rest rule exists anywhere).

### What the league must actually be asked (and what it must NOT)

INPUTS (per division, ~5 questions, all with smart defaults):
1. Who qualifies: everybody / top N / top % (default: everybody for
   rec-tier, ~70% for competitive — NPH's real band).
2. Format: pools+medals / bracket+consolation / placement rounds /
   pure bracket (default by size: ≤8 pure bracket · 9-16 bracket+
   consolation · 17+ pools+medals).
3. Guaranteed playoff games per team (default 2; pools deliver 4).
4. Extras: 3rd-place game? silver/bronze tiers? (defaults: yes, yes.)
5. Max playoff games per team per day (default 3, min-gap 1 slot).

NOT inputs — derived, never asked:
- BYES: pure arithmetic (next power of 2 minus field, top seeds,
  round 1 only). The league never configures byes; asking would only
  create wrong answers.
- Bracket shape, pool count, snake seeding, total game count, court
  needs — all derive from N + format + guarantee.
- Tiebreakers ship as the youth-standard chain (H2H → capped diff →
  points → lottery) with the cap value as the only knob.

Fit check = the auditor's job, same voice: "Grade 9's everybody-in
pools weekend needs 52 court-slots on Mar 6-7; Six Park East holds 54.
It fits — 2 slots spare."

## 4b. Division formation (owner design session 2026-08-09)

The one open NPH question — do clubs choose their conference or does the
league place them — turned out to be unanswerable from their public pages
(their site says nothing about placement; the conference names do not
even appear in marketing). But the owner's three scenarios define the
product space, and each drives different software:

1. **CLUBS CHOOSE** — the league defines named divisions per grade
   (levels with descriptions); registration asks the club to pick; the
   right-placement responsibility is the CLUB's; the operator approves
   (with a move-at-approval override).
2. **LEAGUE PLACES** — registration collects grade (+ an optional
   "requested level" hint); teams pool per grade; the operator later
   forms divisions from history/reputation/strength.
3. **RANDOM/AUTOMATIC** — a strategy inside #2's tool, not a separate
   mode: the auto-split can be random, snake-by-strength, by requested
   level, or by last season's record (renewals).

**Proposed design — one season setting, "How do divisions form?":**
- Default for a small grade: ONE division, no complexity shown.
- When a grade's pool crosses a threshold (owner: "bigger than X" —
  suggest 16), the UI offers **"Make divisions"**: an auto-split
  proposal (choose strategy: random / snake by estimate / requested
  level / last-season record) rendered as a DRAG-AND-DROP board —
  operator shuffles teams between proposed divisions, names them
  (ARETE-style labels), publishes when happy. Same board idiom as the
  planning canvas.
- In CLUBS-CHOOSE mode the flow inverts: divisions exist up front,
  registration carries the picker, the board becomes an approval-time
  review (operator can still drag misplaced teams).
- Everything downstream is already division-native (scheduling units,
  standings, playoffs, gym assignment), so formation is purely a
  registration/setup-surface feature — no engine changes.
- Evidence note: NPH's flow is consistent with LEAGUE PLACES (internal
  tier labels, absent from public pages); recommend LEAGUE PLACES as
  the default mode, CLUBS CHOOSE as the config alternative.

## 4c. PROVEN: conferences are labels, grades are the scheduling pool
(2026-08-09, from NPH's live stats API — stats.northpolehoops.com, the
real system behind their Exposure shell; raw JSON saved in scratchpad)

Owner asked: which teams do small-division teams play, and were there
cross-division matchups? The answer dissolves the premise:

- **In NPH's actual system, conferences are NOT scheduling divisions.**
  Each grade is one pool; ARETE/PRIME/etc. are name suffixes, and many
  teams carry none. Grade 9 (26 teams): ARETE 9, PRIME 7, untagged 10 —
  no GAME SPEAKS at all (the census counts were approximations from
  entry text; the live API corrects them).
- **Underdog Elite (Gr9, untagged): 10 regular-season games against 10
  DISTINCT opponents** across ARETE, PRIME and untagged teams — full
  coverage-before-repeats across the whole grade. Cross-"conference"
  play everywhere.
- **Grade 12 shows clustering**: MC Elite (untagged) played DMV CHILL
  opponents 10 of 12 times and ARETE never — consistent with Gr12
  running TWO scheduling pools (ARETE ~10 | DMV+untagged ~16). So NPH
  merges labels into right-sized pools per grade, exactly the
  "scheduling group" concept.
- **The disaster that proves the auditor**: "Retro Elite - GAME SPEAKS",
  Grade 12's only GS-tagged team, finished the season **0-0-0 with ZERO
  games** — nobody ever generated it a schedule. The precise failure
  our H2 BLOCK finding ("would get 0 of the promised 10 games")
  makes impossible.

**Requirements consequence (supersedes the tiny-division worry):**
division-as-label vs pool-as-schedule is NPH's real model. Our
scheduling-groups pooling for small divisions is now an evidence-backed
requirement, not a speculation; and our demo world's isolated 2-3 team
divisions misrepresent NPH (they'd be pooled). Queued with the
division-formation design (4b).

## 4d. NPH 2025-26 playoffs decoded (2026-08-09) + THE FINAL MODEL

From the live stats API (playoff rounds carry rnd_type "F"):
- **Nearly everybody made the 25-26 playoffs**: Gr9 22/26, Gr10 37/43,
  Gr11 22/25, Gr12 21/27 (78-88%) — a big shift from 24-25's 65-75% cut.
- **Games per team: mostly 2** (the "2 guaranteed playoff games"
  promise, delivered as: everyone plays round 1, losers get a
  consolation game, winners continue), finalists reaching 3-5. Two
  playoff dates per grade.
- **Conferences did NOT fence the playoffs**: same-tag lean in older
  grades (Gr12: 9 same, 0 cross among tagged) but untagged teams cross
  everything everywhere; Gr9 playoffs as mixed as its regular season.
- 20-0 scorelines are forfeit conventions (several present).
- NPH CHANGED formats between seasons (24-25 gauntlet cut vs 25-26
  everybody-in guarantee) — the configurator must express both. Ours
  does (BRACKET with cut / everybody + consolation guarantee); the
  24-25 double-QF gauntlet stays the one unexpressed variant.

**FINAL MODEL (owner ruling 2026-08-09 + evidence):**
1. Divisions are LEAGUE-MADE at planning time (clubs may state a
   preference at registration; the league places).
2. Scheduling strictness is a league option per grade: STRICT (divisions
   schedule only within themselves) · PREFER (same-division lean, the
   NPH older-grades pattern) · OPEN (whole-grade pool, the NPH Gr9
   pattern). Conference/division is a label + standings home either way.
3. Playoffs configured per division/grade with qualifiers (everybody as
   the modern NPH default), a guaranteed-games number (2) honored via
   consolation, bracket continuing for winners; labels do not fence
   playoff draws unless STRICT.

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
