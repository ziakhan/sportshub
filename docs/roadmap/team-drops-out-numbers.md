---
updated: 2026-08-16
tags: [type/reference, status/active, area/demos]
---

# A team drops out: every number on screen, and where it comes from

Status: **SOURCE OF TRUTH for `/demos/team-drops-out`** ("A team drops out", built
2026-08-16 to the gold standard set by the season story and the schedule-change demo).

Same two rules as `season-story-numbers.md` and `schedule-change-numbers.md`:

1. **No number appears in the demo without a line here.**
2. **Every scene names the route the flow lives on today** (audit D2). Section A is that list.

| Tag | Meaning |
|---|---|
| `DB` | Read out of the local seeded database on 2026-08-16 (NPH Showcase League, season Fall/Winter 2026-27, `seasonId 160b2f09-a95a-4a64-9b90-03793cae105b`) |
| `PRODUCT` | A constant, format or sentence taken from shipping product code (file named) |
| `ARITH` | Arithmetic on rows above it, shown in full |
| `OWNER` | A ruling in the 2026-08-16 scenario audit |

---

## 0. Why this runs on the Showcase world, and it is not a preference

**Because the withdrawal is real.** `DB` the database holds exactly **one**
`WithdrawalRequest` row, and it is on this season:

| Field | Value |
|---|---|
| `id` | `0f2e947b-67d6-42f6-be50-3e3745f7caee` |
| `type` | `CLUB_FROM_LEAGUE` |
| `status` | `PENDING` |
| `reason` | "Not enough committed players to travel this winter · we have to pull out." (the row stores an em-dash where the middot is; the house copy rule substitutes it on screen and here) |
| `submissionId` | `0328b7ec-a10c-41fd-8f70-40688947c9fb`, status `APPROVED` |
| team / club | **Orillia Lakers** |
| division | **Grade 10 Boys · Division D** |
| season | NPH Showcase League · Fall/Winter 2026-27 |
| `createdAt` | 2026-08-02 |

The brief said "pick whichever world has a real withdrawal or the richest honest staging
basis, and record the choice." This world has **both**: the only withdrawal request in the
database, and the only division whose arithmetic after a dropout is clean enough to read
on camera (section C). The Summer world, which the schedule-change demo runs on, has no
withdrawal row at all.

> **Every number in this demo is real, including the awkward one.** Vanguard North Prep
> ends on **8**, not 9, because the draw put them against the Lakers **twice**. That is not
> a staged flourish; it is what the games table says, and the demo makes a beat of it
> because a per-team guarantee that only ever subtracts one is a guarantee nobody has
> tested.

### The one thing this world cannot show, and the demo says so on camera

`DB` all **725** games in this season have `publishedAt` null: the season is in
`REGISTRATION` and the schedule is a draft. That does **not** change the cascade, which is
the point worth understanding: `lib/withdrawals/requests.ts` line 291 filters on
`status in (SCHEDULED, POSTPONED)` and `scheduledAt > now` and **never looks at
`publishedAt`**, so all ten games cancel and all nine opposing clubs are notified exactly
as they would be on a published season. What it does change is who ELSE would have felt it,
and the demo states that plainly in the notification card's own footer rather than letting
a viewer assume family calendars were disturbed:

> "Sent to the front office of all 9 opposing clubs. Referees and the league office are
> left out on purpose, and this schedule has not been published yet, so no family calendar
> carried these games."

---

## A. This flow exists today: scene by scene

