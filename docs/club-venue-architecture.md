---
theme: [architecture]
type: plan
status: draft
updated: 2026-07-02
tags: [theme/architecture, type/plan, status/draft]
---

# Club Management, Venues & Scheduling — Architecture Plan

> Planning doc, June 2026. Grounded in a code audit of the club lifecycle and
> venue/scheduling systems. Covers: admin club governance, scraping/claims/
> verification, venue discovery + Google hours, and making the venue substrate
> available to **both** leagues (games) and clubs (practices/events).

---

## 0. TL;DR — the seven moves

1. **One venue substrate, two consumers.** Today only *league seasons* consume
   venues. Clubs can't book a court for a practice. The keystone is a shared
   **occupancy layer** that both league games and club practices read/write, with
   one conflict checker so nothing double-books.
2. **Activate the dormant `Practice` model** — it exists in the schema with *zero*
   API/UI. Add `courtId`, build `/api/practices` + a team calendar.
3. **Pull venue hours + lat/lng from Google** — we already call Places Details but
   deliberately omit `opening_hours`. Add it, pre-fill `VenueHours` as a *suggestion*
   (manual override stays authoritative).
4. **A venue directory** — venues are global but undiscoverable (name-only search).
   Build a browsable, filterable directory so clubs reuse venues instead of re-adding.
5. **Admin club governance** — admins can suspend/transfer but can't *create, edit,
   import, or merge* clubs in-app. Close those gaps.
6. **In-app scraping via CSV-import-with-preview** — replace the offline script with
   an admin importer that dry-runs, dedupes, and keeps an audit trail + provenance.
7. **Claim hardening** — competing claims, ownership-transfer requests, and a
   domain-match trust signal to reduce manual review.

---

## 1. North star: one substrate, two consumers

The single most important architectural idea. Today:

```
Venue ─ Court ─ VenueHours        (global, shared)
   └─ SeasonVenue ─ Session ─ Day ─ DayVenue ─ Court   → Game   (LEAGUES only)
   └─ Practice (teamId, venueId, scheduledAt)           → DORMANT (no API/UI)
```

Games and practices are **separate tables with no shared availability check** — a
league could schedule a game on the same court+time a club booked for practice and
nothing would catch it. `Practice` has no `courtId` at all.

**Target:**

```
Venue ─ Court ─ VenueHours (base availability, optionally Google-seeded)
        │
        └── Occupancy(venueId, courtId, startAt, endAt, kind)   ← single source of truth
              ├─ produced by league scheduler  (kind = GAME)
              └─ produced by club practice/event booker (kind = PRACTICE | EVENT)
              → one conflict checker reads this for BOTH
```

Whether we model occupancy as a real `VenueBooking` table or as a **query-time
conflict service** over `Game` + `Practice` is a design choice (§4.2). Either way,
the rule is: *every venue+court+time reservation, from any source, is visible to
every other source.*

---

## 2. Club lifecycle & admin governance

### 2.1 Where we are
- `Tenant.status`: `ACTIVE | SUSPENDED | UNCLAIMED`. Scraped clubs land `UNCLAIMED`;
  owner-created land `ACTIVE`.
- Claim flow works: 6-digit code to the club's `contactEmail` → **auto-approves** on
  match; admin-review fallback when there's no email. Admin claims queue
  (approve/reject) exists.
- **Admin can:** view, search, suspend, reactivate, change plan, transfer ownership.
- **Admin cannot:** create a club in-app, edit club details, import via UI, merge
  duplicates, soft-delete, or see import/claim history with filters.

### 2.2 Adding clubs in-app (admin)
Build an **admin "Add club"** form (reuse `/api/tenants` create logic) with a status
toggle: create as `ACTIVE` (and optionally assign an owner by email) or as
`UNCLAIMED` (a manual scrape-style entry for owners to later claim). Low effort —
the create path already exists; it just isn't admin-exposed with a status choice.

### 2.3 Scraping / import — **recommended: CSV-import-with-preview**
Three options:

| Option | Effort | Verdict |
|---|---|---|
| **A. Offline script only** (today) | — | Not maintainable; no audit, no preview |
| **B. In-app CSV importer w/ dry-run** | Medium | ✅ **Recommended** |
| **C. Automated web crawler** | High + fragile + ToS risk | Defer |

