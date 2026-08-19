# Game day, on two phones: every number, and where it came from

Status: BUILT 2026-08-16 (fifth of the gold-standard rebuilds). Script:
`apps/web/src/components/demo-directory/stories/game-day-story.tsx`. Kit:
`apps/web/src/components/demo-directory/mock-scoring.tsx`. Registry entry:
`apps/web/src/app/demos/registry.ts` slug `game-day`.

This is the fidelity sheet the demo audit (`demo-scenario-audit-2026-08-16.md`)
requires: every value on screen, its source, and the route the flow lives at
today. Nothing here is invented except where §C says so, and §C carries the
owner's authorization for each one.

---

## 0. The world, and the one game

| Thing | Value | Source |
|---|---|---|
| League | NPH Summer League | `DB` League `d77d6700-3139-43e2-83f9-dec8f5317011` |
| Season | Summer 2026, IN_PROGRESS | `DB` Season `fbbe767c-00e9-4130-9258-4f02c6854efa` |
| Session | Weekend 11 · Aug 22 | `DB` SeasonSession `5864c08e-ec01-43fe-90d5-90e1a3ebd8b2` |
| Division | Grade 9 Boys · Tier 1 | `DB` Division `9a7a896e-574b-4f9f-a0bb-06e515535a76` |
| THE GAME | Game `7e467b44-771a-49a8-8ed9-3824a1a089a3`, published, SCHEDULED | `DB` Game |
| Home | Oakville Panthers Grade 9 (`abb8df3c`) | `DB` Team |
| Away | Toronto Lords Grade 9 (`77311a01`) | `DB` Team |
| Venue | The Playground · Court 1 | `DB` Venue + Court on the game |
| Tip-off | Sat Aug 22 · 12:00 PM | The slot the schedule-change demo MOVED it to |
| Clock | SIMPLE, 10-minute QUARTERS | `DB` League `gameClockMode`, `periodType`, `periodMinutes` |
| Stat depth | STANDARD | `DB` League `statDepth` |
| Referee approval | Optional for this league | `DB` League `requireRefereeApproval = false` |

**Continuity, on purpose.** This is the same game the schedule-change demo
moves from 9:00 AM to noon (`schedule-change-numbers.md` §A). That demo ends
with 26 people being told the new time; this one is the afternoon they turn up
for. A league watching both sees one game carried end to end.

**Why a SCHEDULED game and not a completed one.** `PreGameChecklist` only
mounts when `status === "SCHEDULED"` (`components/scoring/pre-game-checklist.tsx`
line 44), and the console's pre-game steps only exist before the first
`PERIOD_START`. Staging the demo on a game that has already been played would
have skipped the two chapters the owner asked for.

### 0b. This flow exists today, beat by beat

