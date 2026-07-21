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

**Open decision (medium — schema):** store the picked venue as (a) name/address
**text** into existing `location` (zero schema change), or (b) a proper
**`venueId` FK** on Tryout/Camp/HouseLeague/Practice/TeamEvent — consistent
with `Game.venueId`, enables venue links/maps/dedup. **Recommend (b) venueId FK**
with `location` text kept as denormalized fallback. Confirm before building.
