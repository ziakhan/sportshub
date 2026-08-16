---
updated: 2026-08-16
tags: [type/reference, status/active, area/demos]
---

# The referees: every number on screen, and where it comes from

Status: **SOURCE OF TRUTH for `/demos/the-referees`** ("The referees", built 2026-08-16 to
the gold standard set by the season story, the schedule-change demo and the waivers demo).

Same two rules as `season-story-numbers.md` and `schedule-change-numbers.md`:

1. **No number appears in the demo without a line here.**
2. **Every scene names the route the flow lives on today** (audit D2). Section A is that list.

| Tag | Meaning |
|---|---|
| `DB` | Read out of the local seeded database on 2026-08-16 (NPH Summer League, season Summer 2026, `seasonId fbbe767c-00e9-4130-9258-4f02c6854efa`, `leagueId d77d6700-3139-43e2-83f9-dec8f5317011`) |
| `PRODUCT` | A constant, format or sentence taken from shipping product code (file named) |
| `ARITH` | Arithmetic on rows above it, shown in full |
| `OWNER` | A ruling in the 2026-08-16 scenario audit |

---

## 0. Why this runs on the Summer world

Because it is the only world where the referee flow has ever been used. `DB`:

| Row | Count | Where |
|---|---|---|
| `LeagueReferee` | **3** | all on NPH Summer League. Every other league has **0** |
| `RefereeProfile` | 4 | the three above, plus one unrelated Phase1 test account |
| `RefereeAvailability` | **2** | both on the Summer league's referees, both for Sat 8 Aug |
| `RefereeSessionRequest` | **1** | a live PENDING broadcast on the Summer league |
| `RefereeSettlement` | **6** | all on the Summer league |