| Chapter / beat | The flow, today | Route + code |
|---|---|---|
| Game-day checklist, clock choice, guest link | Ships | `/games/[id]/score` → `components/scoring/pre-game-checklist.tsx`; clock choice PATCHes `/api/games/[id]/clock` |
| Attendance roll call, present / absent, add guest | Ships | same route, `scoring-console.tsx` `pregameStep === "attendance"` (L709); RSVP pre-marking via `lib/rsvp.ts` `getGameRsvpAbsentees` |
| Starting fives, "Start game" | Ships | same route, `pregameStep === "starters"` (L822); appends ATTENDANCE, LINEUP, PERIOD_START |
| Console header, clock button, End Q1, ticker, synced pill, BOX, UNDO | Ships, and already in a PHONE layout | `scoring-console.tsx` L1503+; phone chip rows `chipRow` L1313 |
| Action pad, the nine buttons, the two-tap hint | Ships | `scoring-console.tsx` `actionPad` L1360; the set is gated by `showMisses` / `showHustle` L633 |
| Assist chain, "Assist by?" | Ships | `scoring-console.tsx` L1365 |
| Subs drawer, staged swaps | Ships | `scoring-console.tsx` `subsFor` panel, "SUBS ⇄ (n on bench)" L1277 |
| UNDO voids the last event | Ships | `scoring-console.tsx` L1777 `voidEvent`; the stream is append-only, nothing is deleted |
| Public live page: hero, linescore, tabs, box score, play-by-play, team stats | Ships | `/live/[gameId]` → `app/(public)/live/[gameId]/components/*` |
| Player of the Game picker, "top scorer suggested" | Ships | `scoring-console.tsx` review screen L1004 |
| Referee approval, Signature / Referee PIN switch, signature pad | Ships | `scoring-console.tsx` L1067-1136; `components/scoring/signature-pad.tsx`; submitted by `POST /api/games/[id]/finalize` |
| Mark final | Ships | same review screen; `api/games/[id]/finalize/route.ts` |
| Official scoresheet, printable, PDF | Ships | `/scoresheet/[gameId]` → `app/(sheet)/scoresheet/[gameId]/page.tsx`; PDF at `GET /api/scoresheet/[gameId]` (pdfkit, landscape letter) |
| Recap posts itself | Ships | `lib/content/recap-service.ts` `upsertGameRecap`, called from `finalize/route.ts`; template in `lib/content/recap.ts` |
| POTG card on the live page | Ships, final games only | `live/[gameId]/components/potg-card.tsx` |
| Division standings move | Ships | `lib/standings/compute.ts`; league hub table `components/ui/standings-table.tsx` |

---

## A. The cast, all real rows

**Toronto Lords Grade 9** (`DB` SeasonRoster, 10 players, every one with a
jersey number):

| # | Player | # | Player |
|---|---|---|---|
| 4 | Daniel Grant | 28 | Ibrahim White |
| 15 | Ethan Lee | 29 | Isaiah Boateng |
| 17 | Cameron Baptiste | 34 | Cole Campbell |
| 18 | Isaiah Clarke | 37 | Darius Reyes |
| 21 | Zion Nguyen | 38 | Owen Lee |

**Oakville Panthers Grade 9** (`DB` SeasonRoster, 10 players):

| # | Player | # | Player |
|---|---|---|---|
| 11 | Jayden Anderson | 33 | Felix Robinson |
| 12 | Ravi Baker | 34 | Kevin Wilson |
| 16 | Kai Green | 35 | Yusuf Mensah |
| 29 | Daniel Osei | 39 | Andre Nguyen |
| 32 | Liam Silva | 42 | Mateo Campbell |

**People**

| Role | Person | Source |
|---|---|---|
| Parent on the right phone | Jordan Reyes | `DB` User `summer-parent-lords@sportshub.demo`, and `Player.parentId` on Darius Reyes (`a18c732d`) makes him the guardian of record |
| Referee | Mike Ferreira | `DB` RefereeProfile + LeagueReferee for this league, `summer-ref-mike@sportshub.demo` |
| Scorekeeper | Priya Anderson | **NOT A DB ROW.** See §C.3 |

**Starting fives** are the five highest season scorers on each roster, by
`PlayerStat` per-game averages across the season's 37 completed Grade 9 games:
Lords 37, 28, 18, 29, 34; Panthers 11, 39, 16, 34, 32. Darius Reyes averages
14.7 points a game, Ibrahim White 13.2, Jayden Anderson 12.9, Andre Nguyen 10.0.

**Season averages on the pre-game roster tables (added 2026-08-19).** The
parent's phone shows `pregame-rosters.tsx` before tip-off, which lists both
rosters with GP / PPG / RPG / APG. Four of those PPG values are the `DB` ones
above (Darius Reyes 14.7, Ibrahim White 13.2, Jayden Anderson 12.9, Andre
Nguyen 10.0). **Every other PPG, and all of the RPG and APG columns, are
INVENTED**, ordered so the five highest scorers on each side are the five the
season really started. This is the second invented thing in the demo after the
scorekeeper's name; both are in the story file's own ledger.

