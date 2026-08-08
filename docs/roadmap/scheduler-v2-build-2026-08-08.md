# Scheduler v2 — Overnight Build Report + Assumptions (2026-08-08)

Owner's order (~01:15): "go ahead and build everything... make the
decisions, make the assumptions, and print them out." Built by Fable end
to end (per the owner's model directive), from the clean-room design
(scheduler-v2-design-2026-08-08.md) against the requirements
(scheduler-v2-requirements-2026-08-08.md). v1 remains in the tree,
untouched, for rollback.

## What exists now

`apps/web/src/lib/scheduler-v2/` — seven modules:
- **world.ts** — the only DB reader; canonical, content-hashed snapshot.
- **audit.ts** — feasibility BEFORE solving: cell capacity, promise
  arithmetic, blackout day-pileups, pin conflicts. Plain-words findings
  with real numbers and options. BLOCK = nothing is ever written.
- **matchups.ts** — Berger circle-method prior + exact min-cost bitmask
  matching per weekend round; pace-correcting byes; bye-pair makeup games
  (an odd grade's weekend closes whole — the triangle law); capacity- and
  cap-checked catch-up credits; pins consume history; draft stickiness.
- **ledger.ts** — the ONE burden currency (owner's ladder): b2b 50
  (forbidden-tier), gap-1 1, gap 2-4 FREE, long gap 6 = two-date weekend 6,
  style 5, window 6, early/late 1.
- **cell.ts** — per-(weekend, gym) placement: marginal quadratic-fairness
  cost, canonical tie-breaks (day → mid-out slot → least-used court (S7)
  → court order), draft warm-start with keepTheta, monotone repair
  (relocate + swap), two-stage completion (first-fit, then evict-and-
  relocate).
- **season.ts** — chronological ledger threading + a global re-thread
  pass kept only if the season objective (Σ burden²) improves.
- **proposal.ts / index.ts** — identity-preserving diff (grade + pair +
  occurrence keeps the DB id → published URLs never churn), deterministic
  home/away alternation, operations replay in one transaction; the commit
  path cannot reach the solver.

## Acceptance gates (reference world, 145 teams / 22 grades / 5 weekends)

| gate | result |
|---|---|
| A1 games outside their grade's gym / same-day splits | **0 / 0** |
| A2 games, promises | **725 games, 0 unscheduled, all 145 teams exactly 10** |
| A4 drop-a-team re-solve | all remaining teams still exactly 10; 73% of games untouched |
| A5 determinism | byte-identical proposal across fresh runs |
| A6 runtime | **14.7s** (budget 60) |
| A7 back-to-backs | **ZERO** · 2 long gaps · 34 two-date weekends · 37 one-slot gaps |
| S6 same-weekend rematches | 0 |
| units | 58/58 (11 new v2 tests incl. brute-force matching optimality) |
| drive | verify-plan-flow 89/89 |

For contrast, v1's best result the same night: 33 splits, 2 undriveable
days, 6 back-to-backs, 6 monster waits, top burden 42. v2: none of any of
those; the old fairness table's top score fell from 42 to 12 — and most of
that 12 is the old table mis-pricing v2's deliberate 3-4 slot breathers,
which the reprice below fixes.

## Cutover (what changed in the product)

1. **The one-button plan generate** (POST plans/[planId]/generate) runs
   v2: preflight (unchanged) → apply plan world → snapshot → audit →
   solve → identity-preserving apply. BLOCK findings return as the
   route's errors, before any write.
2. **Whole-season preview** (POST schedule/preview with no legacy params)
   runs v2 and returns the same response shape plus `shape` stats. The
   legacy modes (session-scoped, scenarios, fill-gaps, shuffle) still run
   v1 until their surfaces retire (legacy inventory 9-14).
3. **Schedule tab defaults to whole-season view** — the "why did I land
   on week two" session-first landing is dead (legacy item 12).
4. **The capacity planner panel left the schedule page** (owner ruling;
   legacy item 11). The v2 auditor states real shortfalls in plain words.
5. **Fairness table repriced to the ladder**: back-to-backs 50, 5hr+
   waits 6, 3-4 slot waits 0 (the preferred breather; column relabeled
   "Waits (3-4)" with an explanatory tooltip).

## Decisions made under the owner's guidelines (the printed assumptions)

1. **v2 lives beside v1** (lib/scheduler-v2). v1 code is untouched;
   rollback = revert the two route edits. The old commit/preview legacy
   modes and their UI (session-scoped save, publish button, DELETE door)
   are NOT yet removed — they are the cutover kill list (items 9-14) and
   should go in a supervised daytime pass, not an overnight one.
2. **No schema changes.** The snapshot maps existing tables; sessions =
   weekends; `unitVenues` = the hosting law; a session's
   `targetGamesPerTeam` applies to every grade it hosts. Box and Neon
   untouched.
3. **A weekend with no plan entry hosts NOBODY** (legacy item 8
   reversed). The 11 ghost weekends in the local world host no games —
   exactly the observed real behavior.
4. **publishedAt does NOT pin yet.** H5 pins played/live/locked games
   (verified in code); pinning published games activates with the staged
   publish UI, because the owner's current testing loop regenerates
   published drafts freely. Flagged as the ONE H5 deviation.
5. **725 games, not 726.** v1's "726" included a bonus game from its
   pairing arithmetic; v2 delivers every team exactly 10 (A2's real
   contract). The 726 in the requirements was descriptive, not a law.
6. **The long-gap/two-date price is 6** (the requirements' open X);
   back-to-back is 50 + a zero-target gate rather than a literal
   constraint, so a pathological world degrades visibly instead of
   refusing to schedule.
7. **A3 adopted as revised** by the designer (testable form): the gates
   check the burden spread numerically instead of the untestable
   "same shape available" counterfactual.
8. **Home/away**: deterministic alternation (first meeting: lower
   canonical id is home; each rematch flips). Report-only.
9. **Game identity rule ratified** (design §3): grade + pair + occurrence
   → same DB id across regenerations.
10. **Stickiness convergence**: the first generate after any external
    change may move some games (the world's drafts feed the cost model);
    the second is a fixed point (A5 double-run verified). Observed: 149
    of 725 moved on the first v2-over-v2 pass, 0 on the next.
11. **Determinism discipline** is enforced by review + the double-run
    gate tonight; the design's eslint fence (no Date.now/random/key-order
    iteration in the engine dir) is a follow-up.
12. **Season fairness pass** is the design's §2.3 in spirit but
    implemented as one global re-thread (each cell re-placed knowing the
    whole season's burdens) guarded by the season objective — simpler,
    bounded, measured sufficient on the reference world (max burden 12).

## Still open (queued, needs the owner)

- Staged publish UI (publish by session/week; publishing pins) — the H5
  completion + the moment `publishedAt` starts pinning.
- Retire legacy doors: schedule/commit + session-scoped preview modes +
  DELETE schedule + one-shot publish + scenarios surface (kill list
  9-14) once the tab's remaining flows (manual game moves, publish) are
  rewired.
- v2-native fairness table columns (two-date weekends, 1-slot gaps) and
  a "shape report" card fed by proposal stats.
- The eslint determinism fence; golden-fixture CI (A5/A6 in CI).
- Gym groups (composite gyms) at the planning layer — recorded 6b.