| # | Beat | Flow exists today at | Code |
|---|---|---|---|
| 1 | `open`, the season's own scale | `/manage/leagues/[id]/seasons/[seasonId]/manage?tab=teams` | `manage/components/teams-tab.tsx` |
| 2 | `queue`, the withdrawal queue | same | `components/withdrawal-requests-panel.tsx`, mounted at `teams-tab.tsx` line 59 |
| 3 | `reason`, the reason on the row | same | `withdrawal-requests-panel.tsx` line 107; the reason is `required` and min 3 chars at the club end (`league-roster-manager.tsx`) |
| 4 | `warning`, what Approve will do | same | `withdrawal-requests-panel.tsx` lines 88 to 91, verbatim |
| 5 | `approve` | `PATCH /api/withdrawal-requests/[id]` with `{action:"approve"}` | `api/withdrawal-requests/[id]/route.ts` into `lib/withdrawals/requests.ts` `decideWithdrawalRequest` |
| 6 to 10 | `cascade` and the four writes | **server side only** | `lib/withdrawals/requests.ts` lines 277 to 306, one `$transaction`. No screen shows it: section F punch 3 |
| 11 | `told`, the opponents' notification | the bell, and `/notifications` | `lib/withdrawals/requests.ts` lines 315 to 345, `notifyMany` |
| 12 | `told-honest`, who is NOT in it | same | the audience is `UserRole` where `tenantId in (opponent tenants)` and `role in (ClubOwner, ClubManager, Trainer)`. Nothing else. Section F punch 1 |
| 13 to 16 | `schedule`, `count`, `vanguard`, `rest`, the guarantee callout | `/manage/leagues/[id]/seasons/[seasonId]/manage?tab=schedule` | `manage/components/schedule-tab.tsx` lines 679 to 707 (the callout) and lines 392 to 405 (`gapTeams`) |
| n/a | the Team check grid under it | same tab | `manage/components/team-check.tsx` lines 88 to 130 |
| 17 | `preview`, "Preview the fix" | `POST /api/seasons/[id]/schedule/preview` with `{fillGapsOnly:true}` | `schedule-tab.tsx` `previewGaps` lines 406 to 423 |
| 18 | `result`, what the preview returns | same | `api/seasons/[id]/schedule/preview/route.ts` lines 43 to 47 |
| 19 | `add`, "Add ONLY the missing games" | `POST /api/seasons/[id]/schedule/commit` with `{fillGapsOnly:true}` | `schedule-tab.tsx` `commitGaps` lines 425 to 449 |
| 20 | `confirm`, the confirmation sentence | native `confirm()` | `schedule-tab.tsx` line 429, verbatim |
| 21 | `proof`, the callout gone and every team on ten | `?tab=schedule` | `gapTeams` recomputes to empty; `team-check.tsx` line 62 flips its header to "Every team has 10 games" |
| 22 | `draft`, the draft banner | same | `schedule-tab.tsx` lines 710 to 720 |
| 23 | `end` | n/a, the end card | |

---

## B. The season, before anybody leaves

| On screen | Value | Source |
|---|---|---|
| League | NPH Showcase League | `DB` League.name |
| Season | Fall/Winter 2026-27 | `DB` Season.label, status `REGISTRATION` |
| Teams approved | **145** | `DB` count of `TeamSubmission` with status `APPROVED` on this season (146 rows, one `REJECTED`) |
| Games drawn | **725** | `DB` count of Game rows on this season, all `SCHEDULED`, all unpublished |
| Divisions | **16** | `DB` count of `SeasonDivision` |
| Games guarantee | **10** | `DB` `Season.gamesGuaranteed = 10`. This is the field `schedule-tab.tsx` reads as `league?.gamesGuaranteed` (the tab's `league` prop is the season's config object) |
| Every approved team's game count, before | **10 each** | `DB` `ARITH` 725 games × 2 team-slots = 1450 = 145 teams × 10. The schedule is complete and `gapTeams` is empty before the withdrawal, verified by running the component's own arithmetic over the real rows |
| The Registered teams slice on screen | 4 rows, chip reads "11 of 145" | `OWNER`/composition: four rows is what fits the scene at scale 1.0 beside the amber panel. 11 is the real size of Division D, and the chip carries the product's own "N of M" shape |

---

## C. The withdrawal, and the ten games

| On screen | Value | Source |
|---|---|---|
| Row title | "Orillia Lakers · withdraw from Fall/Winter 2026-27" | `PRODUCT` `withdrawal-requests-panel.tsx` line 103 |
| Reason | "Not enough committed players to travel this winter · we have to pull out." | `DB` verbatim. The row stores an em-dash; the house copy rule turns it into a middot, exactly as the season story does with the auditor's sentence |
| Date | Aug 2 | `DB` `createdAt`, rendered `{month:"short", day:"numeric"}` as the panel does |
| Division | Grade 10 Boys · Division D | `DB` |
| The panel's standing sentence | "These clubs are asking to leave the season. Approving cancels their upcoming games and notifies opponents." | `PRODUCT` verbatim, `withdrawal-requests-panel.tsx` lines 88 to 91 |
| **Games cancelled** | **10** | `DB` running the cascade's own query against the real rows: `seasonId` = this season, `status in (SCHEDULED, POSTPONED)`, `scheduledAt > now`, home or away = Orillia Lakers |
| **Opposing clubs told** | **9** | `DB` distinct `Team.tenantId` across those ten games' opponents. Nine, not ten, because Vanguard North Prep appears twice |
| Notification title | "Games Cancelled · Opponent Withdrew" | `PRODUCT` `lib/withdrawals/requests.ts` line 338. The product writes an em-dash; middot by the house rule |
| Notification body | "Orillia Lakers has withdrawn from NPH Showcase League. 10 upcoming game(s) against them have been cancelled." | `PRODUCT` line 339, verbatim **including "game(s)"**. See section F punch 4 |

