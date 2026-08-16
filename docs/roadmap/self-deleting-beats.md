# Self-deleting focus beats: the supervised fix list

Status: **34 open**, across 9 demos. 14 fixed 2026-08-16 (season-story 6,
game-day-story 7, waivers-story 1). `players-season` is clean and stays
untouched.

Do NOT batch-fix this list. Every row needs a judgement call about what the beat
is really about, and three of the fourteen already fixed needed something other
than the obvious move. Work a demo at a time, with the gates at the bottom re-run
after each.

## The defect

A beat's `set` is applied at the TOP of the beat:

```ts
/* player.tsx */
const state = useMemo(() => {
  const s: Record<string, unknown> = {}
  for (let i = 0; i <= index && i < beats.length; i += 1) {   // <= index
    const b = beats[i]
    if (b.set) Object.assign(s, b.set)
    ...
```

So a beat that presses a control AND sets the state that unmounts that control
has already destroyed its own target before the hand starts moving. Three things
go wrong:

- the cursor glides to an element that is not in the DOM, and parks on a ghost;
- the emphasis ring and the callout balloon have nothing to anchor to;
- on a phone this is the visible one. `SceneStage` pans the keyhole to
  `data-demo-focus`, so the viewer is shown the wrong part of the scene for the
  whole beat.

A computer mostly hides it, because the whole scene is on screen at once. The
mobile keyhole is what made it measurable.

## How it is measured

```
node scratchpad/overnight/final/absent-probe.mjs --slugs <slug,slug> \
  --out /tmp/absent.md
```

It drives every beat, reads `data-demo-focus` off the stage, and reports the
beats where `[data-demo-target="<focus>"]` is not in the DOM. Zero is the gate.

`scratchpad/overnight/mobile/gate.mjs` reports the same thing as a follow count
("N of M beats centred") and is what the checkpoint quotes.

## The three fix classes

**A. move-set** (23 rows). The press and its own state change share a beat. Move
`set`, and the toast that confirms it, to the FOLLOWING beat. This is also the
order the viewer reads: press, then result. Worked example, waivers:

```ts
paced({ id: "open",  caption: "One tap.", cursor: "mail-cta", press: true }),
paced({ id: "read",  caption: "The document is the document.",
        emphasize: "doc-body", set: { phone: "doc" } }),   // moved here
```

**B. retarget** (7 rows). The beat is the LAST of its chapter, so the next beat
leaves the screen and a deferred `set` would never be seen. Ring a surviving
element instead of pressing a doomed one. Worked example, season-story
`approve-req`: the Approve button becomes the honored line, and the next beat is
on the schedule screen, so the beat now rings `req-dragons-note` and keeps its
caption, callout and toast.

