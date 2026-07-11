---
updated: 2026-07-11
status: shipped
tier: 1
area: engagement
effort: M
source: owner
tags: [theme/engagement, type/plan, status/shipped]
---

# 📅 My Calendar — one cross-team schedule per person

**Owner direction (2026-07-11):** "The calendar should not be something you
have to go to. A parent should have a highly accessible 'My Calendar' in the
left menu — all kids, all teams, every event. A player logged into their own
account sees their own calendar. The grid view should be clickable to
respond. The RSVP UI needs clear colored options."

## What shipped (v1, 2026-07-11)

- **`/calendar` — My Calendar** for every signed-in member. One feed across
  ALL the user's teams: family side (kids' teams via `Player.parentId` — a
  13+ self-registered player is their own parent, so player logins get their
  own schedule with zero special-casing) and staff side (teams they coach /
  manage; club owners get every club team).
- **Sidebar**: "My Calendar" sits directly under Dashboard (desktop sidebar +
  mobile drawer) for Parent / Player / staff / club roles. The Player
  section's "My Schedule" now points here too.
- **API**: `GET /api/calendar/mine` (self-scoped; `lib/calendar/my-calendar.ts`)
  — practices + games + team events over the −7d…+70d window, deduped
  (a game between two of your teams appears once), with RSVP context:
  `playersByTeam` (family), `rosterByTeam` (staff), `byItem` answers.
- **Interactive grid**: chips in BOTH calendars (My Calendar + team calendar)
  open a centered popover (`components/calendar/item-popover.tsx`) with full
  details + the same RSVP controls / staff roll-up — no more read-only grid.
- **New RSVP control** (`components/calendar/rsvp-control.tsx`, shared):
  color-coded segmented buttons — **✓ Going (green) · ? Maybe (amber) ·
  ✕ Can't go (red)** — solid-filled when selected, one row per kid. The
  staff roll-up groups names by Out / Maybe / Going / No reply with notes.
- Mixed-role users (coach with a kid) get buttons for their kids AND
  roll-ups for the teams they run, on the same item.

## Deliberate v1 cuts / follow-ups

- RSVP-state dots on grid chips (✓/✕ at a glance before clicking).
- Week view / horizontal scroll on phones; month navigation beyond 6 weeks.
- Hover-preview popovers on desktop (click works everywhere; hover is sugar).
- Tryout/camp/HL program dates as lenses (pairs with [[program-staff-plan]]).
- Per-lens iCal feeds (subscribe to just one kid's calendar).
- Native app (M4) My Calendar tab reusing `/api/calendar/mine` via bearer.

## v2 — "multiple calendars" — ✅ SHIPPED 2026-07-11 (owner signed off the lens model same day)

Owner's mental model: a person holds SEVERAL calendars, not one merged blob —
a parent has one per child; a kid on two teams has two; a coach has one per
team they run; a referee has one per league they officiate. You must be able
to tell which calendar an item belongs to, and turn each on/off.

**The lens model.** A *calendar (lens)* = one membership source:
- Family: one lens per **kid × team** — "Miles · Lords Gr 9". A parent with
  two kids sees two lenses; a kid on two teams contributes two.
- Staff: one lens per **coached/managed team** — "Coaching · Force Gr 10".
- Referee: one lens per **league with assigned games** — "Refereeing · NPH
  Summer" (games via UserRole role=Referee gameId; no RSVP UI on these).
- League owners get NO firehose — only lenses they hold as staff/family/
  referee (already true today; kept deliberate).
- A player login is just the family case pointed at itself (one lens per
  team they're on).

**UI.**
- A chip row above the calendar: colored dot + label per lens; click
  toggles the lens on/off (persisted per user in localStorage; all on by
  default). Items belonging only to hidden lenses disappear from agenda,
  grid and popovers.
- Each lens gets a stable color from a small palette (by lens key). Agenda
  cards + grid chips carry the lens dot(s); an item spanning two lenses
  (kid on both sides of a game, coach + parent of same team) shows both.
- Item KIND (game / practice / event) keeps its existing encoding (card and
  chip styles) — lens color answers "whose", kind answers "what".

**Server.** `getMyCalendar` returns `lenses[]` ({key, kind: family|staff|
referee, label, teamId/playerId/leagueId}) and per-item `lensKeys[]`;
adds the referee source (assigned games grouped by league). RSVP context
unchanged.

**Add-to-phone (auto).** One click: mint token, sniff the platform
(iOS/macOS → open `webcal://` directly; Android → open the Google Calendar
subscribe URL) and go — no chooser. Small "Other options" link keeps the
old panel for edge cases. Follow-up: per-lens feeds.

## Refs
[[attendance-rsvp]] · [[program-staff-plan]] · [[engagement-features-plan]] · [[feature-backlog]] · `docs/pending-deploy-actions.md` #24