### The ten games, in full

`DB`, ordered as the schedule holds them. All at The Playground; all unpublished.

| # | When | Opponent | Court | Session |
|---|---|---|---|---|
| 1 | Sat 24 Oct, 3:00 PM | Retro Elite | Court 1 | Weekend 1 · Oct 24 |
| 2 | Sun 25 Oct, 8:00 PM | Toronto Top Tier East | Court 2 | Weekend 1 · Oct 24 |
| 3 | Sat 14 Nov, 10:00 AM | FEIA (Fort Erie) | Court 3 | Weekend 3 · Nov 14 |
| 4 | Sat 14 Nov, 4:15 PM | Vanguard North Prep | Court 1 | Weekend 3 · Nov 14 |
| 5 | Sat 12 Dec, 11:15 AM | Vaughan Panthers | Court 1 | Weekend 6 · Dec 12 |
| 6 | Sat 12 Dec, 3:00 PM | Malton Sting Basketball | Court 1 | Weekend 6 · Dec 12 |
| 7 | Sun 10 Jan, 10:00 AM | Dragons de Gatineau (DMV CHILL) | Court 1 | Weekend 8 · Jan 9 |
| 8 | Sun 10 Jan, 1:45 PM | Alpha Elite | Court 1 | Weekend 8 · Jan 9 |
| 9 | Sat 6 Feb, 1:45 PM | **Vanguard North Prep (again)** | Court 3 | Weekend 11 · Feb 6 |
| 10 | Sat 6 Feb, 5:30 PM | EM Elite | Court 3 | Weekend 11 · Feb 6 |

Burloak Elite (PRIME) is the eleventh team in the division and was **never** drawn against
the Lakers, which is why the Team check grid keeps one green row while the other nine go
amber. That is `DB`, not composition.

---

## D. Who is now short, and the callout that says so

`PRODUCT` `schedule-tab.tsx` `gapTeams`, lines 392 to 405: count every non-`CANCELLED`
game per team, keep every `APPROVED` submission whose count is under the target. The
withdrawn submission leaves the `APPROVED` filter, so the club that left is not in its own
callout.

The demo's numbers were produced by running **that exact arithmetic** over the real rows
with the ten games removed in memory. Nothing was written to the database.

| On screen | Value | Source |
|---|---|---|
| gapTeams **before** the withdrawal | **0** | `ARITH` over `DB`. The callout does not render at all |
| gapTeams **after** | **9** | `ARITH` over `DB` |
| Callout line 1 | "9 teams are below the 10-game guarantee · usually a dropout, a late-added team, or a new make-up session." | `PRODUCT` lines 681 to 689, verbatim (em-dash to middot) |
| Callout line 2, as the product truncates it | "FEIA (Fort Erie) (9) · Alpha Elite (9) · Retro Elite (9) · Vaughan Panthers (9) · +5 more" | `PRODUCT` lines 690 to 696: first four, `"${name} (${count})"`, joined by a middot, then `+N more` |
| The nine, in full | FEIA (Fort Erie) 9 · Alpha Elite 9 · Retro Elite 9 · Vaughan Panthers 9 · EM Elite 9 · Malton Sting Basketball 9 · **Vanguard North Prep 8** · Toronto Top Tier East 9 · Dragons de Gatineau (DMV CHILL) 9 | `DB` |
| The two buttons | "Preview the fix" and "Add ONLY the missing games" | `PRODUCT` lines 698 to 703, verbatim including the capitalised ONLY |
| The line beside them | "Nobody's existing games move." | `PRODUCT` lines 704 to 706, verbatim |
| **Team-slots short** | **10** | `ARITH` 8 teams × 1 + 1 team × 2 |
| **New games needed** | **5** | `ARITH` 10 team-slots ÷ 2 teams per game |
| Teams still on 10 of 10 | **135** | `ARITH` 145 approved, minus the 1 that left, minus the 9 short |
| Other divisions untouched | **15** | `ARITH` 16 divisions, minus Division D |
| Games moved to make room | **0** | Section E |
| Team check header, before | "1 of 10 teams fully scheduled" | `PRODUCT` `team-check.tsx` lines 71 to 75, over the ten remaining Division D teams |
| Team check header, after | "Every team has 10 games" | `PRODUCT` `team-check.tsx` lines 63 to 67 |
| Games in the season, after the withdrawal | **715** | `ARITH` 725 − 10 |
| Games in the season, after the fix | **720** | `ARITH` 715 + 5 |

