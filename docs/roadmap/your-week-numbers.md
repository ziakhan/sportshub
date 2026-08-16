---
updated: 2026-08-16
tags: [type/reference, status/active, area/demos]
---

# Your week: every number on screen, and where it comes from

Status: **SOURCE OF TRUTH for `/demos/your-week`** ("Your week", rebuilt 2026-08-16 to the gold
standard set by the season story, the schedule-change demo, the waivers demo, game day, the
referees demo, the roster story, the money picture and the loop story).

Same two rules as the rest of the set:

1. **No number appears in the demo without a line here.**
2. **Every scene names the route the flow lives on today** (audit D2). Section A is that list.

| Tag | Meaning |
|---|---|
| `DB` | Read out of the local seeded database on 2026-08-16 (Toronto Lords, the Reyes family) |
| `PRODUCT` | A constant, label, format or sentence taken from shipping product code (file named) |
| `ARITH` | Arithmetic on rows above it |
| `OWNER` | A ruling in the 2026-08-16 scenario audit or the overnight brief |

Database access for this build was **read only**.

---

## 0. The invention this rebuild had to remove

`OWNER`, the brief: *"the fee/waiver-inline-in-the-week-list placement was an invention flagged to
the owner and never ruled: stage the REAL surfaces (calendar + the real places fees/waivers actually
appear on phone) and punch the invented placement."*

The 2026-08-15 cut put a fee installment and an unsigned waiver **inside** the week list, as rows
between the practices. Verified against the product, three ways:

1. `MyCalendarItem` and the client `ItemView` type in `my-calendar.tsx` have **no** waiver or fee
   field. The agenda can only draw practices, games and team events.
2. `lib/queries/my-contexts.ts`'s `actionsDue` object, which feeds the home band, carries
   `openOffers`, `paymentsDue`, `rsvpsNeeded`, `unreadChats` and `refereeOffers`. **There is no
   waiver field in it at all.**
3. Grepped every guardian-facing surface: a pending waiver reaches a parent through the bell, a
   push, an email, the token signing page, and a blocking modal at registration or offer-accept.
   Nowhere else. Not the home band, not `/players`, not the calendar.

So this cut stages the real surfaces (section E) and puts an honest beat on screen saying the two
are not in the week list. **PUNCH 1: decide whether the week list should carry them.** It is a
product decision, not a bug, and it is a good one to make: the demo's own last beat argues for it.

---

## A. This flow exists today: scene by scene

| # | Beat | Flow exists today at | Code |
|---|---|---|---|
| 1 to 4 | `open`, `lenses`, `where`, `cancelled` | `/calendar` | `app/(platform)/calendar/my-calendar.tsx`, forced into the AGENDA view on phones (a `matchMedia("(max-width: 639px)")` listener), with `components/calendar/agenda-list.tsx` drawing the month header and the date rail |
| 5 to 7 | `rsvp`, `going`, `twokids` | inline on the row → `PUT /api/rsvp` | `components/calendar/rsvp-control.tsx`; `EventRsvp` upserts on `[playerId, itemType, itemId]` |
| 8 | `tap`, the item popover | same page | `my-calendar.tsx`'s `ItemPopover` |
| 9 | `gamepage` | `/live/[gameId]` | the popover's own "Open game page →" link |
| 10 | `venue` | `/venues/[venueId]` | `components/venues/venue-link.tsx` on the game hero |
| 11 | `directions` | maps.google.com | `app/(public)/venues/[venueId]/page.tsx` lines 73 to 86, "Get directions →" |
| 12 to 14 | `moved`, `inplace`, `survives` | `PATCH /api/teams/[id]/practices/[practiceId]` | the same move the everyone-in-the-loop demo performs; the agenda re-renders the same row on its 45 second poll |
| 15 to 16 | `home`, `pay` | `/` then `/payments` | `app/(public)/home-personal-band.tsx`; `app/(platform)/payments/page.tsx` |
| 17 to 18 | `waiver-notif`, `sign` | the bell and a push, then `/waivers/sign/[token]` | `lib/waivers/reminders.ts`; `app/(public)/waivers/sign/[token]/page.tsx` |
| 19 | `punch`, the honest beat | n/a | Section 0 |
| 20 | `end` | n/a, the end card | |

---

## B. The week, and it is a real one

