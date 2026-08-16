---
updated: 2026-08-16
tags: [type/reference, status/active, area/demos]
---

# Season story: every number on screen, and where it comes from

Status: **SOURCE OF TRUTH for `/demos/season-planned-to-published`** (rebuilt 2026-08-16,
corrected the same day after the owner rejected two beats: see section 0).

The rule this file exists to enforce: **no number appears in the demo without a line here.**
The second rule, added by the 08-16 scenario audit (D2): **every scene names the route the
flow lives on today**, so nothing can be pitched that the product cannot do. Section 0b is
that list.

Three source kinds, and every row names one:

| Tag | Meaning |
|---|---|
| `DB` | Read out of the local seeded database (NPH Showcase League, season Fall/Winter 2026-27, `seasonId 160b2f09-a95a-4a64-9b90-03793cae105b`, `leagueId e48a0464-33a8-4be2-b4bc-75b78c3889f4`) on 2026-08-16 |
| `RUN-SHEET` | `docs/demo-runbook-nph-journey.md`, the live pitch run-sheet |
| `OWNER` | A ruling in `docs/roadmap/demo-numbers-and-holes-2026-08-15.md` or the 08-16 scenario audit |
| `ARITH` | Arithmetic on rows above it, shown in full |
| `PRODUCT` | A constant, format or sentence taken from shipping product code (file named) |

---

## 0a. FEEDBACK ROUND DELTAS (owner, 2026-08-16, live session, 31 rulings)

The owner drove the cut and reshaped it. Everything below REPLACES the matching
row further down; sections 0, 0b and A to K still hold for everything not listed
here. The product gaps this round exposed are in
`docs/roadmap/product-corrections-from-demo-feedback.md`.

