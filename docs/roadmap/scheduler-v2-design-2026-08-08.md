# Scheduler v2 — Clean-Room Design (2026-08-08)

Produced by a fresh top-tier model given ONLY the requirements
(scheduler-v2-requirements-2026-08-08.md) and the research verdicts
(docs/research/scheduling-approaches-2026-08.md). It never read the
existing engine. Reviewed by Fable; reconciliation notes at the end
(the owner's day-shape ruling landed after this design was commissioned).

## 1. ARCHITECTURE

Six layers, each a pure function of the previous layer's output. Only the
outermost two touch the database.

```
DB reads → L0 WorldSnapshot → L1 Auditor → L2 Matchups → L3 Cell Placement → L4 Season Fairness → Proposal → L5 Diff/Commit → DB writes
                                  │                                                                  │
                                  └── InfeasibilityFindings (no write ever happens past a failing audit) ── L6 Reports
```

### L0 — WorldSnapshot (input boundary)

One module reads everything the engine will ever see and freezes it into a
canonical, content-hashed value. Nothing downstream performs I/O.

```ts
type WorldSnapshot = {
  seasonId: string;
  config: {
    slotMinutes: number;          // 75 default
    seed: string;                 // stored on the season, only entropy source
    weights: BurdenWeights;       // integers, see L3
    keepBonus: number;            // re-solve stickiness, see §3
    promiseDefault: number;       // 10
  };
  weekends: Weekend[];            // chronological; { id, sessionId, days: DayKey[] } where DayKey ∈ {FRI, SAT, SUN}
  bookings: Booking[];            // (weekendId, gymId, day) -> { openMin, closeMin, courts, courtBuffer }
  grades: Grade[];                // { id, teamIds[] } teams sorted by id
  plan: PlanEntry[];              // (weekendId, gymId, gradeId) -> { targetGamesPerTeam: 0|1|2 }
  requests: TeamRequest[];        // { teamId, blackoutDates[], timeWindows[], stylePref?: 'ONE_DAY'|'SPREAD' }
  existingGames: ExistingGame[];  // { id, gradeId, teamAId, teamBId, weekendId, gymId, day, slot, court,
                                  //   state: 'PLAYED'|'LOCKED'|'PUBLISHED'|'DRAFT' }
};
```

Canonicalization rules: every array sorted by a total order on stable keys
(date, then id compared as strings); no object-key iteration anywhere in
the engine (lint-enforced); serialization is sorted-key JSON;
`snapshotHash = sha256(serialize(snapshot))`.

Invariants L0 owns: the snapshot is complete (the solver can never "reach
around" it) and canonical (two reads of the same world produce identical
bytes regardless of DB row order).

### L1 — Feasibility Auditor

Pure function `audit(snapshot) -> Finding[]`. Runs before every generate,
on every blackout approval, and on every plan edit. If any finding has
severity BLOCK, no solve output may be committed. All arithmetic the
messages need (§4) is computed here, from the plan and bookings alone,
before any matchup or placement work.

Checks, in order:

1. **Cell capacity (H1, H7).** For each (weekend, gym):
   `supply = Σ_days floor((close − open) / slotMinutes) × max(0, courts − courtBuffer)`.
   `demand = Σ_grades ceil(nTeams × target / 2)`. `demand > supply` is a
   BLOCK finding.
2. **Promise arithmetic (H2).** Per team:
   `reachable = Σ_weekends min(target, gamesPossibleGivenBlackouts)`.
   `reachable < promise` is a BLOCK finding unless the plan itself records
   a lower promised number, in which case it is an INFO ("plan promises 9,
   not 10") surfaced before generation, per H2's "never discovered after."
3. **Blackout pileups (H4 × H1).** Per (weekend, gym, day): if partial
   blackouts force k teams onto one day, check the one-day supply covers
   the forced load.
4. **Pin consistency (H5, H7).** Pinned games must sit inside booked
   hours, on existing courts, not overlapping each other, not inside
   approved blackouts (a blackout approved after publishing produces a
   WARN naming the collision; the engine never moves the pinned game, the
   operator must resolve).
5. **World drift.** DRAFT games referencing weekends/gyms no longer in
   the plan are listed as "will be replaced on generate."

Invariant L1 owns: **infeasibility is discovered from the promise sheet,
never from a failed solve.** The solver may assume every cell fits.

### L2 — Season Matchup Layer

Input: snapshot + audit pass. Output:

```ts
type MatchupPlan = {
  cells: Cell[];  // one per (weekendId, gymId) with any games
};
type Cell = {
  weekendId; gymId;
  games: Array<{ gradeId; teamAId; teamBId; pinnedTo?: {day, slot, court, gameId} }>;
  dayLocks: Map<teamId, DayKey>;    // from partial blackouts: "all of T's games this weekend on SUN"
};
```

Invariants L2 owns: H2 (every team's season total equals its surfaced
promise), H4 at weekend granularity (no game for a fully blacked-out team;
day-locks emitted for partial), H5 (pinned matchups are constants that
consume pair counts, weekend caps, and capacity), the ≤2-games-per-team-
per-weekend cap, and S6 (coverage before repeats, rematches spaced across
sessions). L2 never assigns times or courts.

### L3 — Cell Placement Layer

Pure function `placeCell(cell, grids, ledgerBefore) -> PlacedCell`. Input
is one (weekend, gym): its games, the per-day slot×court grids from
bookings, day-locks, style preferences, time-window requests, pinned
positions, and each participating team's season burden ledger so far.
Output: `game -> (day, slot, court)` for every game, plus the burden
increments.

Invariants L3 owns: no (day, slot, court) double-booking; no team in two
places at one time (trivially one gym, so H3 holds by construction; the
cross-gym assert stays as a safety check in L4); day-locks honored (H4 at
day granularity); pinned positions untouched; every game placed
(guaranteed placeable because L1 verified fit; see §6.11 for the escape
hatch). S1 through S5 are its objective, not its constraints.

Key structural fact the decomposition gives us: under H1 a team's grade
maps to exactly one gym per weekend, so **a team appears in at most one
cell per weekend**. Cells within a weekend are team-disjoint and can be
solved in any order (we still fix a canonical order for determinism).

### L4 — Season Orchestrator + Fairness Pass

Iterates weekends chronologically, cells within a weekend in gymId order,
threading the burden ledger: each cell sees the true accumulated burden of
its teams. After the last weekend, a bounded global repair pass revisits
future/unpinned cells to flatten the season-wide burden spread (§2.3).
Owns S1 at season scope and assembles the final `Proposal`.

### L5 — Diff / Preview / Commit

`diff(snapshot, placedSeason) -> Proposal { snapshotHash, proposalHash,
operations: (Create|Update|Delete)[] }`. Matches proposed games to
existing rows to preserve identity (§3, "game identity"). Preview renders
the Proposal. Commit takes a proposalId, re-reads the world, recomputes
snapshotHash, aborts with "the world changed since this preview, please
regenerate" on mismatch, else applies `operations` verbatim in one
transaction. **Commit never calls the solver.** This is how
preview==commit is structural rather than aspirational.

### L6 — Reports

Burden table (the fairness surface), per-team disadvantage ledger,
court-variety report (S7, report only), and the infeasibility renderer.
All read Proposal + snapshot; no logic of their own.

## 2. ALGORITHMS

### 2.1 Matchup selection (per grade, season-level)

The backbone is the circle method (Berger tables): for n teams it yields a
canonical cyclic sequence of rounds in which every pair meets exactly once
per cycle — S6's coverage guarantee for free. With a typical grade of ~12
teams and a promise of 10, the season is a partial single round-robin
(10 of 11 rounds): zero rematches, full variety. Small grades (6 teams,
promise 10) run a double cycle; that is where rematch spacing earns its
keep.

Blackouts, pinned games, and uneven plan targets mean literal Berger
rounds cannot be stamped onto weekends. The Berger sequence is the
*prior*, and each weekend is *instantiated* as an exact minimum-cost
matching:

```
for each grade g (canonical order):
  pairCount(i,j)  := seeded from PLAYED/LOCKED/PUBLISHED games   // H5 consumes history
  lastMet(i,j)    := last weekend index the pair met (or −∞)
  played(t)       := pinned game count per team
  bergerRank(i,j) := position of pair (i,j) in the canonical Berger sequence for g

  for each weekend w (chronological) where plan gives g target t ∈ {1,2}:
    for round r = 1..t:                                          // enforces ≤ 2 games/team/weekend
      eligible := teams of g, minus fully-blacked-out(w), minus teams already at r games this weekend,
                  minus teams whose remaining promise is 0        // catch-up teams may EXCEED target
      if |eligible| is odd: remove bye(w, r)                      // bye rule below
      pairCost(i,j) := W_REPEAT × pairCount(i,j)                  // coverage first (W_REPEAT dominates)
                     + W_SESSION if lastMet(i,j) in same session  // rematch spacing
                     + W_ADJ     if in adjacent session
                     − keepBonus if an existing DRAFT game has this pair at this weekend   // stickiness
                     + bergerRank(i,j) as the final numeric nudge // deterministic tiebreak
      match := exact min-cost perfect matching over eligible
      emit matched pairs into cell (w, gymOf(g,w)); update pairCount, lastMet, played
```

**Matching solver.** Exact min-cost perfect matching by bitmask DP for
n ≤ 16; for n > 16 (rare), sorted-edge greedy with deterministic
augmenting-path completion: guaranteed maximum cardinality, near-optimal
cost, fully deterministic. Ties break on the canonical pair key.

**Bye rule (odd counts).** The bye for (w, r) is deterministic: the team
farthest *ahead* of its promise pace, then a team with a partial blackout
that weekend, then highest canonical id — self-correcting toward equal
season totals.

**Catch-up credits (blackout absorption).** A team that missed games to
blackouts keeps `remaining = promise − scheduled > 0` and may take a
second game on a later weekend even when the plan target is 1, provided
the cell has spare capacity (L1 pre-verified absorbability; otherwise the
auditor already blocked with the exact per-team message). Catch-up prefers
pairing two deficit teams; the matching does this naturally because
deficit teams are the only round-2 eligibles.

**Day-locks.** After a weekend's pairs are fixed, any team blacked out on
one day gets `dayLock = the open day` in the cell. A day-locked team with
2 games is a forced same-day pair; auditor check 3 guaranteed it fits.

**Termination and complexity.** Fixed nest: grades × weekends × ≤2
rounds, each one finite matching. No iteration-to-convergence. Well under
one second on the reference world.

### 2.2 Cell placement (one weekend, one gym)

State: ≤ ~40 games onto grids of ≤ 3 days × ~8–10 slots × ≤ 6 usable
courts (≤ ~180 positions). Two phases: deterministic construction, then
monotone repair.

**Burden currency (integer weights, configurable — AS DESIGNED; see
reconciliation for the owner's 2026-08-08 ladder which re-prices this
table):**

| shape / event | designed points |
|---|---|
| two singles across days | 0 |
| same-day pair, gap 1–2 slots | 0 |
| same-day pair, gap 3–4 slots (mid wait) | 3 |
| same-day pair, gap 0 (back-to-back) | 8 |
| same-day pair, gap ≥ 5 slots (monster wait) | 12 |
| style preference violated | 5 |
| approved time-window request violated | 6 |
| first-slot game (early tally) | 1 |
| last-slot game (late tally) | 1 |

Ranking is realized through dominant weights, not strict lexicographic
ordering (research: strict lexicographic was measured trading six new
burdens to erase one).

**Fairness coupling (S1).** A cell minimizes the *marginal season
objective*:

```
cost(assignment) = Σ_teams [ (B_pre(t) + b(t))² − B_pre(t)² ]        // b(t) = burden this cell adds to t
                 + Σ_categories spreadPenalty(earlies/lates per team) // S4 convex penalty
```

The quadratic form makes one more burden point on an already-burdened team
strictly costlier than on a fresh team — S1's "no stacking" — and degrades
gracefully instead of needing a hard cap. All terms integers.

**Construction (deterministic):**

1. Partition teams-in-cell: day-locked pairs, one-day-preference pairs,
   spread-preference/default pairs, singles.
2. Choose day shapes (default per config flag; see reconciliation).
   Day loads balanced to capacity by largest-remainder apportionment,
   ties to the earlier day.
3. Order games by constrainedness: pinned first, then day-locked pairs,
   then window-requested, then same-day pairs, then singles; within class
   by descending B_pre of the more-burdened participant, then canonical
   game key.
4. Place each game at the feasible (day, slot, court) minimizing marginal
   cost; feasibility = free position, both teams free at that (day, slot),
   day-lock respected, same-day partner overlap forbidden. Tie-break:
   lowest day, then slot closest to the day's middle, then lowest court.

**Repair (bounded, monotone, deterministic).** Moves, canonical order:
relocate one game; swap two games' positions; flip a single between days;
swap two teams' day shapes (pair ↔ singles) where preferences and locks
allow. Each pass applies the best strictly-improving move (ties: smallest
resulting serialization); repeat until no improvement, capped at 50
passes. **Termination:** objective is a nonnegative integer strictly
decreasing per accepted move. **Complexity:** ≈ 4×10^4 evaluations per
pass; ~60 cells × 50 passes = well inside A6.

No multi-start: cells are tiny; every extra candidate is another
determinism surface. The seed feeds nothing (parked hook).

### 2.3 Season fairness pass (after all cells)

Compute the final ledger. While `maxBurden − minBurden` (comparable
shapes) exceeds the bound (default 25, per A3): take the highest-burdened
team, enumerate repair moves within its cells (future, unpinned games
only) judged on the season objective; apply the best strictly-improving
move. Stop at no-improvement or 200 accepted moves. This rescues
chronological threading from "early weekends spent the good slots."

## 3. THE RE-SOLVE STORY

**Triggers:** team drop/add, manual move, blackout approval, plan/booking
edit — all are "the world changed, generate again" (H8); H5 + the change
objective make output minimal.

**"Minimal" formally.** E = existing games, P ⊆ E pinned
(PLAYED ∪ LOCKED ∪ PUBLISHED ∪ live). Proposal Q admissible iff hard laws
hold and every g ∈ P appears byte-identical. Among admissible, minimize
lexicographically: (1) `|changed(Q)|` (drafts whose tuple differs +
deletions + unmatched creations); (2) the season burden objective.

**Mechanism:**
- **Pins are constants everywhere** — pre-consume pair counts, caps,
  promise totals in L2; pre-occupy grid positions in L3. No code path
  treats them as variables; A4 is structural.
- **Drafts are sticky, not fixed.** `keepBonus` makes re-choosing an
  existing draft pairing strictly cheaper unless a hard law forbids it or
  a competitor wins by more than the bonus. Placement warm-starts from
  each draft's previous (day, slot, court): keep unless infeasible or
  beaten by more than θ (default 3 points). An unchanged world region
  reproduces itself exactly.

**Ripple bounds:**
- **Drop:** unplayed games deleted; opponents become catch-up-eligible;
  credit games added in future spare capacity, deficit-vs-deficit
  preferred. Diff preview: "12 games deleted, 9 catch-up games added,
  3 existing games moved."
- **Add:** promise from remaining weekends; if the gym can't hold the
  extra games → L1 BLOCK with the Q2 message, never silent overflow.
- **Manual move:** the request becomes a pin; stickiness keeps everything
  else still. Preview: "This move bumps 2 games; burden delta: Rockets
  +3, Hawks −3."

**Game identity across regenerations:** diff matches proposed to existing
by (gradeId, canonical pair key, occurrence index), then (weekendId, pair
key); matched keep DB id (Updates), rest Create/Delete. Canonical
iteration order → deterministic.

## 4. INFEASIBILITY UX

Findings are typed objects `{ severity, weekendId?, gradeId?, teamIds?,
arithmetic, options[] }` from L1 before any write; a renderer makes words;
tests assert structure. Message exemplars:

**H1, grade does not fit its gym:**
> Weekend of Nov 7–8: Grade 7 Boys needs 24 games at The Playground, but
> the booking holds 18 (Sat: 3 courts × 4 slots, Sun: 3 courts × 2 slots,
> 0 courts held back). Short by 6 games. Options: add about 8 court-hours
> at The Playground that weekend, move Grade 7 Boys to a gym with at
> least 24 slots that weekend, or lower the weekend target from 2 games
> per team to 1 in Planning.

**H2, plan promises fewer than the guarantee:**
> Grade 7 Boys: the plan adds up to 9 games per team this season; the
> promise is 10. All 12 teams are at 9. No remaining weekend for this
> grade has spare room. Options: add a Grade 7 Boys weekend in February,
> raise one weekend from 1 game per team to 2, or record 9 as this
> grade's promised number so families see it up front.

**H2, blackout-driven per-team shortfall:**
> Riverside Rockets: approved blackouts (Jan 10–11, Jan 24–25) leave only
> 8 reachable games of the promised 10, and later weekends for Grade 8
> Girls have no spare room for catch-up games. Options: open room on
> Feb 7 (one more court-hour at Haber fits both catch-up games), or
> record 8 as this team's number.

**H4 × H1, partial-day pileup:**
> Weekend of Jan 10–11: 5 Grade 8 Girls teams are blacked out on
> Saturday, so 14 games must fit into Sunday at Haber, which holds 12.
> Two games cannot fit. Options: extend Sunday hours at Haber by 3
> court-hours, or move one blacked-out team's games to another Grade 8
> Girls weekend.

**H5 pin conflicts (re-solve):**
> Two locked games overlap: Court 2, Sat 9:00 at Six Park East holds both
> Hawks vs Lions and Comets vs Storm. The engine never moves locked
> games. Unlock one, or move it by hand first.

Rules: name the weekend by dates, grade and gym by name, show the
arithmetic (need X, have Y, short Z) with per-day breakdown, give 2–3
concrete options with real numbers. Never a bare "infeasible," never a
partial write.

## 5. DETERMINISM MECHANICS

- **Pure core:** `solve(WorldSnapshot) -> Proposal`; all I/O in snapshot
  builder + committer; lint bans Date.now/Math.random/env/object-key
  iteration in the engine directory.
- **Canonical ordering everywhere:** total-order comparators ending in id
  string compare; no comparator returns 0 for distinct elements.
- **Integer arithmetic** — no float summation-order hazard.
- **Explicit tie-breaks** named at every argmin (documented above).
- **Seed discipline:** `config.seed` is the only permitted entropy;
  nothing consumes it in this design (parked hook).
- **Preview==commit structurally:** commit replays stored operations
  after snapshotHash verification; the solver is unreachable from commit.
- **CI gate:** golden-world triple-run byte-diff + shuffled-input fixture
  proving read-order independence (A5).

## 6. FAILURE MODES & RISK REGISTER

1. **Odd team counts** — rotating pace-correcting byes; where arithmetic
   makes equality impossible, auditor names exact per-team counts first.
2. **Tiny grade sharing a gym with a big grade** — one fungible court
   pool; early/late tallies compared within grade cohorts; ledger makes
   residual imbalance visible.
3. **Late-season blackout pileups** — auditor runs at blackout APPROVAL
   time: "approving this leaves Rockets at 8 of 10 with no catch-up
   room" before approving, not in March.
4. **Small-grade double round-robins vs spacing** — cost-based spacing
   degrades gracefully; report shows violations instead of deadlock.
5. **Style pref vs day-lock conflict** — forced same-day pair,
   best-effort by design; table shows the miss.
6. **Matchup dead-ends late season** — rare at promise ≤ n−1; bounded
   matchup repair (swap two pairings between two weekends of one grade)
   runs after L2 if any same-session rematch was emitted.
7. **End-of-season ledger imbalance** — the L4 global pass; caps are
   cheap to raise at this problem size.
8. **Manual-move storms** — pins are hard input; auditor reports exact
   conflicts; the engine never resolves a pin conflict by moving a pin.
9. **Friday windows** — FRI is a third day key; FRI+SAT singles = the
   same zero-burden shape; preview labels Friday games clearly.
10. **Booking shrinks after publishing** — H5 wins; screaming WARN;
    never a quiet "fix."
11. **L1 passes but placement can't finish** (adversarial day-locks +
    pins; counting is necessary, not sufficient) — L1 runs the stronger
    per-day check; placement carries a first-fit completion fallback;
    if even that fails, abort before any write naming the cell and the
    binding day-locks. An event with a test, never silent degradation.
12. **Determinism leaks via the DB** — snapshot canonicalization + the
    shuffled fixture; new inputs must enter through the snapshot type.
13. **Slot-grid remainders** — "23 min unused before close at Haber Sat"
    surfaces truncation honestly (H7).

## 7. DESIGNER'S PUSHBACK (verbatim positions)

- **Q1:** recommends Sat+Sun singles as the engine default with per-team
  override, shipped as a league-level config flag. (Owner has since ruled
  otherwise — see reconciliation.)
- **A3 as written is untestable** ("same shape available" = counterfactual
  solve). Replace with: (a) max−min ≤ 25 within grade cohort; (b) per
  category, no team holds 3+ while a same-grade team holds 0. The ledger
  drill-down answers "was it avoidable" for humans.
- **H3 is nearly dead code under H1** — keep as a cheap assert (fire =
  engine bug); do NOT build travel matrices/venue clusters into this
  engine.
- **Delete or explicitly park H6's "seeded variety"** — no multi-start
  needed; every seed consumer is a preview==commit risk. Keep the field,
  wire it to nothing, say so.
- **S6 rematch spacing is over-weighted** — at 12 teams / promise 10,
  rematches don't exist; build it cost-based and simple; spend effort on
  the fairness pass instead.
- **Under-specified: home/away designation** — needed for jerseys/
  standings; recommend deterministic alternation (first meeting: lower
  canonical id home; rematch flips), report-only.
- **Under-specified: game identity across regenerations** — ratify the
  §3 diff-matching rule as a requirement or draft ids churn and
  downstream surfaces flicker.
- **Q3:** the engine never creates a 3-game weekend; makeups are operator
  pins with their own ledger line. **Q4:** weekend cadence is Planning's
  business, not the engine's.

## 8. BUILD PLAN

Ten modules, dependency order, each with its own gate; A1–A7 overall.

| # | Module | Contents | Acceptance test |
|---|---|---|---|
| 1 | `world.ts` | Snapshot builder, canonicalization, sha256 | Shuffled-row fixture → byte-identical snapshot+hash |
| 2 | `audit.ts` | All L1 checks, typed findings, renderer | Crafted worlds hit every finding; reference world audits clean; zero writes on BLOCK |
| 3 | `matchups.ts` | Berger prior, min-cost matching, byes, catch-up, day-locks, pin seeding | Exact promise totals, ≤2/weekend, zero blackout violations, coverage-before-repeat per grade |
| 4 | `cell.ts` | Construction + monotone repair, shapes, pins, day-locks | Property tests: no double-booking/conflicts/lock breaks; tiny cells match brute-force optimum |
| 5 | `ledger.ts` | The burden currency (shared with the table) | Golden scores; table and engine import the same module |
| 6 | `season.ts` | Orchestrator, ledger threading, global fairness pass | A1, A2, A3(revised), A6, A7 on the reference world |
| 7 | `proposal.ts`+`diff.ts` | Identity matching, operations, snapshotHash gate | A5; commit replays without solver; stale-world abort |
| 8 | `resolve.ts` | Pins, keepBonus, warm start, ripple accounting | A4 + add-team + manual-move variants with bump counts asserted |
| 9 | `report.ts` | Burden table, ledger, court variety, infeasibility rendering | Snapshot tests; §4 messages render verbatim from findings |
| 10 | CI gates | Determinism triple-run, shuffled-input, perf budget | Green three consecutive runs |

Stages 1–2 are shippable alone (the auditor upgrades today's product
immediately). 3–6 = the engine, judged on A1–A3/A6/A7 before any write
path exists. 7–8 make it real. 9–10 close the loop.

## RECONCILIATION (Fable, after the owner's 2026-08-08 day-shape ruling)

The design was commissioned minutes before the owner's ruling landed;
three adjustments reconcile them, none structural:

1. **Default day shape = SAME-DAY, not Sat+Sun singles.** The design's
   config flag flips this without code change. Construction step 2
   defaults 2-game teams to same-day pairs; spreading happens only via
   the S3 valve (below) or per-team preference.
2. **Burden currency re-priced to the owner's ladder:** same-day gap 2–4
   slots = 0 (BEST); gap 1 slot = 1; same-day 5+ gap = X and two-dates =
   X (equal by ruling, suggest X = 6); back-to-back = effectively
   forbidden — priced at 50 AND targeted at ZERO (acceptance A7); the
   repair phase must exhaust every alternative before leaving one.
3. **The S3 iteration valve is an explicit final cell step:** after
   repair, if a team's same-day pair still holds a 5+ slot gap, the
   flip-single-between-days move converts that team to two dates (equal
   price by ruling, strictly better when it also frees congestion).
   The A7 report states: back-to-backs (must be 0), long gaps remaining,
   days converted to two-date shape — the numbers the owner iterates on.

Awaiting owner decisions: ratify A3-revised, home/away rule, game-identity
rule, the X price for the long-gap/two-dates tier, and the go/no-go + 
stage order for the build plan.
