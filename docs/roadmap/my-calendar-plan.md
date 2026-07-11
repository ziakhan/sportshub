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

- Per-kid color coding or filters (e.g. "show only Trey") — add when a
  family with 3+ kids asks.
- RSVP-state dots on grid chips (✓/✕ at a glance before clicking).
- Week view / horizontal scroll on phones; month navigation beyond 6 weeks.
- Hover-preview popovers on desktop (click works everywhere; hover is sugar).
- Referee assignments and tryout/camp/HL program dates on My Calendar —
  today it's team-membership items only (matches the iCal feed).
- Native app (M4) My Calendar tab reusing `/api/calendar/mine` via bearer.

## Refs
[[attendance-rsvp]] · [[engagement-features-plan]] · [[feature-backlog]] · `docs/pending-deploy-actions.md` #24
