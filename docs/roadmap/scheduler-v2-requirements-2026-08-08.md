# Scheduler v2 — Requirements (clean sheet, 2026-08-08)

The owner has ordered a ground-up rethink: "Instead of tweaking the existing
model, give all the requirements to a fresh model." This document is the
complete requirement set, written for a designer who has never seen the
current engine. It deliberately says nothing about how the current engine
works. Evidence that motivated the reset: on the owner's real season, the
plan assigns every grade a gym every weekend and every grade FITS its gym,
yet the current engine still sent 74 games to other gyms, causing every one
of the season's 36 same-day gym-split team-days (probe:
scripts/analysis/grade-gym-conformity.ts).

## 1. The world

- One league season: ~145 teams in ~12 grade/division units, ~726 games,
  ~20 weekends spread over ~6 months. Weekends group into month-anchored
  SESSIONS (a session is a month with multiple weekends, never one weekend).
- Gyms are booked per weekend-day with hours and courts (e.g. Six Park
  East 6 courts, The Playground 3, Haber 6). Games occupy fixed slots
  (75 min today; configurable). A court buffer may hold courts back.
- PLANNING (a separate, existing product surface) decides per weekend:
  which grades play, in which gym, targeting how many games per team. The
  plan is the operator's promise sheet. Planning already verifies fit.
- Optional per-league Friday evening window; weekend days otherwise.
- Some teams carry approved schedule requests (time windows, blackout
  dates) and a weekend style preference (both games one day vs spread).
- Games have a lifecycle: DRAFT → published (publishedAt) → played.
  Some games get locked (isLocked) or are already played.

## 2. Hard laws (never violated; violations must be impossible, not penalized)

H1. **A grade lives in its assigned gym.** Every game of a grade-weekend is
    scheduled in the gym the plan assigned. If the grade cannot fit, the
    generator refuses with a plain-words message naming the weekend, the
    grade, the shortfall, and the operator's options (move the grade, add
    hours/court). It never silently places a game elsewhere.
H2. **The games promise.** Every team gets its guaranteed game count
    (default 10) unless the plan itself promises fewer (surfaced before
    generating, never discovered after).
H3. **Physically attendable days.** A team never plays two places at once;
    if a day is ever multi-gym (only by explicit operator choice), the
    cross-gym gap must cover the drive. Under H1 this cannot arise
    within a weekend; the law stays as a safety invariant.
H4. **Approved blackouts are absolute.** A team is never scheduled inside
    an approved blackout.
H5. **Played, live, locked and published games never move.** Regeneration
    schedules around them; rescheduling (team drops/adds, manual requests)
    changes the minimum number of future games, never reshuffles.
H6. **Determinism.** Same input → byte-identical output. Preview equals
    commit. No wall-clock, no randomness outside the seeded variety.
H7. **Capacity truth.** Only booked court-hours are used. No reserved or
    imagined capacity. Court buffer honored everywhere the same way.
H8. **Whole-season generation.** The engine always solves the entire
    season; publishing is staged by session/week (H5 protects the past).

## 3. Soft goals, ranked (optimize in this order)

S1. **Fair burden distribution.** Whatever disadvantage exists (waits,
    back-to-backs, early/late tip-offs, extra travel) is spread across
    teams: no team stacks multiples while peers have none. A universal
    per-team burden score (weights configurable) is the shared currency of
    the engine's decisions and the operator's fairness table.