**Absences.** #15 Ethan Lee (Lords) and #29 Daniel Osei (Panthers) are marked
absent at the door. The product pre-marks absentees from calendar RSVPs
(`lib/rsvp.ts` `getGameRsvpAbsentees`, `EventRsvp` rows with `status:
NOT_GOING`); this game has no NOT_GOING rows tonight, so the demo shows the
DEFAULT path the console describes in its own words: "Everyone starts as
present, tap whoever is missing."

---

## B. Presentation: two handsets, life size

Owner ruling 2026-08-16, recorded here because the stage code exists for it:

> "I want to show them the capability of how easy it is to keep the scoring
> from the phone... that scorekeeper app should be both mobile."

> "Even if it doesn't exist on the phone right now, can we still fabricate some
> of those screens on the phones... two big phone screens side by side."

- `DemoScript.scenePhones` (types.ts) puts the story on two handsets and no
  desktop. `SceneStage` grows a `phones` layout (frames.tsx): the `desktop`
  slot renders in the LEFT handset, `phone` in the right.
- Both are **390 logical at scale 1.0**, which is a real iPhone's point width.
- The pair's box is **868 x 566**, not the single-region 1354 x 600. The stage
  panel on the player route measures 578px tall at 1440x900, so a 600 box could
  only fit by scaling to 0.963 and a 14px label would reach the viewer at
  13.5px. Measured, then fixed: the audit now reports **minimum stage scale
  1.000** across all 56 scenes.
- A handset cannot carry the scene's context strip without pretending the
  product ships a browser bar inside the app, so each phone carries a label
  UNDER its frame instead: whose phone it is and the route it is on. The left
  label changes with the screen (`/games/7e467b44/score` → `/scoresheet/7e467b44`).
- Every screen fits its handset with no clipping: measured per screen (checklist,
  roll call, lineups, console, subs, review, scoresheet, and all four live-page
  tabs) at 0 to 8px, where 8px is the bottom border of a list panel.

---

## C. Phone compositions, and their authorization

Three things on the left handset are not screens the product composes at 390
today. Each is listed with what it is composed FROM, under the owner's
"fabricate some of those screens on the phones" ruling above.

1. **The review and sign-off screen.** The real one
   (`scoring-console.tsx` L994-1210) is authored `mx-auto max-w-5xl` with the
   two box tables side by side on `md:flex-row`. At 390 it stacks and scrolls.
   The demo composes the same screen WITHOUT the two box tables, keeping the
   parts the beat is about: the "Review: HOME n · n AWAY" heading, the Player of
   the Game picker with its "top scorer suggested" note, the Referee approval
   block with the Signature / Referee PIN switch, the pad, the printed-name
   field, and the "← Back to scoring" / "Mark final" pair. Every label is
   verbatim. AUTHORIZED phone composition.
2. **The official scoresheet.** `/scoresheet/[gameId]` is a landscape document
   (`@page { size: letter landscape }`) that stacks BOTH teams' blocks. At 390
   the demo shows the top of the sheet and ONE team's block, the away team,
   which is the one the story followed: the header, the quarter line score, the
   roster with foul boxes, the ABSENT and DNP rows, the Player of the Game line,
   the referee's signature line and the real "Download PDF (landscape)" action.
   The per-quarter scoring-mark columns of the real sheet are dropped for width.
   AUTHORIZED phone composition.
3. ~~**The starting-five picker shows one team at a time.**~~ **RETIRED
   2026-08-19** by the owner's realism ruling: "let's show them all the proper
   attendance lineup changes; if we need to scroll up a little bit to show them
   pressing the buttons, let's do that." Both pre-game panes now render at their
   REAL height with BOTH teams stacked (`scoring-console.tsx` L808 and L877,
   `flex-col gap-4 md:flex-row`), inside a measured `ScrollPane` that clamps a
   beat's requested scroll to the pane's own end, and the beats film the scroll.
   On camera: #29 Daniel Osei marked absent on the Panthers' bench, the scroll to
   the Lords' bench, #15 Ethan Lee marked absent, "Continue to starting lineups",
   the last two Lords starters tapped in (3/5 → 4/5 → 5/5), "Start game" going
   from disabled to live, and the press. Absentees are filtered out of the pick
   lists exactly as L880 filters them. No composition is fabricated here any
   more.