**B** = an admin upload page that parses the CSV, shows a **preview table** (new vs
duplicate-by-slug/name, field mapping), lets the admin confirm, then imports as
`UNCLAIMED`. Add a `source` field (`"ontario-csv"`, `"manual"`, `"crawl:xyz"`) and an
**import audit log** (who, when, counts, skipped rows). This makes scraping a
repeatable, governed operation instead of a console script. Automated crawling (C)
can feed *into* the same importer later as just another `source`.

### 2.4 Claims hardening
Current flow auto-approves on email code. Add:
- **Competing claims:** if a 2nd user claims a club already `UNCLAIMED`-being-claimed
  or `ACTIVE`, route to admin instead of silently allowing — surface both claimants.
- **Ownership-transfer requests:** claiming an *already-ACTIVE* club becomes a
  transfer request (notify current owner + admin), not a normal claim.
- **Domain-match trust signal:** if the claimant's email domain matches the club's
  `website` domain, mark the claim *high-trust* (auto-approve or fast-track); else
  require review. Cheap, high-signal anti-fraud.
- **Claim audit + queue filters:** filter by status, age, trust signal; bulk approve
  high-trust verified claims older than N days.

### 2.5 Verification tiers
Keep email-code as primary; layer fallbacks for the many clubs with no/weak email:
1. **Email code** (have) → 2. **Domain match** (auto-trust) → 3. **Phone code** →
4. **Manual evidence** (admin review with a note/upload). A `verificationMethod`
field on `ClubClaim` records how each was verified for audit.

### 2.6 Admin club governance gaps to close
- **Edit club details** (name, contact, address, website) — currently immutable after
  import; needed to fix bad scrape data.
- **Merge duplicates** — detect near-duplicate names; merge teams/claims into a
  canonical tenant, redirect the slug.
- **Soft-delete** (`deletedAt`) — for junk/dead scrapes, reversible.

---

## 3. Venues

### 3.1 Where we are
- `Venue` is **global** (nullable `tenantId`) — created by one club, usable by all.
  Good. `placeId` dedup + name/city fallback dedup prevents most dupes.
- Google Places: autocomplete + details for name/address/**lat-lng**/phone. **Hours
  are NOT requested.** Any authenticated user can create a venue. `VenueHours` is a
  manual 7-day grid. No directory, no ownership/verification.

### 3.2 Discovery + Google hours — **recommended: pull hours, treat as suggestion**
Two parts:

**(a) Pull hours + geo from Google.** Add `opening_hours` (and we already get
geometry) to the Places Details `fields` array, then pre-fill `VenueHours` on venue
creation. **Caveat that drives the design:** a gym/school's Google "open hours" are
*not* the same as *court-booking availability* — so Google hours are a **starting
suggestion the owner edits**, never authoritative. Store a flag (`hoursSource:
GOOGLE | MANUAL`) so we know which to trust.

> **Cost/ToS note (a real decision):** `opening_hours` is a billable Places Details
> field, and Google's ToS restricts caching place data long-term. Plan: fetch once at
> venue creation, cache `placeId`, refresh on demand — don't background-sync all
> venues. Budget a per-create Places Details call (already happening for address).

**(b) A venue directory.** Promote the existing `GET /api/venues?q` into a
browsable, filterable directory (by city, court count, name) with a map view, so
clubs/leagues find and reuse venues instead of re-creating. This is also where venue
"hubs" could later show which clubs/leagues play there.

### 3.3 Who can add venues + governance — **recommended: open creation, admin curation**
Keep creation **open to any club/league owner** (low friction, and Google-backed
creation + placeId dedup keeps quality high). Add light governance:
- `createdByUserId` for provenance.
- Admin can **verify / edit / merge** venues (a venue directory admin view).
- Optional `verified` badge for trusted/known venues.

Restricting creation to admins would bottleneck onboarding for little gain — dedup
already prevents the main failure mode (dupes). So: *open to create, curated by admin.*

### 3.4 Hours model — two layers
1. **Base hours** (`VenueHours`, Google-seeded or manual) = the venue's normal weekly
   operating window.
