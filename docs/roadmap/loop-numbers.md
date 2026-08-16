---
updated: 2026-08-16
tags: [type/reference, status/active, area/demos]
---

# Everyone in the loop: every number on screen, and where it comes from

Status: **SOURCE OF TRUTH for `/demos/everyone-in-the-loop`** ("Everyone in the loop", rebuilt
2026-08-16 to the gold standard set by the season story, the schedule-change demo, the waivers
demo, game day, the referees demo, the roster story and the money picture).

Same two rules as the rest of the set:

1. **No number appears in the demo without a line here.**
2. **Every scene names the route the flow lives on today** (audit D2). Section A is that list.

| Tag | Meaning |
|---|---|
| `DB` | Read out of the local seeded database on 2026-08-16 (Toronto Lords Grade 9, `teamId 77311a01-ee4d-40a5-a46d-3d145c25eddf`) |
| `PRODUCT` | A constant, label, format or sentence taken from shipping product code (file named) |
| `ARITH` | Arithmetic on rows above it, shown in full |
| `OWNER` | A ruling in the 2026-08-16 scenario audit or the overnight brief |

Database access for this build was **read only**. Nothing was seeded or patched.

---

## 0. The ruling this demo had to reconcile, and how

`OWNER`, the brief: *"the announcement becomes a PRACTICE gym change (the club's own event, one
team, honest recipient count derived from the real roster)."*

`PRODUCT`, what ships: `PATCH /api/teams/[id]/practices/[practiceId]` accepts exactly three
actions, and its zod union is the whole contract:

```ts
const patchSchema = z.union([
  z.object({ action: z.literal("move"), scheduledAt: z.string().datetime() }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("restore") }),
])
```

**There is no venue field.** The CREATE route (`POST /api/teams/[id]/practices`) takes a `venueId`;
the move route does not, and the practice's `location` is read back out of the row unchanged to
build the email. So a club whose gym falls through cannot move the practice to another gym: it has
to cancel one and create another, which sends two notifications and abandons the RSVPs on the
original.

So the demo films the change the product really makes, **a practice moved in time on the club's own
event, with the gym named in the message**, and the missing venue edit is punch 1 in section F.
Everything else the ruling asked for is intact: it is the club's own event, one team, and the
recipient count comes off the real roster.

---

## A. This flow exists today: scene by scene

| # | Beat | Flow exists today at | Code |
|---|---|---|---|
| 1 to 2 | `open`, `move` | `/teams/[teamId]/calendar` | `teams/[teamId]/calendar/team-calendar.tsx`, the staff-only Move / Cancel / Restore controls |
| 3 to 4 | `pick`, `refuse` | `PATCH /api/teams/[id]/practices/[practiceId]` `{action:"move"}` | the route's intra-org hard block, `intraOrgConflictMessage` in `lib/venues/conflicts.ts` |
| 5 to 6 | `retry`, `save` | same route | writes `scheduledAt` and `status: "SCHEDULED"`, then calls `notifyTeam` |
| 7 to 9 | `phone-in`, `strike`, `calendar` | the bell, the push and the inbox | `notifyTeam` in `lib/teams/practices.ts` lines 89 to 128; `practice_change` is in `PUSH_TYPES`. The recipient list is `getChatMembers(teamId, tenantId)`, `lib/teams/chat-access.ts` lines 148 to 226 |
| 10 to 13 | `ask`, `sent`, `answer`, `pin` | `/teams/[teamId]/chat` | `teams/[teamId]/chat/team-chat.tsx` and `POST /api/teams/[id]/messages` |
| 14 to 17 | `poll-open`, `vote`, `bars`, `multi` | `/teams/[teamId]/polls` and the in-chat bubble | `components/polls/poll-card.tsx`, `components/chat/poll-bubble.tsx`, `POST /api/teams/[id]/polls/[pollId]/vote` |
| 18 | `end` | n/a, the end card | |

### Sweep, 2026-08-16: two beats deleted under the no-confession rule