3b. **The live watching view is the page's own scroll.** The parent's handset
   renders `/live/7e467b44` as ONE column (hero, tabs, the tab's content) inside
   the same `ScrollPane`, with the sticky score chip appearing once the hero
   passes the top, which is what the real page does. A "tab" is a tap and a "look
   further down" is a scroll: no view on that handset is composed, only scrolled
   to. Added 2026-08-19 with `pregame-rosters.tsx` (the pre-game state),
   `live-view.tsx` L253 ("Waiting for the first play"), `game-leaders.tsx` and
   the `play-by-play-tab.tsx` filters, none of which the 08-16 cut drew.
4. **Priya Anderson, the scorekeeper's name.** The checklist reads its two rows
   from `/api/games/[id]/scorekeeper` and `/api/games/[id]/referee`, which
   resolve `UserRole` rows. **The local `UserRole` table was wiped before this
   build (1 row total, 0 with role Referee),** so no assignment exists to read
   for this game tonight. The referee is a real person from `RefereeProfile` and
   `LeagueReferee`; the scorekeeper's name is INVENTED, and it is the only
   invented name in the demo. Punch item, §H.

Everything else on the left handset is a real phone surface: the console already
ships a phone layout (`chipRow`, the sticky action pad, the one-line header,
`mobileLayout` rows/tiles), the checklist is a `max-w-md` modal, and the
attendance and lineup steps are tap grids.

---

## D. The staged game, event by event

The demo does not store a score anywhere. `EVENTS` is the game as an append-only
stream (the product's own model, `GameEvent` + `lib/scoring/fold`), a beat says
how many events have happened, and one `fold()` derives every number both phones
show. The whole stream was reconciled in `scratchpad/gd-fold.mjs`, whose event
list is byte-identical to the story's (verified by diff: 179 events, 0
differences).

- **179 events**, one of them VOIDED (index 8, the mistaken three).
- For scale: a real completed Grade 9 game in this same season, `c476ec4a`,
  carries **232** events for a 40-46 final.

### The filmed opening (Q1, on camera)

| # | Event | Score after | Play line the phone shows |
|---|---|---|---|
| 0 | Q1 starts | 0-0 | Q1 |
| 1 | #37 Darius Reyes, two | 0-2 | `#37 Darius R. scores 2` |
| 2 | Assist #18 | 0-2 | `#37 Darius R. scores 2, assisted by #18 Isaiah C.` |
| 3 | #37 misses a three | 0-2 | `#37 Darius R. misses a 3-pointer` |
| 4 | Offensive board #28 | 0-2 | `... · offensive rebound #28 Ibrahim W.` |
| 5 | Foul on #32 | 0-2 | `Foul on #32 Liam S.` (red on the phone) |
| 6 | Sub: #21 in, #34 out | 0-2 | `Sub: #21 in, #34 out` (amber) |
| 7 | #11 Jayden Anderson, two | 2-2 | `#11 Jayden A. scores 2` |
| 8 | #37 credited a THREE, wrongly | 2-5 | `#37 Darius R. scores 3` |
| 8 | UNDO voids it | **2-2** | the line and the three points both go |

Event 5 fouls **#32 Liam Silva**, not #33 Felix Robinson (2026-08-16). The table
records a foul by tapping the player's chip, and the chip row only holds the five
on the floor: #33 starts on the bench and does not come on until Q2, so the beat
was pointing the hand at a jersey that was never rendered. #32 is a starter, and
an early foul is also why he comes off for Felix in Q2. Team fouls are unchanged;
the one point of difference in the box score is the PF column for those two rows.

### The final numbers

**Oakville Panthers Grade 9 48 · 54 Toronto Lords Grade 9**

| Quarter | Q1 | Q2 | Q3 | Q4 | Final |
|---|---|---|---|---|---|
| Oakville Panthers | 12 | 11 | 13 | 12 | **48** |
| Toronto Lords | 14 | 13 | 12 | 15 | **54** |

Quarter totals sum to the final on both sides. The linescore on the parent's
phone renders these four columns and a dash for any quarter not played yet,
which is the live page's own rule.

**Toronto Lords box score** (the side the story follows)

| # | Player | PTS | REB | AST | PF |
|---|---|---|---|---|---|
| 37 | Darius Reyes | 22 | 4 | 1 | 1 |
| 28 | Ibrahim White | 16 | 6 | 1 | 0 |
| 18 | Isaiah Clarke | 12 | 7 | 4 | 1 |
| 21 | Zion Nguyen | 2 | 0 | 0 | 2 |
| 34 | Cole Campbell | 2 | 2 | 0 | 1 |
| 4 | Daniel Grant | 0 | 2 | 0 | 0 |
| 29 | Isaiah Boateng | 0 | 2 | 0 | 0 |
| 17 | Cameron Baptiste | 0 | 0 | 0 | 0 (DNP) |
| 38 | Owen Lee | 0 | 0 | 0 | 0 (DNP) |
| 15 | Ethan Lee | ABSENT | | | |
| | **TOTAL** | **54** | 23 | 6 | 5 |

**Oakville Panthers box score**

| # | Player | PTS | REB | AST | PF |
|---|---|---|---|---|---|
| 39 | Andre Nguyen | 16 | 3 | 0 | 1 |
| 11 | Jayden Anderson | 15 | 5 | 2 | 3 |
| 16 | Kai Green | 10 | 1 | 1 | 1 |
| 34 | Kevin Wilson | 7 | 5 | 0 | 3 |
| 32 | Liam Silva | 0 | 5 | 0 | 1 |
| 33 | Felix Robinson | 0 | 2 | 0 | 0 |
| | **TOTAL** | **48** | 21 | 3 | 9 |

Box totals equal the score on both sides: 48 and 54, checked in the fold.

**Team stats** (what the Team stats tab renders)

| | Oakville Panthers | Toronto Lords |
|---|---|---|
| Field goals | 19-41 · 46% | 22-42 · 52% |
| 3-pointers | 4-11 · 36% | 3-11 · 27% |
| Free throws | 6-7 · 86% | 7-8 · 88% |
| Rebounds | 21 | 23 |
| Assists | 3 | 6 |
| Fouls | 9 | 5 |

Arithmetic check, done in the fold: `fgm * 2 + tpm + ftm` gives 48 and 54, the
same numbers as the scoreboard, the linescore sum and the box totals. (`fgm`
includes threes, which is why the check adds `tpm` once more, exactly as the
product's own aggregation does.)

**Steals, blocks and turnovers are 0 for everyone,** and that is honest rather
than lazy: `showHustle = statDepth === "FULL"` and this league is STANDARD, so
the table's console has no STL, BLK or TO buttons tonight. The box score still
renders the columns, because the live page always does.

### The close, as the camera sees it

| Event | Running score |
|---|---|
| ... Q4 grinds on, off camera | 46-50 |
| #37 Darius R. scores 2, assisted by #18 Isaiah C. | 46-52 |
| #39 Andre N. scores 2 | 48-52 |
| #37 Darius R. scores 2 | **48-54** |
| Buzzer | 48-54 |

---

## E. The clock

One value, one ticker, both handsets (`useDemoClock`, mock-scoring.tsx). Each
rendered clock carries `data-demo-clock="console"` or `"phone"`.

- Q1 opens at **10:00**, which is this league's `periodMinutes`.
- The camera rejoins Q4 at **2:11** and the last minute at **0:41**.
- The buzzer sets it to **0:00** and stops it.
- Verified by the playback drive: **35 of 51 beats show both clocks, 0
  mismatches.**

---

## F. The recap, generated the way the product generates it

`lib/content/recap.ts` is deterministic, so the card's words are derived rather
than written. Walking this game's scoring events through `analyzeGame`:

- margin **6** → `titleVerb` = "tops", `leadVerb` = "defeated"
- **leadChanges = 6** (≥ 4) → "The teams traded the lead 6 times before ... took
  control late."
- **biggestRun = 9-0, Toronto Lords, first quarter** (≥ 6) → the run sentence is
  available too.

Title, as `buildTemplateRecap` writes it:

> Toronto Lords Grade 9 tops Oakville Panthers Grade 9 54–48

Body, first two sentences (what the card shows):

> Toronto Lords Grade 9 defeated Oakville Panthers Grade 9 54–48 on Saturday,
> August 22 in NPH Summer League Summer 2026 action. The teams traded the lead 6
> times before Toronto Lords Grade 9 took control late.

The full body continues with the run sentence and the two top performers
("Darius R. led ... with 22 points", "Andre N. paced ... with 16 points"). The
en-dash in `54–48` is the product's own score glyph, not prose.

**Which generator.** `recap-service.ts` tries Claude first (`recap-claude.ts`)
and falls back to this template. Every RECAP_AI post in the seeded world has
`aiModel: "template"` because no `ANTHROPIC_API_KEY` is set locally, so the
demo shows the template output, which is the one that can be verified.

**Player of the Game** is Darius Reyes, 22 points, which is exactly what the
console's picker suggests: the top scorer (`suggestedPotg`, scoring-console.tsx
L987).

---

## G. The standings move

Computed from the division's **37 completed games** (Grade 9 Boys · Tier 1,
division-only games), then with this result applied. Sorted the way
`lib/standings/compute.ts` sorts: wins first, tiebreakers after.

