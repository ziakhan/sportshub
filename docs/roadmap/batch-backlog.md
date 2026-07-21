---
updated: 2026-07-21
tags: [theme/backlog, type/plan, status/collecting]
---

# 🗂️ Batch backlog — do these together (owner collecting, 2026-07-21)

> Owner is accumulating a list to build in ONE pass. **Do NOT build until the
> owner says go.** Add each item as it arrives, with enough spec + open
> questions that we can execute later without re-deriving. Nothing here is
> deployed.

---

> **SCOPE (owner 2026-07-21): app-wide, EVERY form.** "same changes everywhere
> across all forms. Everywhere at BCF we have calendar and venues." Items 1 & 2
> are sweeps across all date and venue/location fields, not just the tryout page.

## 1. Branded date/time picker — APP-WIDE sweep (replace native HTML pickers)
**Ask:** native `<input type="date"|"datetime-local"|"time">` is ugly; want a
styled calendar/time picker in our colors on EVERY form.

**Plan:** one reusable `DateTimePicker` in `components/ui/` with modes
`date` | `datetime` | `time`; branded month-grid popover (marker-highlight
language, brand CSS vars) + time selector; mobile-friendly. DOB fields need
fast **year/month jump** (birthdays are years back). Roll out to every surface.

**Inventory (all native date/time inputs found 2026-07-21):**
- Club: `clubs/[id]/camps/{create,[campId]/edit}`,
  `house-leagues/{create,[houseLeagueId]/edit}`, `teams/create`,
  `tournaments/{create,[tournamentId]/edit}`, `tryouts/{create,[tryoutId]/edit}`
- League season manage tabs: `playoffs-tab`, `referees-tab`,
  `roster-requests-panel`, `schedule-tab`, `scheduling-tab`, `sessions-tab`,
  + `manage/leagues/[id]/page.tsx`
- Players (DATE = DOB, needs year jump): `onboarding/forms/player-form`,
  `players/add`, `players/[id]/edit`
- Other: `referee/requests`, `teams/[teamId]/calendar/team-calendar`,
  `offers/offer-composer`, `components/venue-editor` (hours = time)
**Open Q (low):** combined popover vs calendar + separate time dropdown.
Default = combined, brand-styled.

---

## 2. Venue picker — APP-WIDE sweep (replace free-text location boxes)
**Ask:** location is a plain text box on tryouts (and elsewhere); make it a
search/add venue picker everywhere. Owner unsure of club venue strategy.

**Venue strategy answer (already resolved by the code):** reuse the SAME
GLOBAL venue system every form. Venues are already global + shared (Google
Places-backed, `placeId`-deduped: `Venue` + `Court` + `VenueHours`), and
leagues already use **`components/venue-selector.tsx`** — a 3-mode picker:
*selected / search existing / add via Google Places*. Exactly what the owner
described. Clubs get the identical picker; the only league-only extra is COURT
assignment for game scheduling (club tryouts/camps don't need courts). Venue
CREATION is already operator-gated (canManageVenues, locked 2026-07-20).

**Plan:** swap every free-text location field for `<VenueSelector>`.
**Surfaces:** tryouts (create+edit), camps (create+edit), house-leagues
(create+edit), tournaments (create+edit), team calendar events, practices,
team-events — anywhere a location/venue is entered.

**DECIDED (owner 2026-07-21): `venueId` FK.** Add `venueId` on Tryout / Camp /
HouseLeague / Practice / TeamEvent (consistent with `Game.venueId`); keep the
`location` text as a denormalized fallback for legacy rows.

### 2a. Every venue clickable → venue detail page + map (owner add)
Venues become clickable everywhere they appear. A venue detail page shows
name, address, **a map** (pin from the Google placeId/lat-lng), and the
venue's info + hours. Directory/menu page listing venues too. Viewable by
operators (and likely public-safe).

### 2b. ⭐ KEY ARCHITECTURAL RULING (owner 2026-07-21): scheduling hours are PER-ENTITY, not the shared venue's
The problem the owner caught: `VenueHours` is **global** (one open/close per
venue per weekday, shared by every league/club). `SeasonVenue` has NO hours of
its own. So a league setting "available hours for scheduling" today would edit
the SHARED venue hours, changing them for everyone else using that venue.

**Ruling:**
- The global `Venue` + `VenueHours` = the venue's **real** operating hours =
  the venue's own truth. For now NOBODY edits these as a scheduling side
  effect. (Later: a **venue-operator role** owns/edits them — future, see 2c.)
- When a league (or club) assigns a venue for a session/date, the availability
  windows they set are **scoped to THAT entity** (that season / league /
  club / booking) and are NOT written back to the global venue.
- So: add per-entity availability hours. Likely a new field/model on
  `SeasonVenue` (per-season availability windows) and/or on
  `SeasonSessionDayVenue` (per specific date), and a club equivalent for club
  scheduling. The global `VenueHours` becomes display/default only, never the
  scheduling source of truth for a specific org's booking.
- ⚠️ VERIFY DURING BUILD: `components/venue-editor.tsx` + league
  `venues-tab.tsx` — do they currently write global `VenueHours`? If a league
  edits hours there today, it's mutating the shared venue. That path must move
  to per-entity availability.

### 2c. Future (NOT now): venue-operator role
Plan to onboard venues as venue operators later. At that point they edit the
venue's real universal hours + info. Until then, the global venue hours are
essentially read-only reference; all scheduling uses per-entity availability
(2b). Capture only — do not build the operator role in this batch.