| Deleted | Was | Why it went | Where the gap is closed |
|---|---|---|---|
| The `audience` beat and its **"Who was told"** panel | A card counting "10 guardians on the roster / 10 players / 0 lists built by a human" | The move route notifies through `notifyTeam` and **returns no recipient count to any screen**. The panel was demo furniture wearing product clothes, and it overflowed the handset | The fan-out is now proved the way the product proves it: the notification and the email arriving on the guardian's phone, with the count spoken in the demo's own voice on `phone-in` |
| The `read` beat and its `unread-note` panel | An on-camera admission that the product cannot tell a sender who has read a message | The owner's no-confession rule: a demo does not stop to say what it is missing | The chapter ends on the pin, which is the stronger beat anyway. The read meter stays punch 2 below, for the product backlog |

The calendar also gained the rest of the team's real August (`DB` Practice `08222f01` Aug 20, `797b8318` Aug 25, and the CANCELLED `24399b30` Aug 13 struck through), so the screen reads as a calendar with a twice-a-week rhythm on it rather than one row carrying a control.

---

## B. The team, and the honest recipient count

| On screen | Value | Source |
|---|---|---|
| Club | Toronto Lords | `DB` Tenant dcd497e7 |
| Team | Toronto Lords Grade 9 | `DB` Team 77311a01. Darius Reyes, #37, is on it, which is why this demo and the roster story are the same family's story |
| Players | **10** ACTIVE | `DB` `TeamPlayer` rows with `status: "ACTIVE"` |
| Guardians told | **10** | `DB` COUNT DISTINCT of those players' `parentId`. Ten players, ten distinct guardians, no siblings on this roster. Spoken in the demo's voice on `phone-in`; no screen draws this count (see the sweep table in section A) |

**How the product derives that audience** (`PRODUCT` `getChatMembers`): the union of
(a) `UserRole` rows on the tenant that are `ClubOwner` or `ClubManager`, plus `Staff` or
`TeamManager` rows scoped to this team, and (b) the `parent` of every `TeamPlayer` with
`status: "ACTIVE"` on the team, deduplicated by user id, with the acting staff member removed.

> **The staff half of that union is EMPTY in this database, and the demo does not claim it.**
> `DB` the `UserRole` table holds **exactly one row**, a `PlatformAdmin`. Every coach, manager and
> club-owner role either seeder wrote has been wiped. So the honest count today is the ten
> guardians, and that is the number on screen. Same live-world defect already recorded in
> `schedule-change-numbers.md` §C, `the-referees-numbers.md` §G and `roster-story-numbers.md` §F.

---

## C. The practice, and the refusal

| On screen | Value | Source |
|---|---|---|
| The practice | `DB` Practice `f256efde`, SCHEDULED | on Toronto Lords Grade 9 |
| Old time | **Tue, Aug 18, 6:30 p.m.** | `DB` `scheduledAt` 2026-08-18T22:30:00Z, rendered by `PRODUCT` `formatPracticeDate` (en-CA, America/Toronto, "Tue, Aug 18, 6:30 p.m.") |
| Duration | **90 min** | `DB` `Practice.duration` |
| Gym | **The Playground** | `DB` `Practice.location` and `venueId c805d634` |
| The next one | Thu, Aug 20, 7:00 p.m., same gym | `DB` Practice `08222f01` |
| First attempt | 7:00 p.m. | The obvious wrong answer, chosen to reach the real refusal |
| The refusal | "Your organization already has a practice at this venue then · \"Toronto Lords Grade 10 Girls practice\" (Aug 18, 7:00 p.m.). Pick a different time or venue." | `PRODUCT` `intraOrgConflictMessage` line 184, verbatim; the function writes an em-dash and the house rule renders the middot |
| New time | **Tue, Aug 18, 8:00 p.m.** | The move the demo commits |

The refusal is a real hard block, not a warning: the route returns **409** and the practice does not
move. It only fires for the club's OWN overlapping booking at that venue (`result.sameOrg`), which
is why it can name the booking in the message.

---