**Before** (Lords sixth)

| # | Team | W-L | PCT | GB | STRK |
|---|---|---|---|---|---|
| 1 | CKATT Basketball G9 | 7-2 | .778 | 0 | L1 |
| 2 | West United Prep G9 | 6-3 | .667 | 1 | W1 |
| 3 | Burlington Force G9 | 6-4 | .600 | 1.5 | W1 |
| 4 | North Toronto Huskies G9 | 4-5 | .444 | 3 | W3 |
| 5 | Mississauga Monarchs G9 | 4-5 | .444 | 3 | L1 |
| 6 | **Toronto Lords G9** | 4-6 | .400 | 3.5 | L1 |
| 7 | Oakville Panthers G9 | 3-6 | .333 | 4 | W1 |
| 8 | Kings Court Basketball G9 | 3-6 | .333 | 4 | L1 |

**After** (Lords fourth, Panthers eighth)

| # | Team | W-L | PCT | GB | STRK |
|---|---|---|---|---|---|
| 1 | CKATT Basketball G9 | 7-2 | .778 | 0 | L1 |
| 2 | West United Prep G9 | 6-3 | .667 | 1 | W1 |
| 3 | Burlington Force G9 | 6-4 | .600 | 1.5 | W1 |
| 4 | **Toronto Lords G9** | 5-6 | .455 | 3 | W1 |
| 5 | North Toronto Huskies G9 | 4-5 | .444 | 3 | W3 |
| 6 | Mississauga Monarchs G9 | 4-5 | .444 | 3 | L1 |
| 7 | Kings Court Basketball G9 | 3-6 | .333 | 4 | L1 |
| 8 | Oakville Panthers G9 | 3-7 | .300 | 4.5 | L1 |