---

## E. THE TRUST LINE, AND WHY IT MAY BE SPOKEN

The brief was explicit: *"nobody else's weekend moved" may only be spoken if the product
genuinely does incremental addition; otherwise stage what is real and punch the rest.*

**It may be spoken.** `fillGapsOnly` preserves existing games at three independent layers,
each verified in the shipping code:

1. **The UI asks for it.** `schedule-tab.tsx` `commitGaps` (line 434) posts
   `{ fillGapsOnly: true }`, and the code comment above `gapTeams` (lines 389 to 392)
   states the intent: *"Fill the gaps ADDS games only · nobody's existing schedule moves."* (the comment writes an em-dash)
2. **The route cannot delete.** `api/seasons/[id]/schedule/commit/route.ts` line 76:
   `const replaceExisting = fillGapsOnly ? false : parsed.replaceExisting`. The write
   transaction's `deleteMany` sits inside `if (replaceExisting)`, so with `fillGapsOnly`
   set that branch is **unreachable**. Only `createMany` runs. The zod field carries the
   same promise in words: *"don't touch ANY existing game · treat the whole current
   schedule as fixed and only ADD games for teams under their guarantee."*
3. **The generator cannot collide.** The route loads every current non-cancelled
   `REGULAR`-phase game as `input.existingGames` (lines 110 to 121), and
   `lib/scheduler/generate.ts` (lines 1496 to 1527) books each one into
   `teamBookings[home/away]` and `markCourtBusy(courtId, start, end)` before placing
   anything, and subtracts already-played pairings from the pairing pool. New games can
   only land in time and court space nothing already occupies.

So the demo's three preview counters (`existing games moved 0`, `existing games deleted 0`,
`teams still short 0`) are claims the code makes structurally, not numbers this demo
invented. The end card's "nobody else's weekend moved" rests on the same three layers.

> **RECORDED, and it belongs on the record.** `fillGapsOnly` runs the **legacy v1
> scheduler** (`generateSchedule`), not scheduler v2 (`solveSeasonV2`), which is what the
> plain "Preview whole season" button now runs. The route's own comments say so
> (`preview/route.ts` lines 73 to 85: `fillGapsOnly` is one of the `legacyMode`
> conditions). The gap fill is live, wired and correct; it is simply a different engine
> from the one the season story films. **PUNCH: port the gap fill onto v2**, or write down
> that v1 owns recovery permanently.

---

## F. What the product cannot honestly show, and is therefore NOT staged

### 1. Nobody's family is told, and no email is sent