| What | Was | Now | Source |
|---|---|---|---|
| Registration state | 27 of 146 in, 3 pending | **144 of 146 in, 4 pending** | `OWNER` ("registration arrives nearly done") |
| Filter chips | All (146) · Pending (3) · Approved (24) · Rejected (0) | **All (146) · Pending (4) · Approved (141) · Rejected (1)**, then Pending (0) · Approved (145) | `ARITH`, and they add to the `DB` end state 145 approved, 1 rejected |
| "Waiting on you" | a number beside a different list | **always the count of the pending rows on screen**, one source in `TeamsScreen` | `OWNER` |
| Rows on the Teams tab | 4 | **13 of the 146**, every club name from `DB` | `OWNER` ("the table looks FULL") |
| Approvals shown | one, on the submission page | **one on the submission page, the rest inline on the list** | `PRODUCT` `manage/components/teams-tab.tsx`: pending rows carry Approve and Reject |
| Free entry until the deadline | not shown | **still not shown: the product has no such mode** | source check: `TeamSubmissionStatus` is approved one by one. Recorded as a product gap |
| Roster lock beat | present | **deleted** | `OWNER` |
| Weekends | 13 of 19 on | **16 of 23 on: 13 session weekends at 2 or 3 a month, plus 3 finals weekends in March**, 7 off | `OWNER` ("the real NPH rhythm") |
| Fridays | not shown | **shown and left on No** | `PRODUCT` `plan/gyms-weekends-step.tsx` `friday-declaration`, "Can games run on Fridays?"; `DB` `Season.fridayPolicy` = null |
| Home gym card line | the product's "You own this one. Its games cost you nothing..." | **"Your home gym. It fills first."** | `OWNER`. A deliberate divergence from shipping copy, logged in the corrections doc |
| "Courts left empty" panel | on screen | **removed from the demo** | `OWNER`. The product still draws it |
| Divisions | a static list of 16 | **a chapter: Grade 10's 42 teams into 4 divisions, teams dragged between columns, cross-play chosen** | `PRODUCT` `manage/components/division-setup.tsx`; `DB` Grade 10 = 42 teams. Cross-play "Yes, they can mix" posts `scheduling: "PREFER"` |
| Season division total | 16 | **16**, unchanged: Grade 10's four are part of that count | `DB` |
| Board columns | 5 | **4 (Oct to Jan)**, each with its "Not planned" weekends, the gym tray, the HIGHLIGHT row, Move and ⋯ on every gym section, six-dot grips | `PRODUCT` + capture `gold-standard/real2/s3-board.png` |
| The tension | a commit that FAILS on the Schedule tab | **one weekend booked ONE COURT SHORT, amber on the board** | `OWNER` ("no ambush; the tension lives on the board") |
| Nov 21 to 22 | 84 games against 80 slots, refused by the auditor | **84/80 games, tight**: The Playground 3 courts holds Gr 8 (9) + Gr 9 (25) + Jr Girls (8) = 42 in 48; Six Park East on 2 courts holds Gr 10's 42 games in 32. **10 short** | `ARITH` on `DB` grade counts, 8 slots a court a day over 2 days |
| The fix, part 1 | renting a court from an auditor option | **the drawer's own idea, applied by DRAGGING the Six Park block to Nov 28 to 29**: 21st becomes 42/48, 28th becomes 78/80 | `PRODUCT` `plan/work-rail.tsx` idea rows; the problem sentence is `planner-core.ts`: "{weekend} needs {demand} games and has {capacity} slots, {short} short. Extend the hours, add a court, or move a grade to a lighter weekend." |
| The fix, part 2 | n/a | **a third court at Six Park East on Nov 28 to 29, from the section's ⋯ menu**: 78/96, every weekend fits | `PRODUCT` `plan-ui.tsx` `GymMenu`, "Courts this date", apply button "We rented 3 courts" |
| What is left to book | 18 court-days · 180 court-hours on a full sheet | **20 court-days · 200 court-hours**, in the rail footer where the product puts it | `ARITH`: rentals are Oct 24 to 25 (2 courts), Nov 28 to 29 (3), Dec 5 to 6 (2), Jan 9 to 10 (3) = 10 court x 2 days = 20 court-days at 10 hours a court-day (8 slots x 75 min) |
| The four promises | four sentences narrated over a panel | **the product's own fairness table, worst team first**, with maximums and zeros: 0 games short, 0 back-to-backs, 0 five-hour waits, 0 same-day-two-gym days | `PRODUCT` `manage/components/summary-panel.tsx` `FairnessSummaryTable`. **PROVENANCE: the four rows are staged to the engine's own hard rules, not read from a run of this five-column board.** The seeded world's committed schedule ran on a different session mix, so no run of THIS calendar exists to quote |
| Team-expansion beat | pitched in earlier cuts | **not in this cut**, for the same provenance reason | `OWNER` ("only if you can prove the engine produced it") |
| Requests | both "no start after noon on Sunday" | **A: "Games every Saturday start no earlier than 12:00" (Ottawa drive in). B: "Games every Sunday finish no later than 17:00" (Gatineau, five hour drive home)** | `OWNER` + `PRODUCT` `describeScheduleRequest` sentence shape |
| The published list | 4 rows, one game Saturday and one Sunday | **12 rows, all Saturday Nov 28, Grade 10 at Six Park East, every team twice on the same day at the same building**, and no team in adjacent slots | `OWNER` ("same-day pairs: two games, one day, one trip"). `ARITH`: 3 teams a division play 3 games over slots 1, 3 and 5, which is the only 3-team pattern with no back-to-back |
| The phone | an empty month grid, then a list of games | **the real agenda view**: Jordan's practices on Nov 17, 19 and 24 are there BEFORE the publish, and Saturday's two games fill in around them | `PRODUCT` `app/(platform)/calendar/my-calendar.tsx` agenda view, date rail plus a card whose left edge carries the kind's colour (`var(--brand)` practice, `var(--energy)` game) |
| Who sees it | "everybody sees the same 730 games" | **every team's calendar is there at once, and everyone sees their own**: parents, coaches, team managers, club owners | `OWNER` |
| The league logo | not shown | **the real North Pole Hoops mark on every console screen** | `scripts/demo-assets/nph-logo.dataurl.txt`, seeded to `Organization.logoUrl` by `scripts/seed-nph-demo.ts`; decoded to `apps/web/public/demo/nph-logo.png` for the demo |
| Chapters | 5 | **6**: Teams come in · The buildings · Divisions · The board · Two requests · Publish once | `OWNER` |
| Runtime | 3 min 32 sec | **3 min 39 sec**, 49 steps | measured from `data-demo-runtime-ms` |
| Player controls | speed chips, "Beat N of M", "Back to intro" | **gone**: Back, Pause and Next as real buttons, space and the arrow keys, one calm end card | `OWNER` (engine change, all demos) |

## 0. The two corrections (owner, 2026-08-16, second pass)

### 0.1 The team fee has no installments

**What was wrong.** The first cut put a **$987.50 deposit and three installments** under the
$3,950 team fee, sourced to `lib/payments/installments.ts` `computeDefaultPlan`.

**Why it was wrong.** `computeDefaultPlan` belongs to the **parent-to-club OFFER** flow. Its
only callers in the repo are `lib/payments/installments.test.ts` and the money story's own
comment; the engine it feeds, `scheduleInstallments`, writes `Payment` rows keyed to
`relatedOfferId` for an accepted offer. Nothing on the club-to-league path calls it.

**What really happens.** `apps/web/src/app/api/seasons/[id]/teams/[teamId]/route.ts`, in the
approval transaction (lines ~211 to 236):