The demo shows the top six, which is what fits the handset, with the Lords row
highlighted where it lands. **Caveat, stated rather than hidden:** the 4/5/6
cluster is separated here by wins and win percentage; a season's configured
`tiebreakerOrder` (head to head, point differential, and the rest) can reorder
teams on equal wins, and this table does not run those tiebreakers.

---

## H. Departures and punch items

**Declared departures from the product's own rendering**

1. **Type size.** The live page authors its meta at 10.5px, its play rows at
   13.5px and its box score at 13.5px. Everything here is 14px and up, because
   the demo is watched at arm's length on somebody else's laptop, and because
   the readability gate fails anything smaller.
2. **The miss-to-rebound join.** The product joins a miss to the rebound that
   followed it with an em-dash. House copy forbids one, so the demo joins with a
   middot: `#37 Darius R. misses a 3-pointer · offensive rebound #28 Ibrahim W.`
3. **The score chip on the scorer's phone.** The review and scoresheet screens
   in the product rely on the page around them; the demo keeps a compact score
   line on the review heading so the pair never loses the score.
4. **Minutes column.** The live box score shows Min when the fold has per-player
   seconds. The demo does not stage seconds per player, so the column is absent,
   the same as it is for a game whose console never ran a clock.
5. **The play list length.** The real "Latest plays" panel shows five; the
   handset fits three above the fold, and the Play-by-play tab carries eight.