Watch for the variant: game-day `buzzer` was class B and the honest fix was to
drop the press entirely, because the caption ("The buzzer. Both screens stop on
the same zero.") is the clock reaching zero, not somebody pressing End Q4. The
beat rings `console-clock` now.

**C. stale-state** (4 rows). The beat carries no `set` of its own, so the target
is hidden by state left on from an earlier beat. Clear that key in this beat's
own `set`. Worked example, season-story `one-address`: `ask` was still on from
chapter 2 and the ask sheet was standing where the weekend grid should be, so the
beat now sets `{ screen: "board", court6: true, ask: false }`.

**D. never-rendered.** Not represented below, but game-day had one and it is the
class to watch for: the target NEVER exists in that scene. `floor-home-33` fouled
Felix Robinson, who starts on the bench, so his floor chip was never rendered at
all. Fixed by moving the foul to a starter (#32 Liam Silva) and updating
`game-day-numbers.md`. If a row below turns out to be this, fix the data, not the
beat.

The class in the table is derived mechanically (press? own `set`? last beat of
its chapter?). Treat it as the starting hypothesis, not the answer.

## The 34

| demo | beat | id | chapter | focus target | press | its own `set` | last of chapter | class |
|---|---|---|---|---|---|---|---|---|
| schedule-change | 5 | `move` | move | `alt-first` | yes | moved, alts, open | no | **A** |
| schedule-change | 18 | `cancel-ok` | cancel | `confirm-cancel` | yes | dialog, cancelled, open | no | **A** |
| standings-to-playoffs | 4 | `forfeit-ok` | weekend | `confirm-forfeit` | yes | dialog, forfeited, open | no | **A** |
| standings-to-playoffs | 12 | `add-h2h` | rule | `tb-add-1` | yes | order | no | **A** |
| standings-to-playoffs | 14 | `lock` | rule | `tb-lock` | yes | locked | no | **A** |
| standings-to-playoffs | 21 | `ruled` | who | `rule-eligible` | yes | ruled, override | yes | **B** |
| team-drops-out | 5 | `approve` | ask | `wd-approve` | yes | approved | yes | **B** |
| team-drops-out | 20 | `confirm` | fix | `confirm-add` | yes | dialog, committed | no | **A** |
| the-referees | 13 | `accept` | accept | `accept-btn` | yes | accepted, phoneView | no | **A** |
| the-referees | 21 | `confirm` | pay | `settle-confirm` | yes | confirmed | no | **A** |
| roster-story | 2 | `new` | team | `new-team` | yes | view | no | **A** |
| roster-story | 7 | `create` | team | `create-btn` | yes | view | yes | **B** |
| roster-story | 12 | `tryout-publish` | tryout | `publish-btn` | yes | view | yes | **B** |
| roster-story | 16 | `register` | family | `register-btn` | yes | registered, phone | no | **A** |
| roster-story | 19 | `bulk` | offer | `bulk-btn` | yes | view | no | **A** |
| roster-story | 22 | `send` | offer | `send-btn` | yes | view | no | **A** |
| roster-story | 27 | `accept` | offer | `accept-btn` | yes | accepted, phone | yes | **B** |
| roster-story | 29 | `roster-sizes` | roster | `row-darius` | no | (none) | no | **C** |
| roster-story | 30 | `roster-status` | roster | `row-status` | no | (none) | no | **C** |
| everyone-in-the-loop | 2 | `move` | change | `move-btn` | yes | view | no | **A** |
| everyone-in-the-loop | 6 | `save` | change | `save-btn` | yes | view | yes | **B** |
| everyone-in-the-loop | 13 | `answer` | thread | `coach-msg` | no | answered | no | **C** |
| everyone-in-the-loop | 14 | `pin` | thread | `pin-btn` | yes | pinned | no | **A** |
| your-week | 8 | `tap` | gym | `row-sat` | yes | view | no | **A** |
| your-week | 9 | `gamepage` | gym | `open-game` | yes | view | no | **A** |
| your-week | 10 | `venue` | gym | `venue-link` | yes | view | no | **A** |
| your-week | 16 | `pay` | owed | `band-card` | yes | view | no | **A** |
| your-week | 18 | `sign` | owed | `w-open` | yes | view | no | **A** |
| money-picture | 20 | `recorded` | door | `modal-save` | yes | modal, recorded | no | **A** |
| money-picture | 22 | `waive` | door | `waive-btn` | no | (none) | no | **C** |
| claim-your-club | 4 | `page` | find | `result` | yes | view | no | **A** |
| claim-your-club | 5 | `claim-btn` | find | `claim-btn` | yes | view | yes | **B** |
| claim-your-club | 10 | `send` | prove | `send-code` | yes | view | no | **A** |
| claim-your-club | 15 | `take` | reserved | `take-btn` | yes | view | no | **A** |

`your-week` is the densest run of class A and the cheapest demo to start on: five
beats, all of them a press against a `view` switch, none of them last in their
chapter.

## Two things that bite

**Chapter jumps.** State accumulates to the current index, so moving a `set`
forward is safe for jumping. But never move a `set` OFF the first beat of a
chapter: jumping to that chapter would then land on a screen missing its own
state. Every one of the fourteen already fixed was checked for this.

**Timing.** `paced()` derives `hold` from `cursor` and `callout`, and `emphasize`
buys `EMPHASIS_HOLD_MS` (1200ms) on top. Dropping a cursor and adding an
emphasize moves a beat by about +800ms, which moved two registry
`durationLabel`s by a second. Re-measure and update the label if it drifts.

## Gates to re-run after each demo

```
node scratchpad/overnight/final/absent-probe.mjs --slugs <slug>       # expect 0
node scratchpad/overnight/mobile/gate.mjs --full <slug> --spot ""     # follow count
node scratchpad/overnight/final/drive-all.mjs --slugs <slug>          # errors, jumps, runtime
node scripts/demo/readability-audit.mjs --viewport 390x844 --floor 11 --scope stage --routes /demos/<slug> --out /tmp/r.md
```

If the runtime moved, update `durationLabel` in `apps/web/src/app/demos/registry.ts`.
The drive script checks that for you and reports the drift.

## Where this came from

Measured 2026-08-16 in the overnight checkpoint over the rebuilt demo directory.
The mobile round found 14 in the three demos it drove in full; driving all
thirteen found 34 more. Nothing here is a regression from the rebuild: the
pattern predates it and only became visible once the keyhole started following
`data-demo-focus`.
