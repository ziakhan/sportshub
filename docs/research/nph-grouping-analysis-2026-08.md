# Why NPH combines grades the way they do — analysis (2026-08-02)

Computed from NPH's official 2026-27 kept calendar (13 weekends, 145 teams,
725 games = a perfect 10-game delivery, every grade on exactly 5 weekends),
real approved counts (Gr7 11 · Gr8 9 · Gr9 25 · Gr10 42 · Gr11 24 · Gr12 26 ·
JrG 8), and [nph-operations-intel-2026-08.md](nph-operations-intel-2026-08.md)
(NJC/NSC share Six Park on specific weekends; 2025-26 venue residency).

## Headline

**Pooled capacity is never the constraint. The building is.** Six Park (6
courts) + The Playground (3) ≈ 132 game-slots/weekend; their peak weekend
(Nov 21–22, 84 games) is 64% utilization. What binds is WHICH building is
theirs each weekend.

## The near-proof: shared weekends drive the roster

Grade 9 and Junior Girls appear on **0 of 5** NJC/NSC-shared weekends each
(P(chance both) ≈ 1%) — and 2025-26 residency shows those are the
Six-Park-locked grades. Gr10 does play shared weekends, and it is the one
grade with a school-satellite network (19 venue/court combos) to disperse
into. **Six-Park-resident grades are kept off the weekends Six Park is not
theirs.**

Residency partition (2025-26): Gr7/Gr8/Gr12 → Playground · Gr9/Gr10 → Six
Park · Gr11/JrG flex. Feasible on all 13 weekends; produces two
97%-of-Playground weekends — the real tight spots, invisible to pooled math.

## The owner's three "odd combos"

- **Dec 12–13 = Gr8+11+12 — CONFIRMED, availability-driven.** NJC/NSC hold
  Six Park that weekend. Gr8+Gr12 = 35 of Playground's 36 slots (97%). NPH
  accepted a 2-then-7-week gap for their senior grades to do it — and the
  **March finals repeat the identical 3/3 grade split on the NJC/NSC
  championship weekend** (Mar 6–7 = 7+9+10, Mar 13–14 = 8+11+12).
- **Oct 31–Nov 1 = Gr10+12 — calendar-driven.** Halloween Saturday: every
  trick-or-treat-age grade is off. Among Halloween-safe subsets {10,12}
  uniquely balances October's two weekends (68 vs 77) and splits one grade
  per building.
- **Nov 28–29 = Gr11+12 — structural.** The senior block always takes the
  LAST weekend of each window (Nov 28, Jan 30, Feb 20). Gr11+Gr12 co-occur
  4/5 — recruiting grades in front of the same scouts, one gym, one day.

## Where our planner's assumptions are wrong

1. We optimize flat weekends; theirs are spiky on purpose (11 → 84 games).
2. We keep the two giants apart; NPH puts Gr9+Gr10 together on their two
   BIGGEST weekends (Nov 21–22, Dec 19–20), deliberately.
3. We pool capacity; their planning unit is grade→building residency.
4. Pair affinity is a business rule: Gr11+Gr12 4/5 · JrG+Gr9 4/5 ·
   Gr7+Gr12 and Gr9+Gr12 never.

## Product implications (owner to pick — none built as of 2026-08-02)

1. **Per-weekend per-venue availability as the PRIMARY planning input**, with
   a recorded reason ("Six Park → NJC/NSC"). The single change that lets the
   solver reproduce their calendar.
2. Strip view: per-building fill (not one pooled bar) + shared-weekend flags.
3. **Grade→venue residency as a first-class editable property** feeding the
   solver and a "why this grouping" explainer.
4. Solver objectives need rework: balance and giants-apart are OUR
   assumptions, contradicted by the real calendar.

Full weekend-by-weekend demand table in the 2026-08-02 session analysis
(recomputable from the kept calendar + counts above).
