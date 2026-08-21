---
updated: 2026-08-20
tags: [theme/gtm, type/plan, status/open]
---

# Deck screenshots: the data problem, and how to actually fix it

Written after a full day on the league deck that ended with slides still empty.
Read this before touching deck screenshots again.

## The owner's four requests, verbatim in effect

| # | Slide | Asked for | Status |
|---|---|---|---|
| 4 | Planning | Three frames: team selection, building selection **with weekends selected**, and the weekend grid **with content on it** | **NOT DONE.** Frames exist but the board is empty |
| 5 | Scheduling | A third frame showing the back-to-backs / fairness table | **CANNOT.** No such screen exists in the product |
| 9 | Playoffs | Several frames ending in a **drawn bracket** | **NOT DONE.** Generator refuses |
| 11 | Waivers | Expand a team, show green and waiting | **DONE and live** |

He also asked whether referee screens should be shot on a phone. Answer: yes,
the pair is league-broadcasts-a-shift on the console, referee-accepts on the
phone. Not built.

## What actually went wrong, verified

The deck's capture pipeline works. The seeder creates a planning season. Both
are fine. **The plans they create are empty.**

```
SeasonPlan rows: 1
  "Our plan" -> grades placed on weekends: 0 | gym assignments: 0
```

A plan's content is two JSON columns:

- `assignment`: `sessionId -> unitKey[]`   which grades play that weekend
- `venues`: `sessionId -> { unitKey: venueId }`   which gym each grade is in

Both were `{}`. So the board rendered its structure, every cell said "No gym on
this date yet", and the screenshot showed a grid with no coloured boxes. That is
exactly what the owner saw and reported.

**Root cause of the root cause: the capture script drives the planner UI
through a five-step wizard.** Opening a plan, switching weekends on and pressing
"Draw the calendar" gets the board to render, but does NOT place gyms or grades.
Those come from dragging, or from a fill action that was never triggered.
Driving a multi-step wizard from Playwright to produce demo data is fragile and
it silently half-succeeds, which is worse than failing.

## ⚠️ THE REAL DATA IS ON THE BOX. STOP SEEDING.

The owner built this himself, in the product, and it has been on production the
whole time. Verified 2026-08-20 by querying the box:

| Season | League | Content |
|---|---|---|
| `f4c3599c-0f12-4d4e-9d35-4117d9f47b29` | NPH Showcase League / Fall/Winter 2026-27 [REGISTRATION] | **147 teams**, 10 divisions, 20 sessions, 3 venues |
| `b320ed7f-a6d7-498c-b0c4-6f4ef0eae21e` | NPH Showcase League, End of Season / Fall/Winter 2026-27 (completed) | **782 games**, 145 teams, 22 divisions |

League ids: `0386577c-0d3e-4b37-b1c0-a67d7d671079` (registration) and
`2c79bf58-093a-494a-891f-8b4b27253698` (completed).

**And the plans are POPULATED**, which is the thing every local seed lacked:

| Plan | Season | Grades placed | Gym assignments |
|---|---|---|---|
| "NPH plan" | b320ed7f | **57** | **62** |
| "Kais Plan" | f4c3599c | **44** | **44** |
| "New 2" | f4c3599c | **40** | **40** |
| "NPH plan" | f4c3599c | 35 | 0 |
| "Zia's plan" | f4c3599c | 0 | 0 |

`owner-nph@sportshub.demo` is LeagueOwner on both, so the existing capture
credentials already work against production.

### Rules for capturing from the box

1. **Read-only. Never run the neutral rename against production** — it writes to
   the league, the organisation and every recap body. That pass is local-only.
2. **Never create a plan on production.** The current `plan` capture presses
   "Start a new plan", which would write into the owner's real league. Point it
   at an EXISTING populated plan instead (`?plan=<id>`, or pick it from the plan
   selector), ideally "Kais Plan" or "New 2".
3. Capture with `DECK_BASE=https://sportshubone.com`, `DECK_LEAGUE=...`,
   `DECK_SEASON=...`, and `--nph` only.

### What this means for the neutral set

The neutral deck still must not name NPH. Two options, in order:

1. Copy that season down to local, rename it there, capture locally. Best
   answer: it makes the rich data reproducible and keeps production untouched.
2. Fall back to the local seeded world for neutral, accepting it is smaller.

## The strategy that will work

**Seed the finished state directly into the database. Do not drive the wizard.**

The capture script should open a screen that is *already* complete and take a
picture. Nothing in a screenshot pipeline should be responsible for creating
data.

Concretely, `seed-deck-states.ts` should write a SeasonPlan with both JSON
columns populated:

```ts
assignment: { [sessionId]: ["age:Gr9", "age:Gr10"] }
venues:     { [sessionId]: { "age:Gr9": venueId, "age:Gr10": venueId } }
```

Unit keys look like `age:Gr9`, `division:<id>` or `group:<id>` (see
`lib/scheduler/generate*.test.ts` for real examples). Session ids are the
season's `SeasonSession` rows. Validate against `planWorldSchema` and
`assignmentSchema`/`venuesSchema` in `lib/scheduler/season-plans.ts`.

Then verify the seed by asserting on the DATA, not by looking at a page:

```
grades placed > 0 AND gym assignments > 0
```

A seeder that cannot prove its own output should fail loudly.

### The same applies to the playoff bracket

The generator refuses with a real, legitimate error:

> Championship Weekend 3: 10 games fit the total court time but not the round
> structure (rounds need rest and sequence).

Progress made: three playoff weekends booked and per-division pooling set took
it from 27 failing games to 10. More hours did **not** help, so it is not court
time. A bracket's rounds depend on each other and the engine will not sequence
ten dependent games inside one weekend.

Two honest options, in order of preference:

1. Read `api/seasons/[id]/playoff-plan/route.ts` and find what round structure
   it will accept, then seed a playoff shape that satisfies it.
2. Write `season.playoffPlan` directly, the same way the plan JSON above is
   written, and skip the generator for demo purposes.

## "Why not just use production?"

Production runs the same seeded demo world. The missing data is missing there
too, so capturing from the box would produce the same empty board. The
environment was never the problem; the data is. (The box was genuinely
undeployed for part of the day, which was a separate real problem and is fixed.)

## What already works and should not be rebuilt

- `npm run deck:shots` — signs in, walks every screen, wide content band plus
  extra frames, renames the world for the neutral set and restores it, writes
  WebP, bumps a cache-buster. Adding a screen is one row in `SHOTS`.
- `scripts/demo/seed-deck-states.ts` — builds a writable DRAFT planning season
  with venues, hours, sessions, dates, divisions and approved entries, and books
  three playoff weekends on the completed twin. Everything except the plan
  CONTENT.
- `scripts/demo/seed-nph-endseason.ts` — completed twin with every game scored.
  Takes `SOURCE_SEASON`.
- The deck itself: 19 slides, crossfading frames, two brands from one registry.

## Order of work for the next session

1. Populate the plan JSON in the seeder. Assert grades and gyms are placed.
2. Re-shoot slide 4. The board must show coloured grade boxes on weekends.
3. Playoffs: satisfy the round-structure rule, or seed `playoffPlan` directly.
4. Re-shoot slide 9 through to a drawn bracket.
5. Phone frames for referees, if still wanted.
6. Slide 5 stays impossible until the fairness report is built as a feature.

## The process lesson

Three separate wrong answers were given for one symptom: browser cache, then a
missing deploy, then "it was never built". Only the third was true, and it was
found by comparing the request list against what shipped, which takes under a
minute. **Do that comparison first, before diagnosing anything.**

And never report a screenshot as done without opening the image.
