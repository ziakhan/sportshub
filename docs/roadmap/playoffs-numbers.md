---
updated: 2026-08-16
tags: [type/reference, status/active, area/demos]
---

# Standings to playoffs: every number on screen, and where it comes from

Status: **SOURCE OF TRUTH for `/demos/standings-to-playoffs`** (rebuilt 2026-08-16 to the
gold standard set by `season-story-numbers.md` and `schedule-change-numbers.md`).

Two rules, the same two as the other sheets:

1. **No number appears in the demo without a line here.**
2. **Every scene names the route the flow lives on today** (scenario audit D2). Section A is
   that list.

| Tag | Meaning |
|---|---|
| `DB` | Read out of the local seeded database on 2026-08-16 |
| `ENGINE` | Output of the product's own pure functions, run against that data (file named) |
| `PRODUCT` | A constant, format or sentence taken from shipping product code (file named) |
| `ARITH` | Arithmetic on rows above it, shown in full |
| `OWNER` | An owner ruling, 2026-08-16 |
| `STAGED` | Composed for the demo. Every one of these is listed in section E as well |

---

## 0. The world, and the two labels the demo drops

Everything runs on the **NPH Showcase League "End of Season"** fixture:

| Field | Value |
|---|---|
| Season id | `860f7c32-65be-45c4-8d4f-84fea6c5d296` |
| League row | `NPH Showcase League — End of Season` |
| Season label | `Fall/Winter 2026-27 (completed)` |
| Status | `IN_PROGRESS` |
| Games | 780: **725 REGULAR / COMPLETED**, 55 PLAYOFF / SCHEDULED |
| Divisions | 22 (7 grades, several run as conference divisions) |
| `gameSlotMinutes` | 75 · `gamesGuaranteed` 10 |
| `tiebreakerOrder` | `[]` (empty), `tiebreakersLockedAt` null |
| `playoffMinGames` | null |
| Attendance events | **0** (`GameEvent` count for the season is zero) |

The demo prints the league as **NPH Showcase League** and the season as **Fall/Winter
2026-27**. The `— End of Season` and `(completed)` suffixes are how this fixture is filed so
it can sit beside the live Showcase world; they are not what the league is called. That is the
only cosmetic edit to any label in the demo.

**Why this world and not the Summer one** (which the schedule-change demo uses): standings
need completed games with scores, and a playoff plan needs a generated bracket. This is the
only world in the database that has both: 725 completed games and a stored `playoffPlan` of
166 structural games across seven grades.

---

## A. This flow exists today: scene by scene