```
if (approving && feeConfig.teamFee != null) {
  const balanceDays = (feeConfig.balanceDueDaysBeforeStart as number) ?? 14
  const balanceDue  = feeConfig.startDate ? startDate - balanceDays days : null
  await ensureObligation(tx, { payerTenantId, payeeLeagueId, referenceType: "TeamSubmission",
    referenceId: submission.id, amount: Number(feeConfig.teamFee), currency, dueDate: balanceDue })
}
```

**ONE** `PaymentObligation`, for the whole fee, dated by the balance rule. `ensureObligation`
(`lib/payments/obligations.ts`) writes one row and never schedules anything. The demo now
shows exactly that.

### 0.2 The buildings run on the home-court-plus-floaters model

**What was wrong.** The buildings chapter staged an August-1-era ledger of booked hours: one
gym attached (Six Park East), five of its six courts "booked", and two more buildings bought
mid-story.

**Owner, verbatim:** "The Burlington playground is their home court. We select a damn home
court then we give you floater gyms and then you don't have to give the booking of those gyms.
We just schedule them and tell you how many you need."

**Ground truth, three ways:**

1. `DB` `SeasonVenue` for this season, read 2026-08-16:

   | Venue | City | role | courtsAvailable |
   |---|---|---|---|
   | The Playground | Burlington | **home** | 3 |
   | Six Park East | Oshawa | pool | 6 |
   | Haber Recreation Centre | Burlington | pool | 6 |

2. `PRODUCT` `plan/gyms-weekends-step.tsx`, the shipping step 2. Head sentence: "Name your
   buildings and pick your home gym. The home gym fills first, at full capacity, before
   anything is rented." Home card: "You own this one. Its games cost you nothing, so it gets
   used before anything you rent." Pool card: "In the pool. You rent it by the court when a
   weekend needs the space." plus "The planner rents from the top of this list first." The
   bookings control is collapsed, optional, and carries its own skip line: "No bookings yet?
   Fine. The planner will assume what it needs and give you a call list."

3. **Captured live** on 2026-08-16 as `owner-nph@sportshub.demo` (Playwright, 1440x1000):
   `real2/s2-buildings.png` shows the three cards with chips `Home gym`, `In the pool`,
   `In the pool`, ranks 1 and 2, and bookings counts 7 and 5.

The board then does the rest: `plan/board-shared.ts` COPY.drawHow, "Fills your home gym first,
then rents as few gyms as possible, as full as possible. Rented gyms it books are assumed until
you confirm them." An assumed rental wears the gold dashed mark and the words
"assumed, not booked yet" (`plan/plan-ui.tsx` `BLOCK_STATUS_WORDS`).

And the last clause of the owner's sentence, "tell you how many you need", is the ask sheet,
`plan/plan-ui.tsx` `AskSheet`, opened from the board's "What is left" rail. Captured live on
the real season (`real2/ask.json`):

> **What you need to book** 70 court-days · 787.5 court-hours
> Oct 2026 · 14 court-days · 157.5 court-hours · 2 weekends needing rent · one weekend of 6 courts and one weekend of 1 court
> (four more month rows) · Weekend by weekend: Oct 10-11 Six Park, Oct 24-25 Haber, ... (10 blocks)

Those are the REAL season's numbers on its 16-weekend board. The demo draws its own five-column
board, so it computes its own ask with the product's own formula: see section G.

---

## 0b. This flow exists today: scene by scene

Every scene, the route it happens on, and the code that draws it. Nothing in the demo is
pitched ahead of the product; the two places the demo is ahead are named in section K.

