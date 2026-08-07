# The one-calendar wave — owner rulings 2026-08-07 (morning after stages 0-2)

Status: DESIGN AGREED in conversation; only the schedule-page workability
slice is go ("let's try to make that page workable right now"). Everything
else here is queued for the owner's go, ahead of the stage-3 org design.

## The problem in the owner's words
"Everything visually looks fine until I press the button and suddenly
there's a problem. I want a simple flow... one-click button to use this
plan and generate. A league owner is not technical."

## Rulings

1. **Plans are sandboxes, full stop.** Every plan, the default included,
   is isolated: editing a plan never touches the season, another plan, or
   registrations. A zero estimate means "this plan doesn't run that
   grade." Registrations render as overlay only.
2. **Write-through DIES.** The active plan's special behavior (steps 1-2
   writing to the season) is removed. The season is always "the last plan
   generated from," never "whatever was touched most recently."
3. **One door into the season:** the single button — "use this plan and
   generate the schedule." It makes the plan the default, applies its
   world, and generates, as one press. Any plan can be re-chosen later and
   the same button re-points the season at it. No other action leaks.
4. **Autosave.** No Save/Save-as on the default path; the board saves
   itself. "Try another version" makes a copy quietly. Rename/delete in a
   menu. The word "activate" never appears again.
5. **The button may only complain about what the board already showed.**
   Its preflight asks exactly two sufficiency questions, in plain words:
   does every team get its promised games, and do the games fit the booked
   gym time. Green board = silent button. Structural facts (weekends out
   of twenty, plan counts, attachments) are never warnings.
6. **No carried leftovers.** With autosave + one calendar per context, a
   calendar can never be carried into a plan whose weekends don't hold it
   (the "17 placements" banner class becomes unconstructable).
7. **Honest denominators.** "Used by 1 of 20 sessions" style counts die;
   displays measure against the weekends the calendar RUNS.
8. **Removal, two levels.** A grade row can be removed from a plan
   entirely (restorable via add-grade; season untouched). A plan can
   exclude specific registered teams; generation covers "the N teams in
   this plan" and names the excluded on the way in.
9. **A compact plan is legitimate.** 5 chosen weekends delivering 10
   games/team is a valid season; nothing may nag about unused weekends.

## Schedule page (the go'd slice, built 2026-08-07)
- Summary-first everywhere (preview AND committed): verdict header →
  per-team fairness counts worst-first → team drill-down → full table only
  behind "Show all games".
- Per-team shortfall warnings leave the issues list and become the
  "Games short" column (loudest flag, first in sort). Structural issues
  cap at 5 lines + "Show all N issues".
- Next iterations (owner: "we will continue to work on it"): commissioner-
  validation lens, more readable team schedule view.

## Explicitly NOT in this wave
Stage-3 org tier (own design + branch) · public/native surfaces · venue
availability layers.
