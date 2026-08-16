---
updated: 2026-08-16
tags: [type/reference, status/active, area/demos]
---

# Schedule change: every number on screen, and where it comes from

Status: **SOURCE OF TRUTH for `/demos/schedule-change`** ("A game moves, and everyone
knows", built 2026-08-16 to the gold standard set by the season story).

Same two rules as `season-story-numbers.md`:

1. **No number appears in the demo without a line here.**
2. **Every scene names the route the flow lives on today** (audit D2). Section A is that list.

| Tag | Meaning |
|---|---|
| `DB` | Read out of the local seeded database on 2026-08-16 (NPH Summer League, season Summer 2026, `seasonId fbbe767c-00e9-4130-9258-4f02c6854efa`) |
| `PRODUCT` | A constant, format or sentence taken from shipping product code (file named) |
| `ARITH` | Arithmetic on rows above it, shown in full |
| `OWNER` | A ruling in the 2026-08-16 scenario audit |

---

## 0. Why this runs on the Summer world and not the Showcase world

The brief said "pick a real NPH Showcase game". It cannot be one, and the reason is the
product's own rule rather than a preference.

`apps/web/src/app/api/games/[id]/route.ts` line 277 gates **every** notification branch on
`const isPublished = !!game.publishedAt`, with the comment: *"(publishedAt null) notify
nobody: the operator is still planning, and families only ever hear about games after the
schedule is published."*

`DB`, counted across every scheduled game in the database:

| League / season | Scheduled games | Published | Largest audience |
|---|---|---|---|
| NPH Showcase League / Fall/Winter 2026-27 | 725 | **0** | 3 |
| NPH Summer League / Summer 2026 | 45 | **45** | 20 |
| Phase9to15 League | 13 | 0 | 2 |

Moving a Showcase game today sends **nothing at all**, so a schedule-change demo staged on
it would be pitching a fan-out the product would not perform. The Summer world is the only
world in the database where this flow really fires, and it is also the world with real
rosters: the Showcase teams share **three** guardian accounts across nineteen players, while
every Summer player has a guardian account of their own.

> **Punch item (seed).** The Showcase season, which the season story is filmed on, has never
> been published, so its 725 games are drafts. That is correct for the season story (it ENDS
> at publish) and wrong for anything downstream of publish. If the Showcase world is meant to
> support post-publish demos, the seed has to publish it.

---

## A. This flow exists today: scene by scene

| # | Beat | Flow exists today at | Code |
|---|---|---|---|
| 1 | `open`, the Schedule tab scoped to one session | `/manage/leagues/[id]/seasons/[seasonId]/manage?tab=schedule` | `manage/components/schedule-tab.tsx`, the "Whole season / session" mode control and `GamesTable` |
| 2 | `row`, the game row opening | same | `schedule-tab.tsx` lines 1037 to 1071: the disclosure button carrying time, matchup, venue and court, the status badge and the caret |
| 3 | `alternates`, "Find alternates" | `POST /api/games/[id]/reschedule-suggestions` | `schedule-tab.tsx` line 1110 (the button) and `api/games/[id]/reschedule-suggestions/route.ts` (the search) |
| 4 | `slots`, "Suggested alternate slots" and the "same day" chip | same | `schedule-tab.tsx` lines 1145 to 1174; `sameDay` comes off the endpoint's own ranking |
| 5 | `move`, "Move here" | `PATCH /api/games/[id]` with `scheduledAt`, `courtId`, `venueId`, `dayId`, `dayVenueId`, `sessionId` | `applySuggestion`, `schedule-tab.tsx` lines 351 to 363 |
| 6 | `done`, the row at its new time | same | the row re-renders; **nothing marks it as changed**, see section E punch 3 |
| 7 | `phone-in`, the family calendar | `/calendar` | `app/(platform)/calendar/my-calendar.tsx`, `renderItem` lines 539 to 601 |
| 8 | `bell`, the in-app notification | the notification bell, and `/notifications` | `lib/notifications.ts` `notifyMany`; the row is drawn by `components/nav/notifications-bell.tsx` |
| 9 | `cal`, the row at its new time | `/calendar` | `my-calendar.tsx` `timeRange()` line 309 |
| 10 to 14 | `who` and the four fan-out rows | **server side only** | `lib/game-audience.ts` `getGameAudienceUserIds` lines 19 to 52. No screen shows it: section E punch 2 |
| 15 | `email`, bell and email off one list | `PATCH`/`DELETE /api/games/[id]` | `emailGameAudience`, `api/games/[id]/route.ts` lines 47 to 85, called with the same `audienceUserIds` array as the bell |
| 16 | `sunday`, the second row opening | `?tab=schedule` | as beat 2 |
| 17 | `cancel-press`, "Cancel game" and its confirmation | `schedule-tab.tsx` line 1134 (the button), line 324 (the confirm) | native `window.confirm` |
| 18 | `cancel-ok` | `DELETE /api/games/[id]` | `api/games/[id]/route.ts` lines 390 to 439, writes `status: "CANCELLED"` |
| 19 | `phone-cancel`, the cancellation notification | the bell | same route, lines 413 to 421 |
| 20 | `phone-row`, the cancelled calendar row | `/calendar` | `my-calendar.tsx` lines 551 to 571: `opacity-60`, `line-through` on the time, the red `Cancelled` pill |
| 21 | `email-line`, the email that stops the drive | the transactional email | `api/games/[id]/route.ts` line 314 |
| 22 | `end` | n/a, the end card | |

---

## B. The two games

Both are real rows, both published, both SCHEDULED at the time of reading.

| On screen | Value | Source |
|---|---|---|
| League | NPH Summer League | `DB` League.name |
| Season | Summer 2026 | `DB` Season.label |
| Session | **Weekend 11 · Aug 22** | `DB` SeasonSession.label, holding Sat 22 and Sun 23 August |
| Games in that session | **11** | `DB` count of Game rows on those two days |
| Games drawn on screen | **3 of 11** | `OWNER`/composition: three rows is what fits the scene at scale 1.0 with a row expanded and its alternates open. The count chip uses the product's own "N of M" label shape (`schedule-tab.tsx` line 897), so the slice is stated on screen |
| Session window | 09:00 to 20:00, both venues, both days | `DB` SeasonSessionDayVenue.startTime / endTime |
| Slot length | 90 minutes | `DB` Season.gameSlotMinutes = 90; `DB` Game.duration = 90 |
| **The moved game** | Sat Aug 22 · 9:00 AM · Oakville Panthers Grade 9 vs Toronto Lords Grade 9 · The Playground · Court 1 | `DB` Game `7e467b44-771a-49a8-8ed9-3824a1a089a3`, `publishedAt` set, status SCHEDULED |
| **The cancelled game** | Sun Aug 23 · 9:00 AM · Toronto Lords Grade 10 Girls vs West United Prep Grade 10 Girls · The Playground · Court 1 | `DB` Game `e8b48b34-7e13-4933-911b-7b7f545b620b`, `publishedAt` set, status SCHEDULED |
| Row time format | `Sat Aug 22 · 9:00 AM` | `PRODUCT` `schedule-tab.tsx` line 1046: `format(new Date(g.scheduledAt), "EEE MMM d · h:mm a")` |
| The other row shown | Sat Aug 22 · 9:00 AM · Mississauga Monarchs Grade 9 vs West United Prep Grade 9 · The Playground · Court 2 | `DB` Game `97a81a7d` |

### The alternates

`PRODUCT` `api/games/[id]/reschedule-suggestions/route.ts` returns slots where the court is
free and neither team is already playing, ranked **same session day first**, then by
chronological closeness. `DB`, The Playground Court 1 on Sat 22 August holds two games
(9:00 AM and 10:30 AM), so on the session's own 09:00 to 20:00 window at 90 minute slots the
free ones are:

| Slot | State |
|---|---|
| 9:00 AM | busy, the game being moved |
| 10:30 AM | busy, Burlington Force Grade 10 vs Kings Court Basketball Grade 10 |
| **12:00 PM** | **free, the top suggestion and the one taken** |
| 1:30 PM | free, second suggestion |
| 3:00 PM | free, third suggestion |
| 4:30 PM, 6:00 PM | free, below the fold |

All three drawn suggestions carry the `same day` chip, because all three are on the game's own
session day, which is what `sameDay` means in the endpoint's response.

---

## C. THE FAN-OUT, and it is the beat the demo exists for

`PRODUCT` `lib/game-audience.ts`, `getGameAudienceUserIds(homeTeamId, awayTeamId)`. Three
queries, deduped into one set of user ids:

1. `UserRole` where `tenantId in (both clubs)` and `role in (ClubOwner, ClubManager)`
2. `UserRole` where `teamId in (both teams)`, any role (head coach, assistant, team manager)
3. `TeamPlayer` on both teams where `player.deletedAt is null`, taking `player.parentId`

Referees are **not** in it (they hear about games through the referee-booking types), and the
league owner is deliberately excluded: *"League owners already know (they did it), so they're
not re-notified."*

Counted against the moved game, Oakville Panthers Grade 9 vs Toronto Lords Grade 9:

| Row on the ledger card | Value | Source |
|---|---|---|
| Teams | 2 | `DB` |
| Players on both rosters | **20** (10 + 10) | `DB` TeamPlayer count, `deletedAt` null on every one |
| **Guardian accounts** | **20** | `DB` distinct `Player.parentId` across those 20 rows. One guardian of record each, no siblings on these two rosters |
| **Coaches** | **4** | `DB` the four accounts `summer-coach-panthers-gr9@`, `summer-asst-panthers-gr9@`, `summer-coach-lords-gr9@`, `summer-asst-lords-gr9@` (Chris Patel, Elena Wright, Chris Hassan, Raj White), which `scripts/seed-summer-world.ts` lines 808 to 810 scopes to these two teams as Staff / HeadCoach and Staff / AssistantCoach |
| **Club owners** | **2** | `DB` `summer-owner-panthers@` (Carlos Santos) and `summer-owner-lords@` (Mark Harris), which `seed-summer-world.ts` line 718 scopes to these two tenants as ClubOwner |
| Phone calls | **0** | The point of the beat |
| **Total** | **26 people** | `ARITH` 20 + 4 + 2, all distinct accounts |

The cancelled game returns the same shape against different people: `DB` 20 players, 20
distinct guardians, and the four Grade 10 Girls staff accounts plus `summer-owner-lords@` and
`summer-owner-west@`. **26 again**, which is why the end card says fifty two.

> **DIVERGENCE, RECORDED (important).** The local `UserRole` table currently holds **exactly
> one row**, a `PlatformAdmin`. Every operator, coach and parent role either seeder creates
> has been wiped from this database at some point after seeding, while all 1,174 user
> ACCOUNTS are still present with their seeded names. So the live resolver run against these
> two games returns **20** today, not 26: the guardians resolve, the four coaches and the two
> club owners have no `UserRole` row left to be found by.
>
> The 4 and the 2 above are therefore counted from the accounts the seeder assigns those
> roles to (`seed-summer-world.ts` lines 718, 808 to 810, one head coach and one assistant per
> team, one owner per club), verified present in the database by email, rather than from the
> join rows. **Re-run `scripts/seed-summer-world.ts` and the query returns 26 directly.** The
> repair was not made here because writing to the database was outside this task's remit.
>
> This is a live-world defect well beyond the demo: with no `UserRole` rows, no operator
> account on the local box can sign in to a workspace at all.

> **PRODUCT TRUTH, RECORDED.** The platform holds **one guardian of record per player**
> (`Player.parentId`, a single foreign key). There is no second-parent link, so a fan-out is
> one adult per child, not two. The owner's "roughly 24 families / 50 to 60 people" estimate
> assumes two guardians per player; the schema does not support that today. Whether it should
> is a product question, and it is written down here rather than papered over with a bigger
> number.

---

## D. What the phone shows, word for word

### The family

| On screen | Value | Source |
|---|---|---|
| Account | Jordan Reyes | `DB` `summer-parent-lords@sportshub.demo` |
| Children | Darius #37 (Toronto Lords Grade 9) and Danielle #20 (Toronto Lords Grade 10 Girls) | `DB` two `Player` rows with this `parentId`, and their `TeamPlayer.jerseyNumber` |
| Why this phone | He is in **both** audiences: one child on the moved game, one on the cancelled one | `DB`. Both games are his weekend |

### The two notifications

`PRODUCT` `api/games/[id]/route.ts`. `fmtWhen` is
`toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })`, which is where the
lowercase "12:00 p.m." comes from; verified in node against these two timestamps.

| On screen | Value | Source |
|---|---|---|
| Move, title | **Game Rescheduled** | line 354 |
| Move, body | "Oakville Panthers Grade 9 vs Toronto Lords Grade 9 has moved to Aug 22, 2026, 12:00 p.m. at The Playground (Court 1)." | line 356, the template `${matchup} has moved to ${fmtWhen(...)}${" at "+venue}${" ("+court+")"}.` |
| Move, email subject | "Game rescheduled: Oakville Panthers Grade 9 vs Toronto Lords Grade 9" | line 361 |
| Cancel, title | **Game Cancelled** | line 417 |
| Cancel, body | "Toronto Lords Grade 10 Girls vs West United Prep Grade 10 Girls on Aug 23, 2026, 9:00 a.m. has been cancelled by the league." | line 419 |
| Cancel, email subject | "Game cancelled: Toronto Lords Grade 10 Girls vs West United Prep Grade 10 Girls" | line 424 |
| Cancel, email body line | "This game will not be played as scheduled · please do not travel to the venue." | line 314. The product writes an em-dash there; the house copy rule turns it into a middot, exactly as the season story does with the auditor's sentence |

### The calendar rows

`PRODUCT` `calendar/my-calendar.tsx`.

| On screen | Value | Source |
|---|---|---|
| Time range | "9:00 – 10:30 AM", then "12:00 – 1:30 PM" | `timeRange()` line 309: start, an en dash, end, with the meridiem dropped from the start when both halves match. `DB` Game.duration = 90 |
| The label | "vs Oakville Panthers Grade 9" | `eventLabel()` line 316: a game reads `vs ${opponent}` |
| The place line | "The Playground, Court 1 · Toronto Lords Grade 9" | line 596: `[location, teamName].join(" · ")`, the team name appearing because this family has more than one team |
| Cancelled row | 60 percent opacity, time struck through, red uppercase **CANCELLED** pill | lines 552 to 571, verbatim |
| Moved row | nothing. Same card, new time | lines 551 to 571 have no rescheduled branch. See punch 3 |

---

## E. What the product cannot honestly show, and is therefore NOT staged

Three, and all three are punch items rather than things the demo quietly invented.

### 1. There is no cancellation reason anywhere in the UI

`Game.statusReason` exists (`prisma/schema.prisma` line 2280, *"a predefined reason families
see in the notification"*), `PATCH /api/games/[id]` accepts it (line 109, trimmed, max 200),
it is written (line 254), and the notification body genuinely appends `Reason: <text>.`
(line 305) while the email adds `<p>Reason: ...</p>` (line 312).

**Nothing ever sends it.** A repo-wide grep for `statusReason` returns four hits, all four in
that one route file: the zod field, the write, and the two interpolations. No `.tsx` anywhere
in `apps/web` or the native app references it. The league's own Cancel game button calls
`DELETE /api/games/[id]`, which takes no body at all.

So the owner's ruled beat, *cancel WITH a reason*, is not filmed. The demo cancels the way the
product cancels. **PUNCH: build the reason picker.** The API and both message templates are
already waiting for it; this is a select and a PATCH away, and it is the single highest-value
fix this demo surfaced.

### 2. Nothing tells the league who was told

There is no confirmation on a move at all: "Move here" fires the PATCH immediately
(`applySuggestion`, lines 351 to 363). The cancel confirmation is one sentence and says
nothing about an audience. And after either one, no screen reports who was notified: the
audience is computed on the server and discarded.

So the fan-out chapter is drawn as an **explicit narration card**, in navy, with no console
chrome on it and a context strip that stops naming a product screen, so it can never be
mistaken for a panel the product has. **PUNCH: a "who was told" panel on the game row**, and
the count in the cancel confirmation before the league presses OK. The demo proves the sentence
is worth showing.

### 3. A moved game carries no mark

A cancelled row gets the dim, the strike and the pill on both the console and the family
calendar. A rescheduled one simply re-renders at its new time with nothing saying it changed,
on either surface. The demo shows exactly that: the row pops once as it lands, which is the
demo's own "watch this", and nothing persists on it. **PUNCH: a "moved" marker with the
previous time**, at least until the game is played.

---

## F. Numbers deliberately NOT shown

| Not shown | Why |
|---|---|
| A cancellation reason | Section E punch 1. No UI writes it |
| "N people will be notified" inside the cancel confirmation | Section E punch 2. The product does not say it, so the demo does not put it in a dialog. It says it on a narration card instead |
| An RSVP surviving the move | It is REAL: `EventRsvp` is keyed `@@unique([playerId, itemType, itemId])`, the move PATCH never touches it, and `resolveRsvpItem` re-reads the game's current time each call, so a "Going" survives a reschedule untouched. But `DB` these two games hold **zero** `EventRsvp` rows, and the beat already belongs to the your-week demo. Left out rather than staged on an unseeded state |
| A push notification claim | Push exists through Expo (`apps/sidecar/src/push.ts` to `exp.host`), but it depends on a fielded native build holding a device token, and the honest-limits rule keeps it out of a pitch. The demo claims only the bell and the email, both of which work today |
| The referees | `getGameAudienceUserIds` does not include them, so the ledger says so in its own footer rather than padding the count |
| The 725 Showcase games | Section 0. They are drafts and would notify nobody |

---

## G. Gates, this cut

| Gate | Result |
|---|---|
| `scripts/demo/readability-audit.mjs --routes /demos/schedule-change` | **0 violations**, minimum stage scale **1.000**, 25 scenes audited |
| Full playback drive, 22 beats stepped | **0 console errors**, **0 page errors** |
| Runtime at 1x | **1 min 42 sec** (`data-demo-runtime-ms`) |
| Scene overflow (any node past the 600 logical box) | **none**, all 22 beats |
| `tsc --noEmit` | clean |
| Em-dash sweep | clean. The only dashes in the file are the en dash the product's own `timeRange()` writes |