**Punch items**

1. **No assigned scorekeeper or referee to read.** `UserRole` is empty on this
   machine, so the checklist would really render "Not assigned" for both rows
   tonight. The referee shown is a real league referee; the scorekeeper's name
   is invented (§C.4). Fix: seed the scorekeeper and referee assignments for
   Weekend 11 games, then the checklist is fully DB-derived.
2. **No referee assignment for Weekend 11 at all.** `RefereeSessionRequest` has
   no rows for that session, so nobody has actually accepted a shift for this
   game. The referee demo ("The referees", audit §C3) is where that gets built.
3. **The scoresheet is league-only.** `canViewScoresheet` (`lib/scoring/authz.ts`)
   deliberately excludes families: they get the live page and the box score.
   The demo therefore stages the sheet on the SCORER's phone, never the
   parent's, which is exactly the product's rule.
4. **Standings tiebreakers are not run** in the staged table (§G caveat).
5. **The recap needs a key to be the good one.** With `ANTHROPIC_API_KEY` unset
   the recap is the template. The owner still owes that key (deploy runbook).

---

## I. Gates, this build

| Gate | Result |
|---|---|
| `tsc --noEmit` (apps/web) | clean |
| `readability-audit.mjs --routes /demos/game-day` | **0 violations**, 56 scenes, **minimum stage scale 1.000** |
| Playback drive, all 51 beats | **0 console errors**, every beat at scale 1.000 |
| Clock-sync assertion | **35 beats show both clocks, 0 mismatches** |
| Chapter jumps | 5 chapters, each lands on its first beat exactly (the audit walks every chip) |
| Runtime at 1x | **2 min 56 sec** (target 2:45 to 3:20) |
| Screenshots | `scratchpad/overnight/game-day/`: roll call, mid-game sync flash, sign-off, recap |

---

## Sweep, 2026-08-16

No confession beat existed in this cut, and no screen was short: every one of the 51 beats was
re-shot at 1440 and the two handsets are full on all of them. The sweep was a copy pass and one
stale label.

**Copy, 17 captions and balloons.** Gone: "No laptop, no cable, no software", "A sheet that only
counts the shots that went in is not a scoresheet", "He never has to read a word to know what
happened", "And now the thing that happens at every scorer's table in the country", "No app, no
account, no login", "his father watches it happen from his desk", "his father did not miss any of
it", "on the drive home", "Nobody has to remember who had the good night". Two triple-negative
constructions went with them, along with the invented detail that the father is at work at his desk
(the demo knows he is not in the building; it does not know where he is).

Where a balloon only restated the screen it now carries something the screen does not: why minutes
are only counted when somebody runs the clock, why attempts have to be recorded for a shooting line
to exist, and what a PIN proves that a drawn signature does not.

**One stale label.** The end card's eyebrow read "Story 4 of 10"; the directory holds thirteen
demos. It reads "A game-day story" now, so the count cannot go stale again.

Gate re-run: readability audit **0 violations**, minimum stage scale **1.000**, 51 beats / 56
scenes, one headless drive with a clean console. Runtime **2 min 50 sec**.