`DB` every row. The guardian is Jordan Reyes (`User 2a6333d5`), with Darius (`Player a18c732d`,
#37, Toronto Lords Grade 9) and Danielle (`Player 729b0d07`, #20, Toronto Lords Grade 10 Girls).

| Day | Time (America/Toronto) | What | Where | Row |
|---|---|---|---|---|
| **Mon 17 Aug** | 6:00 p.m. | Danielle's practice, **CANCELLED** | The Playground | `Practice ae1a4507`, `status: "CANCELLED"` |
| **Tue 18 Aug** | 6:30 p.m. | Darius's practice | The Playground | `Practice f256efde` |
| **Wed 19 Aug** | 6:30 p.m. | Danielle's practice | The Playground | `Practice 991206af` |
| **Thu 20 Aug** | 7:00 p.m. | Darius's practice | The Playground | `Practice 08222f01` |
| **Sat 22 Aug** | 9:00 a.m. | Oakville Panthers Grade 9 vs Toronto Lords Grade 9 | The Playground, Court 1 | `Game 7e467b44`, SCHEDULED |

Every practice is 90 minutes (`DB` `Practice.duration`), which is where the end time on each row
comes from. The game's 13:00Z reads 9:00 a.m. local.

**The cancelled Monday was not staged, it is in the database**, and it is the reason the demo can
show the product's real treatment of a cancelled item: the row stays where it was with a line
through it rather than disappearing.

**Tuesday is the same practice the everyone-in-the-loop demo moves**, which is why the change
chapter here shows it at 8:00 p.m. The two demos are two ends of one event.

### What the agenda row really renders

| Element | Value | Source |
|---|---|---|
| Month header | "AUGUST 2026", sticky, uppercase | `PRODUCT` `agenda-list.tsx` line 82 |
| Date rail | the day number over the three-letter weekday | `PRODUCT` lines 96 to 114 |
| Time range | "6:30 – 8:00 PM" | `PRODUCT` `timeRange()`, which drops the AM/PM from the start when it matches the end's half-day |
| A practice's title | the word **"Practice"** | `PRODUCT` `eventLabel()` |
| A game's title | **"vs {opponent}"** | `PRODUCT` the same function |
| The line under it | `[location, teamName].join(" · ")` | `PRODUCT` `my-calendar.ts` lines 294, 326, 348 |
| **No court** | the agenda carries the venue only | `PRODUCT` the item type has no court field |
| Kind | a coloured LEFT BORDER, not a text chip | `PRODUCT` `KIND_EDGE`: game `--energy`, practice `--brand`, event `--highlight` |
| Multiple children | one "lens" chip per child per team, tappable | `PRODUCT` lines 429 to 453, e.g. "Darius · Grade 9" |
| Cancelled | struck-through time and title | `PRODUCT` the agenda's cancelled treatment |

---

## C. The RSVP, and why it survives a change

| On screen | Value | Source |
|---|---|---|
| The three pills | **"✓ Going"**, **"? Maybe"**, **"✕ Can't go"** | `PRODUCT` `rsvp-control.tsx` lines 23 to 51, verbatim including the marks |
| Where they are | inline on the row, for upcoming SCHEDULED items only | `PRODUCT` |
| Per child | one row of pills per player when more than one of hers is on the event | `PRODUCT` `withNames` defaults to `players.length > 1` |
| The write | `PUT /api/rsvp` upserting `EventRsvp` | `PRODUCT` |

**The survival claim is structural, not a hope.** `EventRsvp` is unique on
`[playerId, itemType, itemId]` and **has no date or time column at all**, and
`PATCH /api/games/[id]` never touches the table (grepped: zero references). So a reschedule is
incapable of disturbing an answer that is already given. The demo says exactly that and no more.

---

## D. The gym, in the number of taps it really takes

| Tap | Screen | Source |
|---|---|---|
| 1 | the row opens the item popover | `PRODUCT` `ItemPopover` |
| 2 | "Open game page →" goes to `/live/[gameId]` | `PRODUCT` lines 622 to 627 |
| 3 | the venue NAME is a link to `/venues/[venueId]` | `PRODUCT` `venue-link.tsx` on the game hero |
| then | **"Get directions →"** opens maps | `PRODUCT` `venues/[venueId]/page.tsx` lines 73 to 86 |

`DB` the address is `Venue c805d634`: **952 Century Dr, Burlington**, built by the page as
`[address, city, state, zipCode].filter(Boolean).join(", ")`.

**PUNCH 2: put the address, or a directions link, on the agenda row or its popover.** The 2026-08-15
cut simply drew "Get directions" on the RSVP sheet, which is not where it lives. This cut walks the
three taps and says out loud that it is further away than it should be.

---

## E. The fee and the waiver, on the surfaces they really reach

### The fee

| On screen | Value | Source |
|---|---|---|
| Home band heading | **"Needs your attention"** | `PRODUCT` `home-personal-band.tsx` lines 87 to 89 |
| The card | **"1 payment due"** / **"View and pay"** → `/payments` | `PRODUCT` lines 36 to 42. It carries a COUNT, not a dollar figure and not a date, and the demo says so |
| The count's source | `prisma.paymentObligation.count({ status in [PENDING, PARTIALLY_PAID] })` | `PRODUCT` `my-contexts.ts` lines 65 to 67 |
| `/payments` header | "1 open item · $447.50 outstanding." | `PRODUCT` lines 66 to 69, with `DB` her real balance |
| The plan | Deposit, Installment 1 (Paid), Installment 2, Installment 3 at **$223.75** each | `PRODUCT` lines 72 to 115, labels "Deposit" for installment 1 and "Installment N" after; `DB` obligation `e2f5e46b`, $895 with $447.50 paid in two real offline payments |
| Status chips | "Paid" / "Upcoming" | `PRODUCT` lines 11 to 16 |
| Not a push | `payment_reminder` and `payment_overdue` are NOT in `PUSH_TYPES`: bell and email only | `PRODUCT` `lib/notifications.ts` |

### The waiver

`DB` `WaiverSignRequest ffa1aaa7`: the league's Rowan's Law waiver, emailed to
`summer-parent-lords@sportshub.demo` on **17 July** for **Danielle**, expiring **5 October**,
`consumedAt` **NULL**. Her brother's twin request (`a5436e45`) was consumed the next day and his
`WaiverSignature` is on file. So one of this guardian's two children is signed and one is not, and
that is the real state this demo shows.

| On screen | Value | Source |
|---|---|---|
| Notification title | **"Waiver still unsigned"** | `PRODUCT` `lib/waivers/reminders.ts` lines 164 to 166 (the 7-day window; the 24-hour one reads "Sign before the first game") |
| Message | "NPH Summer League: Danielle can't play until you sign \"Concussion Code of Conduct (Rowan's Law)\". Tap to sign, it takes a minute." | `PRODUCT` the same lines, with `DB` the real league, child and document title |
| It pushes | `waiver_reminder` IS in `PUSH_TYPES`, commented "Time-sensitive family action: unsigned waiver blocks play" | `PRODUCT` |
| The link | `/waivers/sign/{token}` | `PRODUCT` |
| The signing page | required, renews yearly, version 1, an acknowledgment naming the child, a finger signature | `PRODUCT` the real page; `DB` the document is required, renewing, version 1 |

---

## F. What the product cannot honestly show, and is therefore declared

1. **Fees and waivers are not in the week list** (section 0, punch 1).
2. **The address is three taps away** (section D, punch 2).
3. **There is no "Moved" badge and no pulse.** The real agenda polls every 45 seconds and
   re-renders the same row, keyed by `${kind}-${id}`, with the new time. No animation, no badge, no
   duplicate. The 2026-08-15 cut drew a gold "Moved" badge and an amber pulse; both are gone, and
   the beat now makes the calmness itself the point.
4. **There is no "answered Tuesday" timestamp.** The RSVP payload is
   `Record<string, {status, note}>` with no time in it. The previous cut printed one. Gone.
5. **The lens chips are real but the demo does not toggle one off.** The control is genuine
   (`aria-pressed`, persisted to `localStorage`), and the beat describes it rather than spending a
   press on hiding half the week.

---

## G. Numbers deliberately NOT shown

| Not shown | Why |
|---|---|
| A court on an agenda row | `PRODUCT` the agenda item has no court field. The court appears on the game page |
| The page subtitle | `PRODUCT` "Every game, practice and event across all your teams · answer Going or Can't go right here" is real, and takes three lines of a 508px handset. Declared in section H |
| A staff RSVP roll-up | Real (`RsvpRollup`, "N going · N out · N maybe · N no reply") but it is the coach's view, not hers |
| Thursday's practice as a drawn row | Real (`DB` `Practice 08222f01`) and counted under the list instead, for height. Section H |
| A second child on the Saturday game | `DB` only Darius's team plays that day, so only his RSVP row renders. The two-children case is described rather than faked |

---

## H. Composition choices, declared

| Choice | Why |
|---|---|
| **One handset, life size** | `OWNER` the brief. 390 logical at scale 1.0 on a computer; on a phone the stage shows the whole handset scaled to the viewport width |
| 4 of the 5 real items drawn | The handset screen is 390 by 508 and the scene never scrolls. Thursday is named under the list rather than dropped |
| The page subtitle is not drawn | Height, section G. The title is |
| The week is presented as Monday to Saturday | `DB` those are the real dates; the agenda groups by day and the demo shows them in order |
| The maps result is a card, not a screenshot of Google Maps | The demo does not fake a third-party surface; it shows the address handing off |
| Chapter titles are short | Long chip labels wrap the player's control row and drop the render scale under 1.0 |
| En dashes kept in "6:30 – 8:00 PM" | `PRODUCT` `timeRange()` writes an en dash. The house rule bans em-dashes, and there are none |

---

## I. Gates, this cut

| Gate | Result |
|---|---|
| `scripts/demo/readability-audit.mjs --routes /demos/your-week` | **0 violations**, minimum stage scale **1.000**, 20 beats, 25 scenes audited |
| Same, `--viewport 390x844 --floor 11 --scope stage` (keyhole) | **0 violations** |
| Same, `--viewport 390x844 --floor 14 --scope chrome` | **0 violations** |
| Full playback drive, 20 beats stepped twice plus a 2x autoplay pass | **0 console errors**, **0 page errors** |
| Chapter jumps | **5 of 5 exact**: beats 1, 5, 8, 12, 15 |
| Runtime at 1x | **1 min 45 sec** |
| Scene overflow (any node past the composed box) | **0 px**, all 20 beats |
| 390x844 horizontal overflow | **0 px** |
| `tsc --noEmit` | clean |
| Em-dash sweep | clean |
| Database writes | **none** |