| # | Beat | Flow exists today at | Code |
|---|---|---|---|
| 1 | `open`, the Teams tab mid-registration | `/manage/leagues/[id]/seasons/[seasonId]/manage?tab=teams` | `manage/components/teams-tab.tsx` |
| 2 | `pending`, the status filter chips | same | same, "All (146) · Pending (0) · Approved (145) · Rejected (1)" verified on screen |
| 3 | `open-team`, the submission page | `/manage/leagues/[id]/seasons/[seasonId]/teams/[submissionId]` | `teams/[submissionId]/page.tsx` |
| 4 | `approve` | `PATCH /api/seasons/[id]/teams/[teamId]` with `{status:"APPROVED"}` | `api/seasons/[id]/teams/[teamId]/route.ts` |
| 5 | `fee`, the obligation appearing | same route, same transaction | `ensureObligation` in `lib/payments/obligations.ts`; rendered by the Entry fee panel, `teams/[submissionId]/page.tsx` lines 351 to 365 |
| 6 | `promise`, games guaranteed | `?tab=settings` section 2, Game format and scheduling | `Season.gamesGuaranteed` |
| 7 | `money`, the payment filter row | `?tab=teams` | `manage/components/teams-tab.tsx`, "Any payment · Unpaid (1) · Paid (145)" verified on screen |
| 8 | `lock`, roster-change policy | `?tab=teams`, ROSTER CHANGES panel | same, three policy buttons verified on screen |
| 9 | `closed`, registration closed | `?tab=overview` checklist action "Close registration" | `manage/components/season-checklist.tsx` |
| 10 | `to-plan`, the five-step rail | `/manage/leagues/[id]/seasons/[seasonId]/plan?step=2` | `plan/page.tsx` STEPS |
| 11 | `weekends`, "When would you like to run sessions?" | same | `plan/gyms-weekends-step.tsx` |
| 12 | `home`, the home-gym card | same | same, `withGymRole(world, venueId, "home")` and the "Make this the home gym" control |
| 13 | `floaters`, the pool cards and their rank | same | same, `withGymOrder`, the ↑ N ↓ control and "The planner rents from the top of this list first." |
| 14 | `no-bookings`, the optional bookings control | same | same, `toggleBooking` and `data-testid="bookings-skip"` |
| 15 | `to-board` | `/plan?step=3` | `plan/calendar-step.tsx` |
| 16 | `board`, the drawn calendar | same | `plan/board-view.tsx`, `plan/weekend-card.tsx`; assumed marks from `plan/plan-ui.tsx` `BlockStatusMark` |
| 17 | `february`, a weekend entirely at the home gym | same | same; the home gym is filled first by `board-shared.ts` COPY.drawHow |
| 18 | `ask`, "What you need to book" | same, the "What is left" rail | `plan/plan-ui.tsx` `AskSheet`, rendered at `plan/calendar-step.tsx` line 606 |
| 19 | `to-schedule`, the journey strip | `?tab=schedule` | `manage/components/plan-door.tsx` STAGES |
| 20 | `preview`, "Preview whole season" | same | `manage/components/schedule-tab.tsx` |
| 21 to 23 | `refuse`, `arithmetic`, `options` | same | `lib/scheduler-v2/audit.ts`, finding `grade-does-not-fit`. **Re-run 2026-08-16 against this exact weekend, see section F** |
| 24 | `court6`, renting a third court | `/plan?step=3`, the section ⋯ menu, or step 2's courts field | `plan/weekend-card.tsx` ("N used of M rented"), `withGymCourts` |
| 25 to 29 | `preview-2` and the four promises | `?tab=schedule` | the burden table columns Back-to-backs, 5hr+ waits, Same day 2 gyms, and the engine's own hard rules |
| 30 | `one-address`, a grade in one building | `/plan?step=3` | the board's own placement, and `audit.ts` finding `group-split-across-gyms` which BLOCKS the opposite |
| 31 to 33 | `requests`, `honored`, `pending-req` | the submission page's Schedule requests panel | `lib/schedule-requests/requests.ts` `describeScheduleRequest` |
| 34 to 36 | `simulate`, `cost`, `approve-req` | same panel | `teams/[submissionId]/schedule-request-actions.tsx`; `POST /api/seasons/[id]/schedule-requests/[requestId]/simulate` |
| 37 to 39 | `commit`, `commit-ok`, `draft` | `?tab=schedule`, "Commit whole season" | `manage/components/schedule-tab.tsx` and its confirm dialog |
| 40 | `phone-in`, the family calendar empty | `/calendar` on the phone | `app/(platform)/calendar/my-calendar.tsx` |
| 41 to 42 | `publish`, `publish-ok` | `?tab=schedule`, "Publish schedule · N new" | same tab; publish layer sends one notification per audience |
| 43 | `notice`, the in-app bell | the notification bell | `lib/notifications` `notifyMany` |
| 44 | `cal`, the games on her calendar | `/calendar` | `my-calendar.tsx`, `components/calendar/agenda-list.tsx` |
| 45 | `ics`, the calendar subscription | the team calendar's ICS feed | `RUN-SHEET` honest limits: the ICS feed works today. No push claimed |
| 46 | `end` | n/a, the end card | |

---

## A. The league

