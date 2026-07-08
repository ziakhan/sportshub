---
updated: 2026-07-08
tags: [theme/ledgers, type/ledger, status/living]
---

# Feature backlog — requested but not built

The single place feature ideas land so none get lost. This is NOT go-live
gating (that's docs/launch-blockers.md) and NOT the work log (that's
docs/outstanding-items.md). Just the wishlist, roughly prioritized. We build
these ONE cohesive feature at a time, fully — never as a batch.

Legend: 🎯 owner-committed · 💡 owner-suggested · 🔬 researched · ⏸ parked pending a decision.

---

## Near-term / high value

### RSVP + attendance for calendar items 💡 (2026-07-07) — spec below
Members (parent for their kid, or a 13+ player) confirm Going / Not going /
Maybe on any calendar item — **practices, games, team events** — and the
event's owners (coaches, team managers, club/league) see the roll-up *in
advance*: who's confirmed, who's out, who hasn't answered.
- **Schema (additive):** `enum RsvpStatus { GOING, NOT_GOING, MAYBE }`;
  `model EventRsvp { id, playerId, itemType (PRACTICE|GAME|TEAM_EVENT),
  itemId, status, note?, respondedById, updatedAt; @@unique([playerId,
  itemType, itemId]); @@index([itemType, itemId]) }`. Keyed on the PLAYER
  (whose attendance matters), submitted by the parent/self.
- **API:** `PUT /api/rsvp` (set my kid's status for an item), and the
  calendar/roll-up reads fold RSVPs into their item payloads.
- **Family UI:** Going / Can't make it / Maybe buttons on each item in the
  team calendar (agenda + grid), + on the public game/live page for
  followers-who-are-members.
- **Owner UI:** a "who's coming" count + list per item (e.g. "9 going · 2
  out · 3 no reply") on the team dashboard / calendar for staff.
- **Game-day tie-in (the nice bit):** the live-scoring attendance step
  **pre-marks absent** any rostered player who RSVP'd Not going — the coach
  can still toggle, it's just a sensible default (a real gap the owner
  remembered: today attendance starts blank).
- **Notifications:** optional reminder to RSVP a couple of days before
  (reuse the practice/reminder cron pattern); notify staff if someone flips
  to Not going close to the event.
- Size: a focused feature-day. Fits cleanly on the existing calendar
  (Practice/Game/TeamEvent) + live-scoring attendance surfaces.

### Playoff generation 🎯 (owner-committed)
Top-N per division from standings → bracket → PLAYOFF sessions. Settings +
schema exist; no generator yet. (ledger)

### Homepage phase 2 💡
Fill the freed signed-in space: a "Your week" row (next game + next
practice), a getting-started nudge for empty accounts, reframe the
Programs/Clubs headings ("Near you"). (docs/home-redesign-plan.md)

### Site IA / menu cleanup 💡
Scores→Leagues, programs-vs-marketplace overlap, menu order. Seen in every
demo's nav. (docs/site-ia-plan.md)

---

## Engagement / content

- **Quizzes** 💡 — same engine as polls + a correct answer + scoring/
  leaderboard (rules quizzes, film sessions). (engagement-features-plan.md)
- **Club-wide / league-wide polls + public poll results** 💡 — polls beyond
  a single team; read-only results on public pages.
- **Web push** — reminders/notifications are email+bell only today. (M2)
- **Marketing copy refresh** 💡 — "parents" → "parents or players"; refresh
  the platform pitch now that there's more product.

## Roles / GTM

- **Creator/recruiter roles** 💡 — videographer, photographer, influencer/
  content creator, third-party coach, university recruiter. (ledger §7)
- **Carpool** 🔬⏸ — researched (docs), owner said not yet. Density + liability
  are the risks; we already own roster+schedule+identity.

## Ops / scale

- **Review moderation queue** — reviews are publicly writable, no moderation
  (also launch-blocker H4).
- **Chat scalability** 🎯-ish — polling → realtime/push at real volume.
- **Onboarding checklists + /help center + tutorial videos** — scripts
  written (docs/tutorials/), recording pending.

---

## How we use this
Add a line the moment an idea comes up. When picking the next build, pull
from "Near-term / high value" first. Move an item to the ledger when it
ships. Keep specs light here; expand into a dedicated doc only when a
feature is greenlit for build.
