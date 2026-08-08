# How schedules really get made — research synthesis + plan (2026-08-07)

Owner questions: deterministic vs LLM-at-runtime? What else minimizes the
burden metrics (same-day gym splits, back-to-backs, waits)? Does booking
slack capacity (5/10/20%) dissolve them? Three research passes (industry,
algorithms, and a quantitative slack experiment on our own world) feed this.
Full agent findings summarized here; slack harness kept at
scripts/analysis/slack-capacity-experiment.ts for reuse.

## Verdict 1 — deterministic core, language at the rim

LLM-at-runtime for schedule generation is a NO, on evidence: 2025-26
benchmarks (R-ConstraintBench, SCHEDBench) show LLMs collapse when hard
constraints interact (feasibility ~50% for the best models) and change
output when the same problem is merely reworded — fatal against our
preview==commit byte-identical requirement. No product in a 10-vendor sweep
hands an LLM the constraint set; where "AI" is claimed (Fastbreak, Exposure)
the mechanism is classical heuristic optimization. The credible LLM role:
compiling a commissioner's plain-English rule into constraints for the
deterministic engine, and explaining trade-offs back — off the hot path.

## Verdict 2 — our algorithm family is the right one; make it iterative

ITC2021 (sports timetabling competition, unbounded compute): pure exact IP
failed on most instances at 16-20 teams; the field converged on
construct-then-repair metaheuristics (ILS/SA/LNS/fix-and-optimize) — the
same shape as our greedy+repair, wrapped in a destroy-and-rebuild loop.
Belgian pro soccer's 18-year production system converged on decomposition +
phased solving, not one monolithic model. The academic problem closest to
ours is the "multi-league scheduling problem" (Goossens/Van Bulck —
amateur clubs, many divisions, shared venues). CP-SAT (OR-Tools) could
model us (interval vars + NoOverlap, lexicographic objectives, min-max
fairness are all textbook patterns; our ~30% slot utilization is a loose,
friendly instance) BUT: no credible WASM-in-Node precedent exists (sidecar
service only), and CP-SAT has open determinism bugs even single-threaded —
byte-identical preview==commit would need version pinning + CI byte-diffs.
Upgrade path: LNS pass first; CP-SAT sidecar only if LNS measurably fails.

## Verdict 3 — the industry blind spots are our differentiators

Three tiers: pro leagues (real solvers, FICO Xpress / proprietary repair
engines, weighted multi-objective); mid-market youth SaaS (rule TOGGLES,
never weights; opaque failures — Diamond Scheduler users: "10 games
unscheduled when you have plenty of field space", no reason given; degrades
past ~30 teams); bottom tier (no generation at all). NOBODY — pro or
amateur — names same-day venue splits as a rule. Only Fastbreak states the
distribution philosophy (founder: "scheduling is the art of equally
managing disappointment — everybody should equally hate you") and only
academia has formal fairness metrics (GPDI games-played spread, RDI rest
disparity). Stealable: visible per-team disadvantage ledger; explainable
infeasibility (name the binding constraint and who bears it); honest
regenerate loop.

## Verdict 4 — slack helps, but only if the engine knows what to buy with it

Experiment on our real world (clean-sheet runs, 726 games):

| variant | splits | b2b | monster waits | mid waits | max splits/team |
|---|---|---|---|---|---|
| baseline | 46 | 14 | 17 | 91 | 2 |
| +5% hours | 46 | 14 | 17 | 91 | 2 |
| +10% hours | 62 | 7 | 22 | 81 | 3 |
| +20% hours | 16 | 5 | 27 | 88 | 2 |
| +30% hours | 16 | 5 | 27 | 88 | 2 |
| +1 court/venue | 39 | 4 | 24 | 79 | 3 |

Findings: +5% is a dead zone; +10% makes splits WORSE; +20% cuts splits
by two thirds and halves b2b; +30% buys nothing more. One extra court per
venue is the best b2b lever. BUT every slack variant RAISES monster waits —
because the engine's 6-attempt retry selects the winning attempt on
[unscheduled, b2b, requests, style...] and NEVER on splits/waits: extra
room gets spent on sprawl, not on the burdens the owner cares about. The
+10% anomaly is this blindness in miniature. Conclusion: slack is a real
lever (~20% hours or +1 court), but only pays off once attempt selection
and repair optimize the same burden vector the fairness table shows.
(Separate fact: academic amateur-league data recommends ~50% venue-
availability slack — but for POSTPONEMENT absorption at 10-13% real
cancellation rates, a different purpose than packing quality.)

## Owner amendments (2026-08-07 evening, supersede where they touch)

1. **No reserved-court mechanics.** Scheduling consumes the capacity that is
   really booked; the slack lever lives in PLANNING as a configurable
   "plan X% extra capacity" knob that honors every existing rule (grade
   placements, home-gym-first, cohesion). The earlier +1-court experiment
   variant was a probe, not a feature.
2. **Venue distance is a first-class fact.** Venues have addresses; pairwise
   travel time defines VENUE CLUSTERS: gyms under a configurable threshold
   (default 30 min; Haber-Playground is 5-7 min) count as THE SAME PLACE.
   The split burden, the cohesion logic, and the repair sweeps all operate
   on clusters, not raw venue ids: an intra-cluster split is free, and
   converting a cross-cluster split into an intra-cluster one counts as a
   heal. Measured on the owner's saved schedule: 70 raw splits = 57 real
   cross-cluster (36 SixPark+Playground, 21 SixPark+Haber) + 13 harmless
   Burlington-internal. Distance source: geocoded coordinates first
   (straight-line + threshold), Places drive-time matrix as the upgrade.

## The plan (staged, each measurable on the live world before/after)

- **A. Burden-aware attempt selection (small, do first; PROVEN by the
  attempt-anatomy probe).** The judge's key today is [unscheduled, b2b,
  requests, style, spread, tradeoffs] — splits appear nowhere, and the
  +10%-slack run CONTAINED a 22-split candidate that lost to a 62-split
  one on b2b alone (scripts/analysis/attempt-anatomy.ts output). New key
  per the owner's hierarchy: [unscheduled, CROSS-CLUSTER splits, monster
  waits, b2b, requests, style, mid waits, spread, tradeoffs]; early-exit
  checks the full vector. Then re-run the slack curve for the honest
  payoff.
- **B. LNS repair loop.** Wrap the existing sweeps in destroy-and-rebuild
  over small windows (one day / one team / one venue), objective = the
  ranked burden vector + min-max fairness. Literature-standard upgrade,
  stays deterministic, anytime-stoppable.
- **C. Planned-slack knob + guidance.** Season/plan-level "plan X% extra
  capacity" configuration consumed by the planner (all existing rules
  honored), plus utilization + what-if guidance ("one more court at
  Playground on these 3 days removes ~N splits") powered by the experiment
  harness as a live probe.
- **C2. Venue clusters.** Coordinates on venues (Places geocode at add;
  backfill for existing), pairwise minutes, configurable same-place
  threshold (default 30), cluster-aware split metric + cohesion + sweeps +
  fairness column ("Same day, 2 gyms" counts cross-cluster only; the
  drill-down can show intra-cluster moves quietly).
- **D. The disadvantage ledger.** Per-team running burden tally (splits,
  waits, b2b, early/late) as a first-class fairness surface — the industry
  gap nobody fills; mostly reuses the fairness table's data.
- **Non-goals for now:** CP-SAT sidecar (revisit only if B fails against
  targets), LLM anywhere in the runtime path, WASM solvers.