| On screen | Value | Source |
|---|---|---|
| League name | NPH Showcase League | `DB` League.name |
| Season label | Fall/Winter 2026-27 | `DB` Season.label |
| Season status chip | Open for registration | `DB` Season.status = REGISTRATION, rendered by the real console as "OPEN FOR REGISTRATION" |
| Teams in the season | **146** | `DB` count of TeamSubmission on this season = 146 (145 APPROVED, 1 REJECTED). Matches `RUN-SHEET` "all 146" |
| Clubs | **82** | `DB` / real Clubs tab header reads "CLUBS (82)" and "146 teams across all clubs" |
| Grades and their team counts | Grade 7: 12 · Grade 8: 9 · Grade 9: 25 · Grade 10: 42 · Grade 11: 24 · Grade 12: 26 · Junior Girls: 8 | `DB` group by Division.ageGroup. Sums to 146 |
| Divisions | 16 | `DB` Division count for the season |
| Division naming shown | "Grade 10 Boys · Division B" | `DB` Division.name (the product's derived naming) |
| Registration mid-flight counts | 27 entered of 146 · 24 approved · 3 pending | `RUN-SHEET` stage 1: "~25 of 146 in, statuses mixed". Split chosen so the three filter chips add up |

## B. Money

**No installments anywhere.** See section 0.1.

| On screen | Value | Source |
|---|---|---|
| Team fee | **$3,950** | `DB` Season.teamFee = 3950, currency CAD. Matches `RUN-SHEET` "their $3,950 structure" |
| Rendered as | **$3,950.00 CAD** | `PRODUCT` `teams/[submissionId]/page.tsx` `money()` = `Intl.NumberFormat("en-CA", {style:"currency", currency})`. Verified in node: `$3,950.00` |
| Balance due | **Oct 18, 2026** | `ARITH` on `PRODUCT`: `api/seasons/[id]/teams/[teamId]/route.ts` sets `dueDate = startDate - balanceDueDaysBeforeStart days`. `DB` Season.startDate = 2026-11-01, `DB` Season.balanceDueDaysBeforeStart = null and the org rulebook does not set it, so the system default applies: `lib/org/season-defaults.ts` line 82, **14**. 1 Nov 2026 minus 14 days = **18 Oct 2026** |
| The full line | "$3,950.00 CAD · Balance due Oct 18, 2026 · nothing received yet" | `PRODUCT` the Entry fee panel renders `money(feeAmount)`, then `· balance due <fmtDate(dueDate)>`, then `· nothing received yet` when no payment exists |
| Payment badge | UNPAID | `PRODUCT` same page: the badge reads paid / deposit paid / overdue / unpaid; with no payments and a future due date it is "unpaid" |
| Deposit | **not shown** | `DB` Season.depositPct = null on this season, and the org rulebook sets none. The control exists (`manage/components/registration-settings-tab.tsx`, "Deposit required · N% of the team fee, due at approval") but this league has not used it, so the demo does not draw one |
| The league's money view | "Any payment · Unpaid (1) · Paid (145)" | `PRODUCT` / captured: the real Teams tab's second filter row, `real/05-manage-teams-fold.png`. Mid-registration the demo shows "Any payment · Unpaid (3) · Paid (24)", the same shape against section A's split |

> **PRODUCT PUNCH (timezone).** `fmtDate` on the submission page renders the stored
> UTC-midnight date in the viewer's local zone, so in Toronto (UTC-4) an obligation dated
> `2026-10-18T00:00:00Z` reads **Oct 17, 2026**. The demo shows the date the rule gives,
> Oct 18. Either the seed should store local midnight or `fmtDate` should format in UTC.
> Recorded rather than hidden.

## C. The promise

| On screen | Value | Source |
|---|---|---|
| Guarantee headline | **"12 games guaranteed: 10 regular season + minimum 2 playoff"** | `OWNER` (numbers sheet Part A, locked in round 3) |
| Regular season games per team | **10** | `DB` Season.gamesGuaranteed = 10 |
| Minimum playoff games | 2 | `OWNER`. Backed by `DB`: 3 PLAYOFF sessions exist on the season (the tiered finals weekends) |
| League-wide regular season games | **730** | `ARITH` 146 teams x 10 games / 2 = 730. (Note: the seeded world's own committed schedule holds 725 Game rows, because that generate ran on a different session mix. The demo shows the plan arithmetic, 730, and stays internally consistent with it) |
| Game length | 40 minutes | `DB` Season.gameLengthMinutes = 40 |
| Slot length | 75 minutes | `DB` Season.gameSlotMinutes = 75 |

## D. The buildings, and the board

Every venue name is real. `DB` SeasonVenue plus Venue rows, read 2026-08-16.

| On screen | Value | Source |
|---|---|---|
| The Playground · Burlington · **Home gym** · 3 courts | home | `DB` SeasonVenue.role = "home", courtsAvailable = 3 |
| Six Park East · Oshawa · **In the pool** · rank 1 · 6 courts | pool | `DB` SeasonVenue.role = "pool", courtsAvailable = 6 |
| Haber Recreation Centre · Burlington · **In the pool** · rank 2 · 6 courts | pool | `DB` SeasonVenue.role = "pool", courtsAvailable = 6 |
| Hours line, "Available 10:00 to 22:00, the same hours every weekend" | verbatim | `PRODUCT` / captured `real/12-plan-step2-buildings-full.png`: both fields read 10:00 and 22:00, under the sentence "The same hours every weekend. A single date that runs different hours is set on the board." |
| "Already have dates booked here?" with a count of 1 | shape real, count reduced | `PRODUCT` the collapsed bookings control with its count badge. The real plan holds **7** at Six Park and **5** at Haber. The demo shows **one**, because the story it tells is a league that has phoned almost nobody, and that one booking is what the November refusal is about. Divergence recorded, not hidden |
| Skip line, "No bookings yet? Fine. The planner will assume what it needs and give you a call list." | verbatim | `PRODUCT` `plan/gyms-weekends-step.tsx`, `data-testid="bookings-skip"` |
| "Courts left empty: 0" and its sentence | verbatim | `PRODUCT` same file; captured on `real/12-plan-step2-buildings-full.png` |
| "The home gym fills first, at full capacity, before anything is rented." | verbatim | `PRODUCT` same file, the step head |
| Slot arithmetic | 8 slots per court per day | `ARITH` the demo shows a 10-hour playing day (10:00 to 20:00 of the 10:00 to 22:00 window) at 75-minute slots: 600 / 75 = 8. The demo's cards show the real 10:00 to 22:00 availability; the DRAW uses 10 hours, which is the divergence recorded below |
| Home gym weekend capacity | **48 games** | `ARITH` 3 courts x 8 slots x 2 days |

> **Divergence recorded (hours).** The seeded availability is 10:00 to 22:00, a 12-hour window
> (16 slots a court a day). The demo's board arithmetic uses a 10-hour playing day, which is
> what the run-sheet's captured refusal implies and what a league actually books. The gym cards
> show the real window; the board and the ask are computed on ten hours. If the board is meant
> to be twelve, every fraction in section D and every hour in section G scales with it.

### The board, weekend by weekend

`ARITH` throughout, on section A's grade counts (a grade of N teams playing 2 games per team
needs N games) and the court counts above. The home gym is filled first.

| Session | Weekend | Games | The Playground (home, 3 courts, 48) | Rented | Slots held | Fraction |
|---|---|---|---|---|---|---|
| 1 · Oct | Oct 24-25 | 62 | Gr 7 (12) + Gr 11 (24) = 36 | Six Park 2 courts, Gr 12 (26), 32 slots, **assumed** | 48 + 32 = 80 | 62/80 |
| 2 · Nov | Nov 21-22 | 84 | Gr 8 (9) + Gr 9 (25) + Jr Girls (8) = 42 | Six Park 2 courts, Gr 10 (42), 32 slots, **booked** | 48 + 32 = 80 | **84/80, over** |
| 3 · Dec | Dec 5-6 | 49 | Gr 9 (25) | Haber 2 courts, Gr 11 (24), 32 slots, **assumed** | 48 + 32 = 80 | 49/80 |
| 4 · Jan | Jan 9-10 | 68 | Gr 12 (26) | Six Park 3 courts, Gr 10 (42), 48 slots, **assumed** | 48 + 48 = 96 | 68/96 |
| 5 · Feb | Feb 6-7 | 45 | Gr 7 (12) + Gr 9 (25) + Jr Girls (8) = 45 | nothing | 48 | 45/48 |

After the November fix (a third court rented at Six Park), that weekend reads **84/96**.

> **Divergence recorded (columns).** The real board groups a month's several weekends into one
> session column (`real/13-plan-step3-calendar-full.png` shows Oct 10-11, Oct 24-25 and
> Oct 31-Nov 1 inside SESSION 1 · OCT). The demo draws ONE loaded weekend per column, five in
> all, because five columns at 1160 logical is what stays readable. The season's 730 games and
> its 13 weekends are stated on screen; the board is a representative slice of them, and the
> ask in section G is the ask for the slice the board draws.

## E. The calendar

| On screen | Value | Source |
|---|---|---|
| Session weekends | **13**, Oct 24 to Feb 20 | `RUN-SHEET` stage 3: "NPH's OFFICIAL 2026-27 calendar (the registration graphic): 13 session weekends Oct 24 to Feb 20" |
| Finals weekends | 3, tiered: Feb 27 to 28, Mar 6 to 7, Mar 13 to 14 | `RUN-SHEET` same beat; `DB` confirms 3 sessions with phase PLAYOFF |
| Sessions grouped by month | Session 1 Oct, Session 2 Nov, Session 3 Dec, Session 4 Jan, Session 5 Feb | `DB` / real plan board headings ("SESSION 1 · OCT" ... "SESSION 5 · FEB") |
| Season dates | Nov 1 2026 to Mar 14 2027 | `DB` Season.startDate / endDate |
| "Choosing a weekend books nothing" | verbatim idea | `PRODUCT` `plan/gyms-weekends-step.tsx`: "The draw fills these first. You can place gyms and games on any date on the board." |

> **Divergence recorded:** the seeded plan currently runs **7 of 19** weekends on (captured
> live 2026-08-16), and the season holds 16 REGULAR session weekends plus 3 playoff weekends.
> The demo shows the run-sheet's official 13, because that is the calendar the owner pitches
> from. If the seed is meant to be the truth, the seed changes, not the demo.

## F. The refusal (the beat the whole demo exists for)

**Verified, not asserted.** On 2026-08-16 the shipping auditor `lib/scheduler-v2/audit.ts` was
run (via `tsx`) against a snapshot shaped exactly like the demo's November weekend: The
Playground at 3 courts holding Grade 8, Grade 9 and Junior Girls; Grade 10 at Six Park East on
a **2-court** booking; both gyms 10:00 to 20:00; 75-minute slots; `courtBuffer` 0; target 2.

It returned a BLOCK finding, code `grade-does-not-fit`, arithmetic
`{demand: 42, supply: 32, short: 10}`, message:

> "Weekend of Nov 21-22: Grade 10: 42 — 42 games need this gym, but the booking holds 32
> (16 + 16 slots by day). Short by 10 games."

and options, in this order:

1. "Add about 13 court-hours at this gym that weekend."
2. "Move a grade to a gym with more room that weekend."
3. "Lower the weekend target from 2 games per team to 1 in Planning."

Re-run with a **third** court at Six Park: no `grade-does-not-fit` BLOCK. The demo shows both
states and nothing else.

| On screen | Value | Source |
|---|---|---|
| The weekend | Weekend of Nov 21 to 22 | `PRODUCT` `fmtDates(w)` |
| The grade | Grade 10: 42 | `ARITH` on `DB` team counts: 42 teams x 2 games / 2 = 42 games |
| The booking holds | **32** (16 + 16 by day) | `ARITH` 2 courts x 8 slots x 2 days |
| Short by | **10 games** | `ARITH` 42 - 32 |
| Court-hours to add | **about 13** | `PRODUCT` `audit.ts` option 1: `ceil(short x slotMinutes / 60)` = ceil(10 x 75 / 60) = 13 |
| After renting a third court | **48 slots** there, 96 that weekend, everything fits | `ARITH`, and the auditor agrees (re-run above) |
| Message shape | the sentence above, with the product's em-dash written as a middot per the house copy rule | `PRODUCT` `audit.ts` finding `grade-does-not-fit` |

> **Why the fix is a whole court and not 13 hours.** Nobody rents 13 hours; they take the court
> for the two days. The demo says so in the beat rather than pretending the product's estimate
> is what gets booked.

## G. What you need to book (the ask sheet)

`PRODUCT` `plan/plan-ui.tsx` `AskSheet`. Its numbers come from
`lib/scheduler/planner-core.ts`, where a rental block's `hoursNeeded = courts x days x
hoursPerCourtDay` and the season line sums them (`season.courtHours += b.hoursNeeded`;
`courtDays = courts x days`).

Applied to the board in section D, **before** the November court is added, at 2 days a weekend
and a 10-hour playing day:

| Month | Rental | Court-days | Court-hours | Chunks |
|---|---|---|---|---|
| Oct 2026 | Six Park, 2 courts | 2 x 2 = **4** | 4 x 10 = **40** | one weekend of 2 courts |
| Nov 2026 | Six Park, 2 courts | **4** | **40** | one weekend of 2 courts |
| Dec 2026 | Haber, 2 courts | **4** | **40** | one weekend of 2 courts |
| Jan 2027 | Six Park, 3 courts | 3 x 2 = **6** | 6 x 10 = **60** | one weekend of 3 courts |
| Feb 2027 | none, it fits at home | 0 | 0 | no row: the real sheet only lists months with rentals |
| **Season** | 4 rental blocks | **18 court-days** | **180 court-hours** | |

The row phrasings ("N court-days", "N court-hours", "1 weekend needing rent", "one weekend of N
courts") are the product's own, confirmed against the live capture of the real season's sheet:

> 70 court-days · 787.5 court-hours · "Oct 2026 · 14 court-days · 157.5 court-hours ·
> 2 weekends needing rent · one weekend of 6 courts and one weekend of 1 court"

Those larger numbers belong to the real 16-weekend board, not to the demo's five-column slice.
Both are recorded here so the two can never be confused.

The summary line above the sheet, "4 rental blocks behind this calendar. Every rental has a
building.", is `PRODUCT` `plan-ui.tsx` `BlockSummary` plus `work-rail.tsx`; the live rail read
"10 rental blocks" and "Every rental has a building" on the real season.

The Board / Strip toggle the demo flips to read the sheet is real: `real/13-plan-step3-*.png`
shows both buttons in the board header.

## H. Requests

| On screen | Value | Source |
|---|---|---|
| Ottawa Elite request | "Games every Sunday start no later than 12:00" · APPROVED | `PRODUCT` `lib/schedule-requests/requests.ts` `describeScheduleRequest` produces exactly this sentence; `RUN-SHEET` "the APPROVED Sunday-by-noon window honored" |
| Ottawa Elite team | Ottawa Elite (incl. Prep) · Grade 10 Boys · Division B | `DB` TeamSubmission |
| Dragons de Gatineau request | "Games every Sunday start no later than 12:00" · PENDING | `RUN-SHEET` "the PENDING request"; same product sentence shape |
| Dragons team | Dragons de Gatineau · Grade 11 Boys · Division A | `DB` TeamSubmission |
| Simulate cost result | "Cost of approving: none, everyone else is unaffected." with unplaced games +0, back-to-backs +0, weekend-preference misses +0, request misses -1, two-gym days +0, big gaps +0 | `PRODUCT` `schedule-request-actions.tsx` renders this exact copy and these exact six delta chips |
| Honored line | "Dragons de Gatineau would have 10 of 10 affected games inside the requested window." | `PRODUCT` same file: "{team} would have {ok} of {total} affected games inside the requested window." 10 = `DB` gamesGuaranteed |

## I. Publish, and the phone

| On screen | Value | Source |
|---|---|---|
| Commit dialog | "Save the whole season's schedule?" / "Saved as a draft. Clubs and families see nothing until you publish." | `PRODUCT` the real commit confirm |
| Draft count | 730 draft games | `ARITH` section C |
| Publish button | "Publish schedule · 730 new" | `PRODUCT` the real Schedule tab renders "Publish schedule · 725 new" for its 725 games; same label, this demo's count |
| The four games listed | Grade 10 at Six Park East, Grade 9 and Junior Girls at The Playground | `ARITH` on section D: those are the gyms the board put those grades in that weekend |
| Family on the phone | Priya Reyes, parent of Jordan Reyes #7, Royal Crown, Grade 10 | `RUN-SHEET` device table (Phone 1). `DB` confirms Royal Crown is entered in Grade 10 Boys · Division B |
| Her opponents | Ottawa Elite, City Above Elite, CE23 Academy | `DB` all three are Grade 10 Boys · Division B entries in this season |
| Games on her calendar | 10 | `DB` gamesGuaranteed |
| Notification | one, pointing at the team calendar | `PRODUCT` the publish layer sends one notification per audience, not one per game |
| Calendar subscription | "Subscribe in your phone's calendar" ICS feed | `RUN-SHEET` honest limits: "the in-app bell + email + the phone-calendar ICS feed, which all work". True push (APNs/FCM) is NOT claimed anywhere in this demo |
| First games shown | Sat Nov 21, 10:00 AM, Six Park East Court 3 · Sun Nov 22, 11:15 AM, Six Park East Court 1 | `ARITH` times sit on the 75-minute slot grid inside the 10:00 booking; venue and courts from section D |

## J. Numbers deliberately NOT shown

| Not shown | Why |
|---|---|
| A deposit or an installment plan on the team fee | Section 0.1. That engine is the parent-to-club offer flow's, and `computeDefaultPlan` has no caller on this path |
| Court-hours for the whole season (the old 912.5 chip) | The demo now states hours ONE way, the product's way: the ask sheet, section G. Two different court-hour totals on one screen was the confusion worth removing |
| "Slots used: 730 of 816" | Built on the old five-court-at-one-gym model. Replaced with the plain claim the preview really makes: every weekend is inside the gym time the plan holds |
| 725 (the seed's committed game count) | The demo runs the plan arithmetic end to end; mixing in the seed's own generate would put two different totals on screen |
| A Scenarios panel for "distribute by venue" | `api/seasons/[id]/schedule/scenarios/route.ts` returns that card, but no screen calls it. The demo shows the outcome on the board instead |
| Referee costs, standings, playoff brackets | Different demos. This one ends at publish |
| Any push-notification claim | Not deliverable until the Apple and Google keys land (`RUN-SHEET` honest limits) |

## K. Where the demo is still ahead of the product, and it is named

1. **The board's assumed marks are drawn per gym section.** The real board draws the same
   status on the same sections (`plan/weekend-card.tsx` line 1068, `BlockStatusMark`); the
   demo's version is a simplification of that card, not an invention.
2. **The ask sheet is shown open beside the board.** On the real screen it lives inside the
   "What is left" rail, which the operator opens; the demo opens it and flips the board to the
   Strip view so both fit. Both controls are real.
3. **Approving a schedule request** still goes through `window.prompt()` in the product
   (`schedule-request-actions.tsx`). The demo shows the approval landing without a prompt.
   This is a product punch, restated from the 08-16 fidelity sheet, and it needs a real dialog.