2. **Availability overrides** = per-venue, per-date-range closures ("court 2 closed
   for renovation in July"). New lightweight table. The league season already layers
   its own `DayVenue.startTime/endTime` on top; clubs booking practices read the same
   base − overrides.

---

## 4. Practices & club events (activating the dormant model)

### 4.1 The gap
`Practice` exists in the schema (teamId, venueId, scheduledAt, duration, status) but
has **no API, no UI, and no `courtId`**. Clubs literally cannot book a venue for a
practice today. This is the biggest *functional* gap in the user's ask ("available to
clubs to schedule their practices and events").

### 4.2 The keystone: unified occupancy / conflict service
Decision — how do games and practices avoid double-booking the same court+time?

| Option | What it is | Trade-off |
|---|---|---|
| **A. Query-time conflict checker** | A service that, given (venueId, courtId, start, end), queries both `Game` and `Practice` for overlap | Simplest; no migration; slight query cost; **recommended to start** |
| **B. Materialized `VenueBooking` table** | Every reservation (game/practice/event) writes a row; one table is the source of truth | Cleaner long-term, more upfront work + dual-write discipline |

**Recommendation: start with A** (add `courtId` to `Practice`, write one
`checkVenueConflict()` used by the practice booker *and* surfaced as a warning in the
league scheduler), and migrate to **B** only if cross-entity scheduling gets heavy.
Either way, the league scheduler's existing internal conflict logic gets extended to
*also* see practices.

### 4.3 Team calendar + booking
- `POST /api/practices` (book venue+court+time, runs `checkVenueConflict`).
- A **team calendar** showing games + practices together (this also feeds the public
  team hub's Schedule tab from the earlier design work).
- Club-level "events" (non-team: tryouts already exist; add general club events if
  needed) reuse the same booking + conflict path.

---

## 5. How it connects: leagues + clubs share one venue layer

```
                    ┌─────────────── Venue directory (global, Google-seeded) ───────────────┐
                    │   Venue · Court · VenueHours(base) · AvailabilityOverride(closures)    │
                    └───────────────────────────┬──────────────────────────────────────────┘
                                                 │ both read base availability
                 ┌───────────────────────────────┼───────────────────────────────┐
                 ▼                                                                 ▼
        LEAGUE season scheduler                                        CLUB practice/event booker
        (SeasonVenue→Day→DayVenue→Court → Game)                        (Practice: team+venue+court+time)
                 │                                                                 │
                 └──────────────► checkVenueConflict(venue, court, start, end) ◄───┘
                                  (sees BOTH games and practices)
```

A club that also runs a league team gets one coherent picture: the venues it books
for practice and the venues its league plays in are the *same* directory, and the
conflict checker spans both.

---

## 6. Phased rollout

| Phase | Deliverable | Depends on | Value |
|---|---|---|---|
| **V1** | Google hours+geo pull → prefill `VenueHours`; `hoursSource` flag | — | Directly answers "hours from Google"; quick win |
| **V2** | Venue **directory** (search/filter/map) + `createdBy` + admin edit/verify | V1 | Discovery + governance |
| **V3** | Activate **Practices**: add `courtId`, `/api/practices`, team calendar, `checkVenueConflict` (games+practices) | — | Unlocks club scheduling (the core ask) |
| **V4** | Availability **overrides** (closures) consumed by booker + scheduler | V3 | Real-world accuracy |
| **C1** | Admin **club CRUD** (add/edit/soft-delete) | — | Fix scrape data, add clubs in-app |
| **C2** | **CSV importer** w/ preview + audit + `source` | C1 | Governed scraping |
| **C3** | **Claim hardening** (competing claims, transfer, domain-match) | — | Trust + less manual review |

V-track (venues/practices) and C-track (clubs/admin) are independent — can run in
parallel. **Suggested first:** V1 (Google hours — small, high-visibility) and C3 or
C1 depending on whether club *governance* or club *data quality* hurts more right now.

---

## 7. Key decisions (the forks worth pinning down)

1. **Venue creation governance:** open-to-owners + admin-curated (recommended) vs.
   admin/verified-only.
2. **Scraping approach:** in-app CSV importer (recommended) vs. keep offline script
   vs. invest in a crawler.
3. **Practice scheduling now or later:** build V3 (unlocks the club-scheduling ask)
   vs. defer until after Stripe/scoring.
4. **Conflict model:** query-time checker (recommended start) vs. materialized
   `VenueBooking` table.
5. **Google hours:** pull from Places Details as editable suggestion (recommended,
   billable) vs. manual-only (free, more owner effort).
```