The cascade's whole audience is `UserRole` where `tenantId in (the opponents' tenants)` and
`role in (ClubOwner, ClubManager, Trainer)` (`lib/withdrawals/requests.ts` lines 325 to
332). It never calls `getGameAudienceUserIds`, and it never calls `emailGameAudience`; both
of those are wired only to the manual single-game endpoint `PATCH`/`DELETE /api/games/[id]`.
So on a withdrawal: **opponent club offices get a bell and a push, and that is the entire
fan-out.** No parent, no coach, no email.

The demo therefore counts **club offices**, not people, and says so on camera in the
notification card's footer. It would have been easy and false to reuse the schedule-change
demo's "26 people" shape here.

**PUNCH: run the withdrawal cancellation through `getGameAudienceUserIds` and
`emailGameAudience`**, the same as a single-game cancel. Ten games coming off a published
season with only the club office told is the bug the demo surfaced.

### 2. The cancelled games carry no reason

`Game.statusReason` exists and the notification templates already interpolate it, but both
withdrawal paths write `{ status: "CANCELLED" }` and nothing else. So the cancelled rows
say cancelled and nothing more, and the demo does not put a reason on them.
**PUNCH: write `statusReason` from the withdrawal cascade**; the reason is right there on
the request.

### 3. Nothing shows the operator what the approval did

`decideWithdrawalRequest` does four writes in one transaction and returns
`{ cancelledGames: n }` to a panel that discards it. No receipt, no undo, no "here is what
changed" anywhere. So chapter 2 is drawn as an **explicit narration card**, navy, with no
console chrome on it and a context strip that stops naming a product screen, exactly as the
schedule-change demo does with its fan-out ledger. **PUNCH: a receipt on the Teams tab.**

### 4. The notification says "game(s)"

`lib/withdrawals/requests.ts` line 339 writes `${cancelledGames.length} upcoming game(s)`.
The demo shows it verbatim because product copy on camera is product copy. **PUNCH:
pluralise it.**

### 5. Two withdrawal paths, two audiences

The request path notifies `ClubOwner`, `ClubManager` and `Trainer`; the league's direct
`PATCH /api/seasons/[id]/teams/[teamId]` path notifies `ClubOwner` and `ClubManager` only.
Same cascade otherwise. **PUNCH: one shared audience helper**, per the parity law.

---

## G. Numbers deliberately NOT shown

| Not shown | Why |
|---|---|
| The requester's name | `DB` the request's `requestedById` is `owner-nph@sportshub.demo` (Nathan Hoops), who is the **league owner**, i.e. the person who approves it. That is a seed defect, not the flow: a `CLUB_FROM_LEAGUE` request can only be created by a `ClubOwner`/`ClubManager`/`Trainer` of the withdrawing club (`requests.ts` lines 49 to 57). Rather than print a name that makes the flow look wrong, or invent one, the row shows the reason and the date and the demo says "a club" out loud. **PUNCH (seed): attribute the seeded request to an Orillia Lakers club account** |
| A dollar figure for the cancelled entry fee | `DB` this submission has **no** `PaymentObligation` row (the season holds 26, none against `0328b7ec`). `cancelObligationIfUnpaid` genuinely runs, so the cascade card states the rule in words and shows no amount. The $3,950 fee beat belongs to the season story, which has the row for it |
| A count of cancelled schedule requests | `DB` this submission has no `TeamScheduleRequest` rows either. The cascade card states the rule and the reason string `"Team withdrew from the season"`, both `PRODUCT`, with no number attached |
| "N families were told" | Section F punch 1. The product does not tell them |
| A reason on the cancelled game rows | Section F punch 2 |
| The five new games' dates, courts and opponents | The commit is not run against the live database (this task is read-only), so their placement would be a guess. The demo shows the **count** and the **guarantee** closing, both of which are arithmetic, and never draws five specific fixtures |
| The fairness table's Burden column | Real (`summary-panel.tsx`) but it is the playoffs and season demos' territory, and the guarantee story reads better on Team check's plain "N / 10 games" |

---

## H. Composition choices, declared

| Choice | Why |
|---|---|
| DESKTOP throughout, no handset anywhere | `OWNER` audit section D: "League planning, scheduling, divisions, bracket building, money table, waiver grid → DESKTOP (owner exception)". Both surfaces in this demo are operator working screens. No phone composition is fabricated |
| 4 registered-team rows, chip "11 of 145" | The scene is authored to a 600 logical box. The chip carries the product's own "N of M" shape so the slice is stated on screen |
| The Team check grid is hidden while the preview panel is open | Height budget only. No beat targets Team check during those two beats, and it returns for the payoff |
| Division D only in Team check | The withdrawal touched exactly one division, and the grid's job is the amber-to-green flip |
| The "rest of the league" numbers are a strip, not a panel | Same 600 logical budget, and the three numbers are one thought |

---

## I. Gates, this cut

| Gate | Result |
|---|---|
| `scripts/demo/readability-audit.mjs --routes /demos/team-drops-out` | **0 violations**, minimum stage scale **1.000**, 23 beats, 27 scenes audited |
| Same, `--viewport 390x844 --floor 11 --scope stage` (keyhole) | **0 violations** |
| Same, `--viewport 390x844 --floor 14 --scope chrome` | **0 violations** |
| Full playback drive, 23 beats stepped plus a 2x autoplay pass | **0 console errors**, **0 page errors** |
| Chapter jumps | **4 of 4 exact**: every chip lands on its own chapter's first beat, with the right context strip |
| Runtime at 1x | **1 min 50 sec** (`data-demo-runtime-ms` = 109500) |
| Scene overflow (any node past the 600 logical box) | **none**, all 23 beats |
| 390x844 horizontal overflow | **0 px** (`documentElement.scrollWidth` 390 = `clientWidth` 390) |
| `tsc --noEmit` | clean |
| Em-dash sweep | clean. No em-dash or en-dash anywhere in the script or its registry entry |
| Database writes | **none**. Every derivation ran the product's own arithmetic over read-only queries |
