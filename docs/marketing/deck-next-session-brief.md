---
updated: 2026-08-20
tags: [theme/gtm, type/brief, status/open]
---

# League deck: brief for the next session

Start here. Read `docs/seeders-index.md` first, then this.

## The seeder exists

**`scripts/seed-journey.ts`**, scenario **`nph-pitch-journey`**, loaded from
**Dashboard > Admin > Demos**. It builds NPH at true scale from their own
2025-26 census: **~230 team entries, 146 in the Showcase League**, real club and
venue names, fictional players, season `"Fall/Winter 2026-27"`.

Four stages, all implemented. Fast-forward is additive.

| Stage | Leaves you with |
|---|---|
| 1 | Registration in flight, ~25 of 146 in |
| 2 | Everyone's in, submitted and pending |
| 3 | **All approved, league finalized, one court short on purpose.** Far-team requests and a pending withdrawal seeded. Zero games |
| 4 | Game day: completed games, standings, referees assigned, one game queued live |

This is the world already on the box. Do not write a new seeder. Do not drive
the planner wizard from automation to create data.

## What the owner asked for

Four slide changes on the league deck at `/deck/leagues` and `/deck/nph`:

| # | Slide | Wanted | State |
|---|---|---|---|
| 4 | Planning | Three frames: team selection, buildings **with weekends selected**, and the weekend grid **with grades placed on it** | Frames exist, board is empty |
| 5 | Scheduling | A third frame showing the back-to-backs / fairness table | The screen does not exist in the product |
| 9 | Playoffs | Several frames ending in a **drawn bracket** | Not done |
| 11 | Waivers | Expand a team, show green and waiting | **Done, live** |

Also open: referee screens shot on a **phone**, paired as league-broadcasts-a-shift
on the console and referee-accepts on the phone.

## Order of work

1. Load `nph-pitch-journey` **stage 3** locally from Dashboard > Admin > Demos.
2. **Verify by query, not by eye**: ~146 team entries in the Showcase season,
   and a plan whose `assignment` and `venues` are both non-empty. If a plan is
   empty, the board will photograph as an empty grid.
3. Re-shoot slide 4 from that world. `npm run deck:shots`. The board must show
   coloured grade boxes sitting on weekends.
4. Load **stage 4**, then the playoff bracket. If the generator still refuses
   with "rounds need rest and sequence", read
   `api/seasons/[id]/playoff-plan/route.ts` for the shape it will accept.
5. Re-shoot slide 9 through to a drawn bracket.
6. Phone frames for referees, if still wanted.
7. Delete `scripts/demo/seed-deck-states.ts`.
8. Slide 5 stays impossible until the fairness report is built as a feature.

## Rules for capture

- `npm run deck:shots` does everything: signs in, walks every screen, takes a
  wide content band plus extra frames, renames the world for the neutral set and
  restores it, writes WebP, bumps the cache-buster. Adding a screen is one row
  in `SHOTS` in `scripts/marketing/deck-shots.mjs`.
- **Never open a screenshot-driven capture against production**, and never run
  the neutral rename there: it writes to the league, the organisation and every
  recap body.
- **Never report a screenshot as done without opening the image.**

## What already works, do not rebuild

- The capture pipeline and its cache-buster
- The deck: 19 slides, crossfading frames, two brands from one registry
  (`app/deck/_deck/registry.ts`), adding a league is one row
- The deploy path: push to origin and to the box remote, then `deploy.sh`
- Slide 11

## Reference

- `docs/seeders-index.md` — every seeder and scenario
- `docs/marketing/pitch-decks.md` — the links, and how the deck is built
- `docs/marketing/deck-data-strategy.md` — why the boards came out empty