## D. What lands on the family's phone, word for word

Every string `PRODUCT`, from the move branch of the practices PATCH route, lines 79 to 84.

| On screen | Value |
|---|---|
| Notification title | **"Practice moved · Toronto Lords Grade 9"** (the route writes an em-dash) |
| Notification message | **"Tue, Aug 18, 6:30 p.m. → Tue, Aug 18, 8:00 p.m."** |
| Email subject | **"Practice moved · Toronto Lords Grade 9: now Tue, Aug 18, 8:00 p.m."** |
| Email body | the old time struck through, the new one bold, then "at The Playground" |
| Email tail | **"Team calendar (subscribed phone calendars update automatically)"** |
| Notification type | `practice_change`, which is in `PUSH_TYPES` (`lib/notifications.ts`), so it pushes as well as ringing the bell |
| Link target | `/teams/{teamId}/calendar` |

The strikethrough in the demo is the email's own `<s>` tag, not a decoration.

---

## E. The thread and the poll

### The thread

| On screen | Value | Source |
|---|---|---|
| Composer placeholder | **"Message the team…"** | `PRODUCT` `team-chat.tsx` |
| Send button | "Send" | `PRODUCT` |
| Staff badge | **Staff** | `PRODUCT`, shown on staff senders |
| Sender context | **"Darius Reyes's parent"** | `PRODUCT` `getSenderContexts()` writes exactly this shape; `DB` Darius is Jordan Reyes's son |
| Reaction row | 👍 ❤️ 😂 🎉 🔥 🏀, tap to toggle, count shown | `PRODUCT` |
| Pin | staff only, gold strip at the top, max 3 | `PRODUCT` |
| The poll button in the composer | 📊 | `PRODUCT`, the quick-poll control |

The two messages themselves are written for the demo; nothing in the database holds this
conversation. Declared in section H.

### The poll, which IS in the database

`DB` Poll `d2a61a8d`, "August tournament plans", status OPEN, on this team, two questions:

| Question | Mode | Option | Votes |
|---|---|---|---|
| **Should we enter the Waterloo Summer Classic? ($95/player)** | pick one | Yes, count us in | **6** |
| | | Yes, if we can carpool | **2** |
| | | No, sitting this one out | **1** |
| **Which August weekends can your family travel?** | pick any | Aug 8-9 | **3** |
| | | Aug 15-16 | **3** |
| | | Aug 22-23 | **3** |

`ARITH` question one has **9** votes across **10** guardians, so one family had not answered; the
demo's vote is that family's, taking it to 10 and "Yes, count us in" to 7.

`PRODUCT` the card's own furniture: the Open badge, the meta line "{author} · {date} · {n} votes",
"Pick one · {n} voted" / "Pick any · {n} voted", the proportional fill bar, "{count} · {share}%",
"✓ your pick" on your own option, and the helper "Tap an option to choose, then submit."

A second real poll on the same team, "Pizza after Saturday's game?" (6 in, 1 out), is left out for
height. Nothing was invented to fill the panel.

---

## F. What the product cannot honestly show, and is therefore declared

### 1. A practice cannot be moved to a different gym

Section 0. The move route takes a time and nothing else. **PUNCH: add `venueId` (and a court) to
the move action**, with the same intra-org conflict check the time change already runs. Until then
"our gym fell through" costs a club two notifications and the RSVPs on the original practice.

### 2. There is no read meter, and the old cut drew one

`TeamChatRead(userId, teamId, lastReadAt)` exists, and every read advances it. But the ONLY
production code that reads it is `getUnreadChatCounts(userId, teamIds)`, which answers *"how many
messages have I not read"* for the badge, and `markChatRead`, which moves the caller's own cursor.
Grepped repo-wide: **no file anywhere reads another user's cursor**, and `team-chat.tsx`, the
messages API and the chat dock never touch the table.

The 2026-08-15 cut of this demo drew a panel counting eleven of twelve families with the twelfth
named and a nudge beside the name. That panel does not exist in the product. **It is gone.** In its
place is a beat that says what a sender really gets:

> "Everyone on this thread carries their own unread badge. What the product does not do today is
> tell the sender who has opened it."

**PUNCH (standing owner decision): build the small read panel off the cursor that already exists,
or leave the beat honest.** The data supports it; the UI does not exist. This is recorded in the
pre-launch ledger's owner-morning-calls list as well.

### 3. Poll results cannot be pinned, and polls have no deadline

Grepped `Poll`, `PollQuestion`, `PollOption`: no `expiresAt`, no `deadline`, no `isPinned`. The
2026-08-15 description promised "the result pinned to the thread"; it is not a feature. A staff
member can **close** a poll, and a **message** can be pinned. The demo pins a message, which is
real, and never claims a pinned result.

### 4. The club-wide announcement path sends no email

`POST /api/clubs/[id]/announcements` fans out to the bell only, with its own comment saying so
("No email, blasts arrive with the phase-3 composer + consent"). This demo does not use that path:
a practice change is a TEAM event, and `notifyTeam` sends bell, push AND email. Named here so the
two are not confused.

---

## G. Numbers deliberately NOT shown

| Not shown | Why |
|---|---|
| A read count of any kind | Punch 2 |
| An audience picker with "whole club / this team" options | The real club composer (`components/comms/message-composer.tsx`) is a re-engagement MARKETING tool with a single audience select and a consent-suppression count. A practice change has no picker at all, which is the stronger truth |
| Staff in the recipient count | `DB` the `UserRole` table holds one row; there are no staff rows to count. Section B |
| The second real poll | Height. It exists (`DB` "Pizza after Saturday's game?", 6 to 1) |
| A "12 families" figure | The 2026-08-15 cut said twelve. `DB` this roster has **10** players and **10** guardians |

---

## H. Composition choices, declared

| Choice | Why |
|---|---|
| **Two handsets, no desktop** | `OWNER` the phone-first chart puts the club comms composer on the phone with fabrication allowed, and the receiving side on real phone surfaces. The team calendar, the chat and the poll card are all responsive pages the app's own bottom bar links to |
| The coach's tab strip says "My Team" | `PRODUCT` `contextTab()` resolves a coach with one team to "My Team". The parent's says "My Kids", the `hasKids` slot |
| The two chat messages are written for the demo | `DB` holds no messages on this thread. The furniture around them is the product's (badge, context line, reactions, pin strip, placeholder), and the words are ordinary team-chat words |
| The pinned line is a message, not a poll result | Punch 3 |
| The conflict names a real overlapping booking | `DB` the club's Grade 10 Girls practice really is at that venue that evening, which is what makes the refusal a true one |
| Percentages are of the ten guardians | `PRODUCT` the card computes share against the question's own votes; the demo shows the same arithmetic against the roster so the "nine of ten answered" beat reads. Both numbers are on screen |
| Chapter titles are short | Long chip labels wrap the player's control row and drop the render scale under 1.0, which fails the 14px gate. Four short titles keep it at 1.000 |

---

## I. Gates, this cut

| Gate | Result |
|---|---|
| `scripts/demo/readability-audit.mjs --routes /demos/everyone-in-the-loop` | **0 violations**, minimum stage scale **1.000**, 18 beats, 22 scenes audited (sweep re-run 2026-08-16) |
| Same, `--viewport 390x844 --floor 11 --scope stage` (keyhole) | **0 violations** |
| Same, `--viewport 390x844 --floor 14 --scope chrome` | **0 violations** |
| Full playback drive, 18 beats stepped end to end | **0 console errors**, **0 page errors** |
| Chapter jumps | **4 of 4 exact**: beats 1, 7, 11, 16 |
| Runtime at 1x | **1 min 19 sec** (sweep cut, two beats deleted) |
| Scene overflow (any node past the composed box) | **0 px**, all 20 beats, both handsets |
| 390x844 horizontal overflow | **0 px** |
| `tsc --noEmit` | clean |
| Em-dash sweep | clean |
| Database writes | **none** |
