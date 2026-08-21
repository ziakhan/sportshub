---
updated: 2026-08-20
tags: [theme/demo, type/index, status/live]
---

# Seeders: what exists, and what each one builds

**Read this before writing a seeder or concluding data does not exist.**

It exists because on 2026-08-20 a full day was spent building a seeder to
manufacture demo data that was already sitting in `scripts/seed-journey.ts`, and
then concluding twice that both the data and its seeder were gone. Neither was
true. The checks that would have caught it in seconds:

```bash
grep -rn "Fall/Winter 2026-27" scripts/     # is this world already built?
git log --all --oneline -S'<the string>' -- scripts/
```

## The worlds

| Script | Builds | Scale | Notes |
|---|---|---|---|
| **`seed-journey.ts`** | **NPH at true scale** across Showcase / D1 / NPA / WNPA from `data/nph-census.ts` | **~230 team entries, 146 in Showcase** | **The big one.** Real club and venue names, fictional players. Season `"Fall/Winter 2026-27"`. Staged. **This is the world on the box.** |
| `seed-nph-demo.ts` | The everyday NPH demo world | ~22 teams, 147 games (Summer 2026) | The default local world. Also creates a 4-team `"2026-27"` Showcase stub, which is NOT the big season above. |
| `seed-summer-world.ts` | NPH Summer League, live season | Additive | April to September, live-anchored. |
| `seed-national-circuit.ts` | NJC + NSC as one playable league | Additive, local only | Never touches Showcase data. |
| `seed-demo-world.ts` | Limited-launch compact world | Compact v1 | Spec: `docs/demo-world-spec-2026-08.md`. |
| `seed-showcase.ts` | Ontario Youth Basketball League | 12 clubs, 24 teams, 240 players | Public homepage content vision. A different world from NPH Showcase, despite the name. |
| `seed-feed-cards.ts` | Feed cards at session cadence | Content only | Local only. |
| `demo/seed-nph-endseason.ts` | Completed twin of a season, every game scored | Mirrors its source | Takes `SOURCE_SEASON`. Needed before playoffs can be generated. |
| `demo/seed-deck-states.ts` | Planning season + playoff weekends for deck shots | Small | **Probably delete.** Written 08-20 to rebuild what `seed-journey.ts` already provides. |

## The staged scenarios

Registered in `scripts/demo-scenarios.ts`, driven from **Dashboard > Admin >
Demos**. Fast-forward is ADDITIVE: live demo work between stages survives.

### `nph-pitch-journey` — the full-scale one

| Stage | What it leaves you with | Code |
|---|---|---|
| 1 | Registration in flight. D1/NPA/WNPA approved and schedule-ready; Showcase mid-registration, ~25 of 146 in | `seedJourneyStage1()` |
| 2 | Everyone's in. Every remaining census team submitted, pending | `seedJourneyStage2()` |
| 3 | Ready to schedule. All approved, league FINALIZED, gyms attached, **deliberately one court short** so the capacity message can be demoed. Far-team requests and a pending withdrawal seeded. Zero games | `seedJourneyStage3()` |
| 4 | Game day. Completed games with stats and standings, referees assigned, one game queued live for scoring | `seedJourneyStage4()` |

⚠️ The file header still says stage 4 is "not yet implemented". **That comment is
stale** — `seedJourneyStage4()` exists and is wired into `runJourneyStage()`.

### `pitch` — the smaller one

Clubs, tryouts, a running season. One stage.

## Which world do I want?

- **Pitching a league, or any screenshot that needs real scale** →
  `nph-pitch-journey`, stage 3 for planning and scheduling, stage 4 for game day
- **Everyday development** → `seed-nph-demo.ts`
- **Playoffs or standings** → the endseason twin on top of whichever world
- **Public homepage content** → `seed-showcase.ts`

## Rules

1. **Before building data, grep for it.** A world at the scale you need probably
   already exists.
2. **Check `demoState`** to see what is currently loaded:
   `PlatformSettings.demoState` holds `{ scenario, stage, loadedAt }`.
3. **Verify by query, never by eye.** Assert team counts, and for a plan assert
   `assignment` and `venues` are non-empty. A seeder that cannot prove its own
   output should fail loudly.
4. **Local and production are different worlds.** Query the one you are talking
   about before asserting anything about it. The box carries state no local run
   reproduces unless the same scenario and stage are loaded.
5. **Keep this file current.** A new seeder that is not listed here will be
   rebuilt by someone else within the month.