It is also the only world whose games are **published** (`DB` 45 of 45 in the schedule-change
demo's sample, and all 8 on the day this demo books). That matters here more than anywhere:
`getRefereeGames` filters on `PUBLISHED_GAME`, so a referee's schedule on an unpublished
world would be legitimately empty and the demo would have nothing to show.

---

## A. This flow exists today: scene by scene

| # | Beat | Flow exists today at | Code |
|---|---|---|---|
| 1 | `open`, the referee desk | `/manage/leagues/[id]/seasons/[seasonId]/manage?tab=referees` | `manage/components/referees-tab.tsx`, tab registered in `manage/page.tsx` line 360 |
| 2 | `pool`, the pool rows | same | `referees-tab.tsx` lines 396 to 410: certification, "Self-declared" when no doc, games refereed, rate, and the "no sign-off PIN" flag |
| 3 | `day`, picking the session day | same | `referees-tab.tsx` lines 230 to 240, and `GET /api/leagues/[id]/referees?date&start&end` which returns each pool member's availability for that window |
| 4 | `avail`, the availability badges | same | `referees-tab.tsx` `AVAILABILITY_BADGE`, lines 38 to 42: available / other hours / no availability set |
| 5 | `shift`, the preset | same | `referees-tab.tsx` `SHIFT_PRESETS`, lines 32 to 36 |
| 6 | `broadcast`, "All league referees (first accept wins)" | same | `referees-tab.tsx` line 300, verbatim including the megaphone |
| 7 | `rate`, the $/game field | same | `referees-tab.tsx` lines 306 to 316, `title` "Per-game rate the referee agrees to by accepting" |
| 8 | `send`, "Send offer" | `POST /api/leagues/[id]/referee-requests` | writes a `RefereeSessionRequest`, notifies and emails targeted referees |
| 9 to 12 | the offer on the referee's phone | `/referee/requests` | `app/(platform)/referee/requests/page.tsx`, reached from the app's mobile bottom bar and from `/referee` |
| 13 | `accept` | `PATCH /api/referee-requests/[id]` with `{action:"accept"}` | first-accept-wins conditional update, then `assignRefereeToGames` via `lib/referees/shift-assign.ts` |
| 14 | `league-side`, the offer row answering itself | `?tab=referees` | `referees-tab.tsx` lines 358 to 363, which writes `accepted` then an em-dash then the name; the demo renders the middot |
| 15 to 17 | `mygames`, `card`, `drafts` | `/referee` | `app/(platform)/referee/page.tsx`, fed by `lib/queries/referee-games.ts` |
| 18 to 19 | `calendar`, `ics` | `/calendar` plus `GET /api/calendar/[token]` | `components/calendar/add-to-phone.tsx` mints the feed; `api/calendar/[token]/route.ts` lines 98 to 115 and 158 to 174 emit the officiating events |
| 20 to 22 | `settle`, `confirm`, `honest` | `?tab=referees` | `referees-tab.tsx` lines 472 to 520; `GET`/`PATCH /api/leagues/[id]/referee-settlements` |
| 23 | `end` | n/a, the end card | |

---

## B. The pool, and what each row says

`DB` three `LeagueReferee` rows on this league, each with a `RefereeProfile`. `PRODUCT` the
row text is `referees-tab.tsx` lines 400 to 407, in that order.

| Name | Certification | Cert doc on file | Games refereed | Standard fee | Sign-off PIN | Availability for Sat 8 Aug |
|---|---|---|---|---|---|---|
| **Mike Ferreira** | Level 3 | no | 40 | $50 | yes | **declared, 09:00 to 18:00** |
| **Sarah Whitlock** | Level 2 | no | 57 | $50 | yes | **declared, 09:00 to 18:00** |
| **James Okonkwo** | Level 3 | no | 74 | $50 | yes | **none declared** |

All `DB`. Three consequences the demo shows rather than states:

- **"Self-declared" is on every row.** `PRODUCT` line 403 appends it whenever a
  certification exists with no document behind it, and `DB` none of the three has uploaded
  one. The demo shows the honest label rather than a clean one.
- **No "no sign-off PIN" flag anywhere**, because `DB` all three hold a `signoffPinHash`.
  This is the same PIN the game-day demo's referee signs a scoresheet with.
- **James's silence is drawn as silence.** `PRODUCT` `AVAILABILITY_BADGE.unknown` renders
  "no availability set", not "unavailable", and the demo makes a beat of the difference.

> **The seed and the database disagree, and the DATABASE is what this demo used.**
> `scripts/seed-nph-demo.ts` line 1165 writes `standardFee: 45` and cycles Level 2 / Level
> 3 by index; the live rows read **$50** for all three, Mike on **Level 3** and 40 games.
> Somebody re-seeded or amended after that script last ran. Every value above was read out
> of the database on 2026-08-16, not off the seeder.

---

## C. The day being booked

| On screen | Value | Source |
|---|---|---|
| League | NPH Summer League | `DB` League.name |
| Season | Summer 2026 | `DB` Season.label |
| Session day | **Weekend 10 · Aug 8** | `DB` `SeasonSessionDay 073ce624-0087-4619-b5b9-f3d9cdfb4805`, date 2026-08-08 |
| Venues open that day | The Playground 09:00 to 20:00, Haber Recreation Centre 09:00 to 20:00 | `DB` `SeasonSessionDayVenue` |
| Shift | **09:00 to 15:00** | `DB` the seeded request's `startTime`/`endTime`. It is exactly `PRODUCT` `SHIFT_PRESETS[1]`, "Morning 6h (9–3)", which is why the demo presses that preset |
| Send to | broadcast | `DB` `targetUserId` is null, which is what the product calls "All league referees (first accept wins)" |
| Rate | **$50/game** | `DB` `offeredRatePerGame`. It equals all three referees' `standardFee`, so no lowball warning fires |
| Message | "Saturday morning block · three courts running at the Playground." | `DB` verbatim. The row stores an em-dash; the house copy rule turns it into a middot |

### The eight games, and why all eight are his

`DB` eight `Game` rows on that session day, **every one published**:

| Tip-off (America/Toronto) | Home | Away | Where |
|---|---|---|---|
| 9:00 AM | Toronto Lords Grade 9 | West United Prep Grade 9 | The Playground · Court 1 |
| 9:00 AM | CKATT Basketball Grade 9 | Oakville Panthers Grade 9 | The Playground · Court 2 |
| 9:00 AM | Kings Court Basketball Grade 9 | Mississauga Monarchs Grade 9 | The Playground · Court 3 |
| 9:00 AM | Burlington Force Grade 9 | North Toronto Huskies Grade 9 | Haber · Court 1 |
| 9:00 AM | Toronto Lords Grade 10 | West United Prep Grade 10 | Haber · Court 2 |
| 9:00 AM | CKATT Basketball Grade 10 | Oakville Panthers Grade 10 | Haber · Court 3 |
| 9:00 AM | Kings Court Basketball Grade 10 | Mississauga Monarchs Grade 10 | Haber · Court 4 |
| 10:30 AM | Burlington Force Grade 10 | North Toronto Huskies Grade 10 | The Playground · Court 1 |

`PRODUCT` `lib/referees/shift-assign.ts` `inShiftWindow` compares
`new Date(scheduledAt).toTimeString().slice(0, 5)` against the shift's strings, so it is a
**local wall clock** test. Verified in node on this machine (`TZ America/Toronto`): the
13:00Z rows read `09:00` and the 14:30Z row reads `10:30`, and `"09:00" >= "09:00"` and
`"10:30" <= "15:00"` are both true. **All eight fall inside the window**, so accepting
assigns all eight.

| On screen | Value | Source |
|---|---|---|
| Games assigned by the accept | **8** | `ARITH` over the table above, using the product's own window test |
| Games the handset draws | **3**, with "and 5 more that morning" under them | Composition, section H. The header carries the product's true "Coming up (8)" |
| What the day is worth | **$400** | `ARITH` 8 games × $50 |
| Games assigned by hand | **0** | The point of the chapter |

---

## D. What the referee's phone says, word for word

Every string below is `PRODUCT`, from `app/(platform)/referee/requests/page.tsx` and
`app/(platform)/referee/page.tsx`.

| On screen | Value | Source |
|---|---|---|
| Page title | "Shifts & availability" | `requests/page.tsx` line 118 |
| Offer line | "{league} · {EEE, MMM d} · {window}" then the rate in green "${n}/game" | lines 164 to 172 |
| Broadcast pill | **first accept wins** | lines 178 to 182 |
| The message, quoted | "Saturday morning block · three courts running at the Playground." | line 203 |
| The pay sentence | "Paid per game officiated · accepting means agreeing to this rate. Games are tallied after the session and confirmed by the league before settlement." | lines 197 to 200. The product writes an em-dash; middot by the house rule |
| Accept confirmation | "You're booked: assigned to 8 games that day. See them in My games." | lines 74 to 80, the `gamesAssigned > 0` branch, with the count interpolated |
| Availability editor | "Days and hours you can work · leagues see this when they pick a referee." then his real slot | lines 233 to 236; `DB` the slot is Sat 8 Aug 09:00 to 18:00 |
| My games header | "Coming up (8)" | `referee/page.tsx` lines 66 to 68 |
| A game card | "{EEE, MMM d} · {h:mm a}" / "${rate}/game" / "{home} vs {away}" / "{venue} · {court} · {league}" | `referee/page.tsx` lines 111 to 143 |
| Bottom tab bar | Home · Chat · Calendar · **My Games** · Social | `PRODUCT` `components/nav/bottom-tabs.tsx` lines 110 to 118, with the `contextTab` at line 88 resolving to "My Games" for a referee |

### The branch this demo does NOT take, and why it matters

`PRODUCT` the accept confirmation has a second branch: *"You're booked. The league hasn't
published that day's schedule yet, so your games will appear in My games when it goes out."*
It fires whenever `gamesAssigned` is 0. `DB` all eight games on this day are published, so
the demo takes the first branch honestly. The existence of the second branch is the same
truth the `drafts` beat states out loud: a referee is never shown a game nobody else can
see. `lib/queries/referee-games.ts` says it in its own header comment, and
`attachAcceptedShiftsToPublishedGames` is the reconcile that fires when the drafts are
published later.

---

## E. The calendar feed

| On screen | Value | Source |
|---|---|---|
| The event title | "Officiating · {home} vs {away}" | `PRODUCT` `api/calendar/[token]/route.ts` line 165. The product writes an em-dash; middot by the house rule |
| The UID prefix | `ref-game-` | line 160, so an officiating event never collides with the same game arriving through a team membership |
| Which games are in it | assigned, `PUBLISHED_GAME`, status in SCHEDULED / LIVE / COMPLETED, inside the feed's own window | lines 98 to 115 |
| How he subscribes | one control, `webcal://` on Apple, add-by-URL on Google, copy-link fallback | `components/calendar/add-to-phone.tsx`, token minted by `POST /api/calendar/token` |
| The claim the demo makes | a live feed that corrects itself, on the ONE personal calendar he already has | Section F punch 4 |

The route's own comment is the reason this beat exists: *"QA-008: the feed only covered
games for teams the user BELONGS to, officiating assignments never appeared. Mirror the
in-app calendar's referee lens."*

---

## F. What the product cannot honestly show, and is therefore NOT staged

### 1. No money moves

`RefereeSettlement` has `gamesCount`, `ratePerGame`, `total` and a `status` of
`PENDING_CONFIRM` or `CONFIRMED`, and confirming writes `confirmedById` and `confirmedAt`
and nothing else. No transfer, no `Payment` row. `PaymentType.REFEREE_FEE` exists in the
enum with **zero** code references, and `RefereeProfile.stripeAccountId` /
`stripeAccountStatus` exist with **zero** references anywhere in `apps/web/src` or
`packages`: there is no Connect onboarding for referees.

So the demo's settlement card carries its own sentence rather than implying a payout:

> "A confirmed settlement is the agreed number, not a transfer: the platform does not move
> referee money today. What it removes is the end-of-season argument about how many games
> somebody worked and at what rate."

**PUNCH: decide whether referee payout is a product or a report.** If it is a product, the
schema is already half-built and unused; if it is a report, delete the dead Stripe fields
and the unused enum value so nobody demos them by accident.

### 2. No blackouts, only positive availability

`RefereeAvailability` is one row per "I can work this window". There is no blackout or
unavailable model for referees anywhere (the repo's `SeasonVenueUnavailability` and
`SeasonTeamBlackout` are venue and team constructs). So a referee who is free every
Saturday except one has to declare every Saturday he IS free, one row at a time, and a
referee who declares nothing is indistinguishable from one who has not opened the app.

The demo shows exactly that and makes the ambiguity a beat rather than hiding it: James
Okonkwo reads "no availability set", and the caption says the league is not left guessing
that it means no. **PUNCH: a blackout, or a recurring weekly pattern.**

### 3. The native app hides the rate

`apps/mobile/src/app/(tabs)/referee.tsx` ships the same shift inbox and assigned-games
list, and its `ShiftRequest` type and card markup carry **no rate field at all**, while the
web `/referee` and `/referee/requests` both show `${n}/game`. That is a parity-law
violation: the same screen at a lower fidelity on one surface is a bug.

This demo films the WEB phone surface, which is a real phone surface (see section H), and
the gap is recorded here rather than papered over. **PUNCH: put the rate on the native
referee cards.**

### 4. There is no referee-only calendar feed

Officiating events ride the ONE personal `/api/calendar/[token]` feed alongside the user's
team, practice and family events. There is no "subscribe to my officiating schedule" entry
point and no separate URL. The demo therefore claims exactly that and no more, and turns
it into the honest selling line: his kid's practices and his officiating land in the same
calendar. **PUNCH (optional): a filtered feed**, if referees ask for one.

### 5. Two assignment surfaces that do not know about each other

The day-level booking here is the league's route; per-game assignment lives on
`components/scoring/game-referee-control.tsx`, rendered on `/score`, which is where a crew
gets fixed at the table. Both write the same `UserRole(role=Referee, gameId)` row, so they
agree in the database, but neither UI mentions the other. **PUNCH: show the shift on the
game-day control**, so a scorer can see the day was already booked.

---

## G. Numbers deliberately NOT shown

| Not shown | Why |
|---|---|
| Mike's live "My games" count | `DB` the `UserRole` table currently holds **exactly one row**, a `PlatformAdmin`. Every referee assignment, operator role and coach role either seeder wrote has been wiped from this database at some point after seeding, so `getRefereeAssignedGameIds` returns **0** today and `/referee` renders its empty state. The **8** in this demo is derived the way the product derives it, by running `inShiftWindow` over the eight real published games on the real session day, rather than read off join rows that no longer exist. Re-run `scripts/seed-nph-demo.ts` and the query returns them directly. This is the same live-world defect recorded in `schedule-change-numbers.md` section C, and it is well beyond the demos: with no `UserRole` rows, no operator account on this box can sign in to a workspace at all |
| A referee rating | `RefereeProfile.averageRating` exists and is `DB` null on all three. Nothing is invented to fill it |
| A cert "Verified" badge | `DB` no referee has uploaded a certification document, so `certVerified` is false everywhere and the product would show no badge. The demo shows none |
| A payout, a transfer, or a total owed for the season | Section F punch 1. The demo shows one day's arithmetic and says what confirming is |
| The lowball warning | `PRODUCT` it fires when the offered rate is under the target referee's standard fee. `DB` the offer is $50 and every standard fee is $50, and it is a broadcast with no target anyway, so it would not fire. Not staged |
| The declined and cancelled offer states | Real (`RefereeRequestStatus`) but `DB` no row is in either state, and the story is about the accept |
| An email to the referees | `POST /api/leagues/[id]/referee-requests` emails **targeted** referees. This offer is a broadcast, so the demo claims the bell and the in-app inbox, which is what a broadcast really produces |

---

## H. Composition choices, declared

| Choice | Why |
|---|---|
| **The phone is a real surface, not a fabrication** | The audit's D table permits fabricating a handset composition of a desktop screen, and this demo does not use the permission. `/referee` and `/referee/requests` are responsive pages, and `components/nav/bottom-tabs.tsx` line 88 puts "My Games" pointing at `/referee` in the app's own MOBILE bottom bar whenever `shape.isRefereeing`. The native app ships the same screen at `apps/mobile/src/app/(tabs)/referee.tsx`. The tab strip drawn under the handset is that real bar: Home, Chat, Calendar, My Games, Social |
| The league side stays DESKTOP | `OWNER` audit section D: league planning and operator working surfaces stay desktop. The booking desk and the settlements ledger are both operator screens |
| Offers and the pool sit side by side | The three panels stacked ran 87px past the 600 logical box. Abreast, each fits on one line per row at 1160 |
| The pool steps aside when the phone arrives | From that beat the region is composed at 900, not 1160, and two panels abreast do not fit. No beat after chapter 1 targets the pool |
| 3 of 8 games on the handset, 2 of 8 in the calendar feed | The handset screen is 390 by 576 in this stage (`frames.tsx` documents why it is shorter than a real 844) and the scene never scrolls. Both lists carry the true count: the product's own "Coming up (8)" header, and "and 5 more that morning" |
| 4 of 6 settlement rows | Same 600 logical budget. The four shown cover both dates and both states; the two dropped are Sarah's and James's confirmed 11 July rows |
| The availability row leaves the phone after the accept | Height only. Nothing after the accept targets it |
| En dashes are kept in "09:00 – 15:00" and the preset labels | They are `PRODUCT` verbatim: `SHIFT_PRESETS` really reads "Full day (9–6)", "Morning 6h (9–3)", "Afternoon (12–6)". The house rule bans em-dashes, and there are none |

---

## I. Gates, this cut

| Gate | Result |
|---|---|
| `scripts/demo/readability-audit.mjs --routes /demos/the-referees` | **0 violations**, minimum stage scale **1.000**, 23 beats, 27 scenes audited |
| Same, `--viewport 390x844 --floor 11 --scope stage` (keyhole) | **0 violations** |
| Same, `--viewport 390x844 --floor 14 --scope chrome` | **0 violations** |
| Full playback drive, 23 beats stepped plus a 2x autoplay pass | **0 console errors**, **0 page errors** |
| Chapter jumps | **4 of 4 exact**: every chip lands on its own chapter's first beat |
| Runtime at 1x | **1 min 59 sec** (`data-demo-runtime-ms` = 119240) |
| Scene overflow (any node past the 600 logical box) | **none**, all 23 beats, on the wide region, the duo region and the handset |
| 390x844 horizontal overflow | **0 px** (`documentElement.scrollWidth` 390 = `clientWidth` 390) |
| `tsc --noEmit` | clean |
| Em-dash sweep | clean. The only dashes in the file are the en dashes the product's own shift presets and time ranges write |
| Database writes | **none**. Every derivation ran the product's own arithmetic over read-only queries |

---

## Sweep, 2026-08-16

**The confession beat is out.** The pay chapter ended on a beat captioned "It is a record, not a
payment, and the demo says so", whose balloon added "Nothing here moves money yet." Under the
owner's no-confession rule that beat is deleted, and the settlement panel's footer stopped saying
"the platform does not move referee money today". The footer now states what a confirmed settlement
IS: the number both sides agreed, the games worked on that session day at the rate on the offer the
referee accepted. The payout gap stays in this file, which is where the product backlog reads it.

**Copy, 18 captions and balloons.** Gone: "because they are a season-long cost, not an errand", "a
real list, not a memory", "Nobody negotiates at the scorer's table", "the league goes back to work",
"And it tells him he is racing", "A referee who arrives at the wrong gym is a forfeit", "a ghost
booking", "Then the part that ends the Sunday phone calls", "a number nobody has to argue about".
The registry description lost "the only one nobody has ever shown them software for", "different
from every scheduling tool", "rather than a fabrication" and "an honest line about what that
confirmation is and is not".

Gate re-run: readability audit **0 violations**, minimum stage scale **1.000**, 22 beats / 26
scenes, one headless drive with a clean console. Runtime **1 min 45 sec**.