S2. **Humane day shapes** (owner ruling 2026-08-08, supersedes all prior
    day-shape orderings). Same-day is the GOAL; the shape ladder:
      1. BEST: both games one day, gap of 2+ empty slots (the preferred
         breather — owner: "a preferred gap of two games in between or
         more").
      2. Next: both games one day, 1 empty slot.
      3. Equally bad, both acceptable fallbacks: a long same-day gap
         (5+ hours) OR the two games on two different dates. (Owner's
         family calculus: a 9am+9pm Saturday commits the whole day but
         frees Sunday; Sat+Sun singles nibble both days. A wash.)
      4. NEVER: back-to-back (zero gap) — unacceptable, target is ZERO.
S3. **Same-day first, spread as the iteration valve** (owner 2026-08-08):
    schedule everyone same-day with optimal gaps and drive back-to-backs
    to zero; count the long gaps that remain; if there are too many, MOVE
    those long-gap days to two-date weekends (they trade at par per S2.3).
    Per-team style preference, when stated, is honored best-effort and
    beats the engine's default.
S4. **Early/late fairness.** First-slot and last-slot games are tallied
    and spread; never concentrated on the same teams.
S5. **Approved requests honored best-effort** (they are a contract of
    effort, not law — blackouts are the law-tier version).
S6. **Matchup quality.** Round-robin coverage per grade; rematches spaced
    across sessions; opponent variety before repeats.
S7. **Court variety inside a gym: report only.** Not an optimization
    target.

## 4. Explicit non-goals / de-prioritized (owner + Fable opinion)

- (Withdrawn 2026-08-08 by owner ruling: same-day remains the goal;
  Sat/Sun spreading is the fallback valve at par with long gaps, not the
  default. See S2/S3.)
- Court-level preferences, "top court %" — reporting only (S7).
- Session-by-session generation — dead (H8). Sessions matter for
  publishing, locking, and vocabulary, not for solving.
- LLM in the runtime scheduling path — prohibited (research verdict,
  docs/research/scheduling-approaches-2026-08.md §1).
- Cross-gym optimization cleverness (venue clusters, travel matrices) —
  only relevant where an operator explicitly splits a grade across gyms;
  not part of the core loop under H1.

## 5. Shape of the solution (constraint, not design)

Because of H1, the problem decomposes: each (weekend, gym) cell contains
only its assigned grades' games and its own courts. Cells are independent
for placement; only matchup selection (who plays whom, which weekend)
spans the season. The designer should treat this decomposition as the
gift it is — pro-league systems that work in production are
decomposition-based (docs/research §2), and a cell here is tiny
(one gym, ≤ ~40 games, ≤ 6 courts).

The design must specify:
1. The season-level matchup layer (pairings per grade per weekend,
   honoring H2/H5/S6, team ≤ 2 games per weekend, blackouts).
2. The cell-level placement layer (times + courts inside one gym,
   honoring S1-S5, deterministic).
3. The re-solve story (H5): drops/adds/manual moves with minimal change.
4. The infeasibility story (H1/H2): exact plain-words messages, computed
   BEFORE any write.
5. Determinism mechanics (H6) and the acceptance tests.

## 6. Acceptance tests (the season above must pass all)

A1. 0 games outside their grade's assigned gym; 0 same-day gym splits.
A2. 726 games, 0 unscheduled, every team exactly its promise.
A3. Burden table: no team above ~25 points while any team sits at 0 with
    the same shape available (fairness = no stacked burdens).
A7. ZERO back-to-backs (S2.4) on the reference world, with a report of
    how many long-gap days remain — the owner iterates from that number
    (S3), so the engine must expose it honestly.
A4. Regenerate with 1 team dropped: only that team's games and the
    minimal ripple change; all published/locked games byte-identical.
A5. Preview == commit, run twice → identical.
A6. Full-season generate under 60s on the reference world.

## 7. Open questions for the owner

Q1. ANSWERED (owner 2026-08-08): No. Same-day first with optimal gaps;
    spreading only as the iteration valve for surplus long gaps.
Q2. When a grade outgrows its gym mid-season (late team adds): move the
    WHOLE grade to a bigger gym for affected weekends, or allow an
    explicit, operator-approved two-gym weekend (H3 gap applies)?
Q3. Is a 3-game weekend ever acceptable (makeups/bonus), and if so, is it
    a burden-table line item?
Q4. Minimum days between a team's weekends (any "no back-to-back
    weekends" rule), or is weekend cadence the plan's business only?