| # | Beat | Flow exists today at | Code |
|---|---|---|---|
| 1 | `open`, `forfeit-table`, `settled`, `tie`, `reread`, `cluster` (the standings table) | `/manage/leagues/[id]/seasons/[seasonId]/manage?tab=standings` | `manage/components/standings-tab.tsx` + `GET /api/seasons/[id]/standings` + `lib/queries/standings.ts` |
| 2 | `to-schedule`, `forfeit`, `forfeit-ok` (the game row and the forfeit) | same console, `?tab=schedule` | `manage/components/schedule-tab.tsx` lines 1112-1133, `PATCH /api/games/[id]` with `{status:"DEFAULTED", defaultedBy}` |
| 3 | `review`, `sign`, `final` (the scorer's table) | `/games/[id]/score` | `components/scoring/scoring-console.tsx` (review header line 997, referee approval panel line 1067, `Mark final` line 1223) → `POST /api/games/[id]/finalize` |
| 4 | `rules-tab`, `add-h2h`, `add-rest`, `lock` (tiebreakers) | same console, Settings › Rules › Tiebreakers | `manage/components/tiebreakers-tab.tsx` (its six options, its sentence, its up/down/Remove, its Locked badge) |
| 5 | `floor` (the eligibility floor) | same console, Settings › Rules › Playoffs | `manage/components/rules-settings.tsx` (`playoffMinGames` input + helper text) |
| 6 | `roster`, `short`, `note`, `ruled` (games played and the ruling) | `/manage/leagues/[id]/seasons/[seasonId]/teams/[submissionId]` | `teams/[submissionId]/page.tsx` (roster table with the GP column) + `eligibility-action.tsx` + `POST /api/seasons/[id]/eligibility-overrides` |
| 7 | `playoffs`, `everyone`, `fit`, `plan`, `rounds` (the plan cards) | same console, `?tab=playoffs` | `manage/components/playoffs-tab.tsx` + `GET/POST/PATCH /api/seasons/[id]/playoff-plan` |
| 8 | `tree`, `ghost`, `third`, `consolation` (the bracket) | same tab, once a plan exists | `components/bracket/bracket-tree.tsx` + `sectionizeBracket` in `components/bracket/types.ts` |
| 9 | `public` (the public page) | `/league/[id]` | `(public)/league/[id]/page.tsx`: the Standings section on `components/ui/standings-table.tsx`, the League news section on `NewsCard`, fed by `RECAP_AI` posts from `lib/content/recap-service.ts` |

---

## B. The standings table: four states, all engine output

Division: **Grade 10 Boys · PRIME**, `DB` division `d8007cec`, **11 approved teams**, ten
games each. Every state below was produced by running the product's own
`computeStandings` (`apps/web/src/lib/standings/compute.ts`) over the season's real games,
exactly as `lib/queries/standings.ts` calls it. `ENGINE`.

### B1. State A, Saturday evening (beat `open`)

Two games of the division have not been played: MBA vs Burloak (Sunday) and YvY vs Vaughan
(Saturday night). Computed over every other game.

| # | Team | GP | W | L | PF | PA | Diff | Win% |
|---|---|---|---|---|---|---|---|---|
| 1 | MBA | 9 | 6 | 3 | 571 | 518 | +53 | 67% |
| 2 | Vaughan Panthers | 9 | 6 | 3 | 573 | 527 | +46 | 67% |
| 3 | Retro Elite | 10 | 6 | 4 | 598 | 600 | -2 | 60% |
| 4 | Alpha Elite | 10 | 6 | 4 | 620 | 623 | -3 | 60% |
| 5 | Hooptrotters OGs | 10 | 6 | 4 | 659 | 583 | +76 | 60% |
| 6 | Toronto Top Tier East | 10 | 6 | 4 | 692 | 636 | +56 | 60% |
| 7 | Burloak Elite (PRIME) | 9 | 5 | 4 | 589 | 595 | -6 | 56% |
| 8 | Eurostep Basketball | 10 | 5 | 5 | 653 | 675 | -22 | 50% |
| 9 | Ottawa Elite (incl. Prep) | 10 | 4 | 6 | 664 | 673 | -9 | 40% |
| 10 | Royal Crown | 10 | 2 | 8 | 629 | 706 | -77 | 20% |
| 11 | YvY Elite | 9 | 1 | 8 | 508 | 620 | -112 | 11% |

Win% is printed as a whole percent because that is what the tab renders:
`{(row.winPct * 100).toFixed(0)}%`. `PRODUCT`.

### B2. State B, after the forfeit (beat `forfeit-table`)

Only two rows move, and only in W, L and GP: Vaughan to 7-3 (10 GP) and first, YvY to 1-9
(10 GP). **No points column changes**, because `compute.ts` credits a `DEFAULTED` game
`applyGame(winner, 0, 0, "W")` and `applyGame(loser, 0, 0, "L")`. `ENGINE`, and the arithmetic
is section C.

### B3. State C, after Sunday's final (beat `settled`)

MBA 69, Burloak Elite (PRIME) 53 is signed. MBA to 7-3, PF 640 (571 + 69), PA 571 (518 + 53),
diff +69; Burloak to 5-5, PF 642, PA 664. Every row is now at ten games, and MBA sit first on
the raw sort (wins, then win percentage, then insertion order).

### B4. State D, with the tiebreakers configured (beats `reread`, `cluster`)

Same games, re-read with `tiebreakerOrder = [HEAD_TO_HEAD, POINT_DIFFERENTIAL, POINTS_SCORED,
POINTS_ALLOWED, WINS, COIN_FLIP]`. `ENGINE`:

| # | Team | GP | W | L | PF | PA | Diff | Win% | Tiebreakers column |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Vaughan Panthers | 10 | 7 | 3 | 573 | 527 | +46 | 70% | HEAD_TO_HEAD |
| 2 | MBA | 10 | 7 | 3 | 640 | 571 | +69 | 70% | HEAD_TO_HEAD |
| 3 | Toronto Top Tier East | 10 | 6 | 4 | 692 | 636 | +56 | 60% | HEAD_TO_HEAD, POINT_DIFFERENTIAL |
| 4 | Retro Elite | 10 | 6 | 4 | 598 | 600 | -2 | 60% | HEAD_TO_HEAD, POINT_DIFFERENTIAL |
| 5 | Hooptrotters OGs | 10 | 6 | 4 | 659 | 583 | +76 | 60% | HEAD_TO_HEAD |
| 6 | Alpha Elite | 10 | 6 | 4 | 620 | 623 | -3 | 60% | HEAD_TO_HEAD |
| 7 | Eurostep Basketball | 10 | 5 | 5 | 653 | 675 | -22 | 50% | POINTS_SCORED |
| 8 | Burloak Elite (PRIME) | 10 | 5 | 5 | 642 | 664 | -22 | 50% | POINTS_SCORED |
| 9 | Ottawa Elite (incl. Prep) | 10 | 4 | 6 | 664 | 673 | -9 | 40% | · |
| 10 | Royal Crown | 10 | 2 | 8 | 629 | 706 | -77 | 20% | · |
| 11 | YvY Elite | 10 | 1 | 9 | 508 | 620 | -112 | 10% | · |

**THE REAL RULE, NAMED.** First place is decided by **head-to-head record**, the first
tiebreaker in the order. `DB`: MBA and Vaughan Panthers met **once**, on 24 October 2026, and
Vaughan won it **70 to 66**. `headToHeadScore` in `compute.ts` gives Vaughan +1 and MBA -1, so
Vaughan hold first. That is the only meeting between them all season, which is why the
demo's line is "They met once, in October, and Vaughan won it by four."

The four teams at 6-4 sort by head-to-head first (`DB` results between them: Hooptrotters beat
Alpha 66-55, Toronto Top Tier beat Alpha 77-56 and beat Hooptrotters 71-61), and where head to
head leaves a pair level the next rule, point differential, separates them. Eurostep and
Burloak are level on record AND differential (-22 each), so the engine falls to points scored
(653 against 642).

**The Tiebreakers column prints the enum keys**, not the friendly labels: the tab renders
`row.appliedTiebreakers.join(", ")` and `compute.ts` pushes the `TiebreakerKey`. The demo
prints exactly that (`HEAD_TO_HEAD, POINT_DIFFERENTIAL`), and it is a punch item, section E.
`PRODUCT`.

**The empty cell.** The real column prints an em-dash character when nothing was applied. The
house copy rule bans that character in user-facing copy, so the demo prints a middot there.
Declared, and the only character substitution in the demo.

---

## C. The forfeit: the one staged change, with its arithmetic

`DEFAULTED` is real product, end to end:

* the Schedule tab has two buttons, `Forfeit: home` and `Forfeit: away`, on every expanded
  game row (`schedule-tab.tsx` lines 1112-1133). `PRODUCT`;
* the home one carries exactly this confirmation, which the demo quotes verbatim: *"Record a
  FORFEIT by the home team? The away team is awarded the win in standings."* `PRODUCT`;
* it PATCHes `{ status: "DEFAULTED", defaultedBy: g.homeTeamId }`. `PRODUCT`;
* `compute.ts` awards the other team a win and the forfeiting team a loss **with zero points
  each way**, and `headToHeadScore` counts a defaulted game as a head-to-head win. `PRODUCT`.

No game in the seeded world is `DEFAULTED`, so **one** real game is staged as one:

| Field | Value |
|---|---|
| Game | `DB` `8b741570-ea69-4864-acf2-32922ce31f18` |
| Real result | YvY Elite 50, Vaughan Panthers 53, Sat 6 Feb 2027, 6:45 p.m., The Playground Court 3 |
| In the demo | `DEFAULTED`, `defaultedBy` = YvY Elite (the home team) |

`ARITH`, the whole difference this makes to the demo's table against the raw database:

| Row | DB (game played) | Demo (game forfeited) | Why |
|---|---|---|---|
| Vaughan Panthers | 7-3, PF 626, PA 577, +49 | 7-3, PF **573**, PA **527**, **+46** | minus the 53 they scored and the 50 they conceded |
| YvY Elite | 1-9, PF 558, PA 673, -115 | 1-9, PF **508**, PA **620**, **-112** | minus the 50 they scored and the 53 they conceded |

**Nothing else moves.** Same W and L for both teams (Vaughan won it either way), same order in
the division under both the raw sort and the configured tiebreakers, and, checked explicitly,
**the 42 pooled Grade 10 seeds are identical** with and without the forfeit, so the real
bracket in section D is exactly right for the demo's world. `ENGINE`.

---

## D. The playoff plan: the real Grade 10 bracket

`DB` `Season.playoffPlan` holds **166 structural games** across seven grades, generated
2026-08-10. `Season.playoffConfig` for Grade 10:

```json
{"pooling":"GRADE","weekendId":null,"qualifiers":"all","thirdPlace":true,
 "openingRound":"DIVISION_FIRST","formatOverride":null,"maxGamesPerDay":3,"guaranteedGames":2}
```

### D1. The field

`DB`, approved teams by division: Grade 10 · ARETE 13, Grade 10 · GAME SPEAKS 13, Grade 10 ·
PRIME 11, Grade 10 · DMV CHILL 5. `ARITH`: **42 teams**, pooled into one championship because
`pooling` is `GRADE`.

### D2. The structure

`ENGINE`, `buildStructure(42, cfg)` in `lib/scheduler-v2/playoffs.ts`, which matches the
stored plan game for game:

| Round | Tier | Games |
|---|---|---|
| Round of 64 (the tab's first column prints **Opening round**) | 0 | 10 |
| Round of 32 | 1 | 16 |
| Consolation | 1 | 5 |
| Round of 16 | 2 | 8 |
| Quarterfinal | 3 | 4 |
| Semifinal | 4 | 2 |
| Final | 5 | 1 |
| 3rd place | 5 | 1 |
| **Total** | | **47** |

`byes: 22`, and the generator's own notes are `22 byes ... top 22 seeds skip round 1.` and
`Round-1 losers get a consolation game ... everyone who plays round 1 plays at least twice.`
(both written with an em-dash in `playoffs.ts` where the ellipsis stands here).
The tab renders the first as "The top 22 teams skip round 1." `PRODUCT`.

`ARITH`: 64 slots for 42 teams leaves 22 byes; the 20 teams seeded 23 to 42 play the opening
round, and the 10 losers pair into the 5 consolation games. That is the "everybody plays,
bottom teams in extra converging rounds" shape the owner asked for, and it is what the world
already holds.

The **Opening round** column head is not in the data: `roundLabel` in `bracket-tree.tsx`
renames a championship section's first column from "Round of 64" to "Opening round". The demo
does the same and says so on screen in the opening-round blurb. `PRODUCT`.

### D3. The games the demo draws, all straight from the stored plan

| Card | Round | Tier | Home | Away | Kick-off (as `WHEN()` formats it) |
|---|---|---|---|---|---|
| G35 | Quarterfinal | 3 | Winner of G27 | Winner of G28 | Sun, Feb 28, 1:45 p.m. |
| G36 | Quarterfinal | 3 | Winner of G29 | Winner of G30 | Sun, Feb 28, 1:45 p.m. |
| G39 | Semifinal | 4 | Winner of G35 | Winner of G36 | Sun, Feb 28, 4:15 p.m. |
| G46 | Final | 5 | Winner of G39 | Winner of G40 | Sun, Feb 28, 6:45 p.m. |
| G47 | 3rd place | 5 | Loser of G39 | Loser of G40 | Sun, Feb 28, 6:45 p.m. |
| G41 | Consolation | 1 | Loser of G1 | Loser of G2 | Sat, Feb 27, 4:15 p.m. |
| G42 | Consolation | 1 | Loser of G3 | Loser of G4 | Sat, Feb 27, 5:30 p.m. |
| G1 | Opening round | 0 | 35 Brotherhood Elite | 36 FEIA (Fort Erie) | Sat, Feb 27, 10:00 a.m. |
| G3 | Opening round | 0 | 24 Dragons de Gatineau (GAME SPEAKS) | 41 Wiggins Elite | Sat, Feb 27, 10:00 a.m. |

Times are the plan's `startIso` rendered by the tab's own `WHEN()`
(`toLocaleString("en-CA", {weekday, month, day, hour, minute})`) in America/Toronto, which is
what an operator in this league sees. `PRODUCT`.

Seeds 35, 36, 24 and 41 are the plan's own `SEED` refs with the names it resolved. The seeding
rule is in `api/seasons/[id]/playoff-plan/route.ts` lines 429-436: merge the grade's division
rows, then sort by **wins, then losses, then point differential, then name**. `PRODUCT`.

**Why the demo draws a REGION and not the whole tree.** The full championship section is six
columns and 42 games; at scale 1.0 in 1160 by 600 it cannot be read, and shrinking it is the
exact failure audit D2 bans. The demo draws quarterfinals through champion (the end everybody
recognises), plus the third place, consolation and opening-round blocks on a second frame, and
the round strip states the whole shape in one line. The geometry, the elbow connectors, the
dashed ghost slots with their real references, the seed chips and the gold champion node are
all `bracket-tree.tsx`'s, re-scaled so nothing is under 14px.

### D4. The weekend and the fit line

`DB`: the Grade 10 plan's `weekendId` `38611881` is `SeasonSession` **"Tier 2 Finals · Feb
27-28"**, phase `PLAYOFF`, two days, each with The Playground (3 courts) and Six Park East (6
courts), 10:00 to 22:00.

`ARITH`, on the route's own supply formula
(`floor((closeMin - openMin) / slotMinutes) * courts`, summed over day venues):

* per court per day: `floor(720 / 75)` = **9 slots**
* per day: `9 × 3` + `9 × 6` = **81**
* two days: **162 slots**
* load on that weekend: Grade 10 47 + Grade 11 28 + Grade 8 9 = **84 games** (the three grades
  whose plan games carry that `weekendId`)

which is the fit sentence the card renders:
`47 games · fits Tier 2 Finals · Feb 27-28 (84 of 162 slots with the other grades)`.

`finalDayName` is the weekend's last day, 28 Feb 2027, a **Sunday**, which is what fills the
tab's promise sentence *"Everyone plays at least 2 games; champion crowned Sunday."*

### D5. The toast

The product's own message is season-wide:
`${games} playoff games planned. ${placeholders} show placeholders until the regular season
decides the teams.` The demo is showing one grade, so its toast is scoped to that grade
(`47 playoff games planned · Grade 10`) rather than quoting a season-wide number the scene
never explains. Declared here, punch item E5. `ARITH` for the record: of Grade 10's 47 games,
16 have both teams resolved (the 10 opening-round games plus the 6 round-of-32 games between
two seeds) and **31 carry placeholders**.

---

## E. Punch list: what the product cannot honestly show yet

**E1. No enforcement of the eligibility floor, and no data for it in this world. `OWNER`.**
The owner ruled that the demo shows a **four games played** floor as the standard. What is
real: `Season.playoffMinGames` is a season setting (`rules-settings.tsx`), games played come
from the scorekeeper's roll call (`lib/seasons/games-played.ts` counts `ATTENDANCE`
`GameEvent`s on completed games), `computeEligibility` merges the count with the rule and any
override, the team page renders the GP column and the badges, and `eligibility-action.tsx`
requires a written note before it will save a ruling (`note.trim().length < 3` disables both
buttons). What is NOT real:

* **nothing enforces it.** The only consumer of `computeEligibility` in the repo is that team
  page. No roster lock, no scoring console and no playoff generator ever checks it, so an
  ineligible player can be on the floor on Saturday. It is a display and a record.
* **this world has no attendance events at all** (0 `GameEvent` rows) and no `SeasonRoster`
  rows, so a real screenshot of the flow would show 0 of 4 for every player of a team with no
  roster.

So the roster in the demo is invented, as every roster in every demo is (real rosters are
minors), the ten players and their game counts are `STAGED`, and the beat is the owner's
aspiration staged on the product's real screens. **Punch line: build the gate, and seed the
roll call.** Until then this beat is the only one in the demo whose numbers are not derived.

**E2. There is no public bracket. Verified.** `components/bracket` is imported by exactly one
file in the repo, `manage/components/playoffs-tab.tsx`. The public league page
(`(public)/league/[id]/page.tsx`) renders standings, games, leaders, news, clubs and the
published season plan, and mentions playoffs only as a text label
(`season.playoffFormat.replace(/_/g, " ")`, which is null in this world). The demo therefore
does **not** stage a public bracket page, and the 2026-08-15 cut's claim that "the public
league page has it the same second" is retired with it. Punch item: publish the bracket.

**E3. The standings tab prints enum keys.** `HEAD_TO_HEAD, POINT_DIFFERENTIAL` rather than the
friendly labels the Tiebreakers tab already owns ("Head-to-head record", "Point
differential"). The demo prints what the product prints. One-line fix, worth doing before the
send.

**E4. The MILESTONE standings-movement card never reaches the league page.**
`detectAndPublishStandingsMovement` is real and fires at finalize; for this game it would
publish *"MBA jumps to 1st in Grade 10 Boys · PRIME"*. Its tags are `{gameId}` and `{teamId}`
only, while the league page's news query filters `tags: { some: { leagueId } }`, so the card
lands on team and feed surfaces and not on the league page. The demo does not show it, for two
reasons: that tag gap, and because the configured tiebreakers immediately put Vaughan back
first, which would make a published "MBA jumps to 1st" card read as wrong within the same
demo. Punch item: tag movement cards with the league, and compute them with the configured
tiebreaker order.

**E5. The plan toast is season-wide.** See D5.

**E6. The seeding ladder ignores the configured tiebreakers.** The standings table sorts with
`tiebreakerOrder`; the playoff seeding sorts by wins, losses, differential, name. On this world
they disagree at the top of Grade 10 PRIME (the table has Vaughan first on head to head, the
seeding has MBA as the higher seed on differential). The demo never puts the two side by side,
and the bracket region it draws carries no seed numbers for either team. Punch item: seed off
the same ordering the table shows.

**E7. No box score in the review scene.** This world has zero scoring events, so the console's
box score would be empty. The review scene shows the header sentence and the referee approval
panel only, rather than inventing player lines.

---

## F. The recap card on the public page

`PRODUCT`, `lib/content/recap-service.ts` + `lib/content/recap.ts`. On finalize the product
auto-publishes a `RECAP_AI` post, tagged with the game, both teams, both clubs **and the
league**, so it does appear in the league page's News section, where `NewsCard` prints
"Game recap" as the author.

With no `ANTHROPIC_API_KEY` the text comes from `buildTemplateRecap`. For MBA 69, Burloak
Elite (PRIME) 53 the margin is 16, so `titleVerb(16)` is "rolls past" and `leadVerb(16)` is
"rolled past":

* title: **MBA rolls past Burloak Elite (PRIME) 69–53**
* first sentence: **MBA rolled past Burloak Elite (PRIME) 69–53 on Sunday, February 7 in NPH
  Showcase League Fall/Winter 2026-27 action.**

`DB`: the game is `32bcd68c-f9d4-42b9-8e25-6d9aea19b155`, scheduled `2027-02-08T01:00:00Z`,
which is Sunday 7 February 2027 at 8:00 p.m. in America/Toronto, at The Playground, Court 2.

The public standings block is `components/ui/standings-table.tsx`: Team, W, L, PCT, GB, STRK.
The demo shows the top six rows of state D with PCT as a three-decimal fraction and GB derived
the way the page derives it (`((leader.wins - row.wins) + (row.losses - leader.losses)) / 2`),
which gives 0 for MBA and 1 for the four teams at 6-4. `PRODUCT`.

STRK is the trailing run `lib/queries/standings.ts` computes by walking the season's COMPLETED
games in date order. `ENGINE`, run over the same game set: Vaughan **W1**, MBA **W3**, Toronto
Top Tier East **W1**, Retro Elite **L1**, Hooptrotters OGs **L2**, Alpha Elite **W5**.
Vaughan's W1 is their last PLAYED win, because that walk skips defaulted games: the forfeit
counts in the table and not in the streak, which is the product's behaviour and not a demo
choice.

---

## G. Presentation and gates

| Gate | Result |
|---|---|
| `scripts/demo/readability-audit.mjs --routes /demos/standings-to-playoffs` | **0 violations**, minimum stage scale **1.000**, 36 scenes |
| Playback drive (chapter jumps + every beat + a full autoplay pass) | **0 console errors** |
| Chapter jumps | 4 chips, each landing on its chapter's first beat with the right context strip |
| Runtime at 1x | **2 min 26 sec** across 32 beats |
| `tsc --noEmit` | clean |
| Em-dash sweep | clean |

Screenshots: `scratchpad/overnight/playoffs/` (standings, bracket tree, the third
place/consolation/opening board, and the eligibility ruling).

One shared fix rode along, because it is what stood between this demo and a clean console:
`BeatCallout`'s arrow in `components/demo-directory/motion.tsx` mixed the `borderWidth`
shorthand with per-side longhands, so React warned every time a balloon flipped sides between
beats. All four widths are now written as longhands. No visual change, and every other story
gets a quiet console too.
