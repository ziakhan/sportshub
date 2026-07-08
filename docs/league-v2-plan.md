---
theme: [leagues]
type: plan
status: shipped
updated: 2026-04-20
tags: [theme/leagues, type/plan, status/shipped]
---

# Leagues v2 — End-to-End Plan

> **Status:** Draft, awaiting owner approval. Captured 2026-04-20 from back-and-forth design session (see [league-v2-design-qa.md](league-v2-design-qa.md) for the Q&A that produced this plan).
>
> **Scope:** schema reshape → setup → registration → finalize → regular-season schedule generation → editing.
> **Out of scope (separate phases):** playoffs, live scoring, public site, officials, Stripe payments.

---

## Phase 0 — Schema reshape (breaking)

Foundation. Requires a migration + re-seed since the existing `League` row collapses league + season into one.

### New/changed models

**`League` (persistent, slimmed down)**
- `id`, `name`, `description`, `ownerId`, `currency`, `stripeAccountId`
- Relation: `seasons: Season[]`

**`Season` (new — absorbs most of today's `League` fields)**
- `id`, `leagueId`, `label` (`"Fall/Winter 2026-27"`), `type` (enum: `FALL_WINTER`, `SUMMER`, `SPRING`, `CUSTOM`), `startDate`, `endDate`, `registrationDeadline`, `ageGroupCutoffDate`
- Pricing: `teamFee`, `currency`
- Game format: `gameSlotMinutes`, `gameLengthMinutes`, `gamePeriods`, `periodLengthMinutes`
- Scheduling targets: `gamesGuaranteed`, `targetGamesPerSession` (new), `idealGamesPerDayPerTeam`
- Scheduling hours defaults: `defaultVenueOpenTime`, `defaultVenueCloseTime`
- Scheduling philosophy: `schedulingPhilosophy` (`FAMILY_FRIENDLY` | `SPREAD_DAYS`, default `FAMILY_FRIENDLY`, hidden in UI)
- Cross-division toggle: `allowCrossDivisionScheduling: Boolean`
- Tiebreakers: `tiebreakerOrder: String[]` (ordered list of rule keys), `tiebreakersLockedAt: DateTime?`
- Status: `status: SeasonStatus` (same enum as today's `LeagueSeasonStatus`)
- Playoffs: `playoffFormat`, `playoffTeams`
- Relations: `divisions`, `teamSubmissions`, `sessions`, `venues`, `rosters`, `games`, `schedulingGroups`

**`Court` (new, child of Venue)**
- `id`, `venueId`, `name` (`"Court 1"`, `"Main Gym"`), `displayOrder`
- `Venue.courts: Int` becomes derived from `Court[]`; keep a back-compat count accessor for migration

**`VenueHours` (new — default weekly schedule on venue)**
- `id`, `venueId`, `dayOfWeek` (0–6), `openTime`, `closeTime`
- 7 rows per venue (null row = closed that day)

**`SeasonSession` (renamed from `LeagueSession`)**
- `id`, `seasonId`, `label`, `phase: SessionPhase` (`REGULAR` | `PLAYOFF`), `targetGamesPerTeam` (overrides `Season.targetGamesPerSession` when set)
- Remove `venueId` — no longer one-venue-per-session
- Relation: `days: SeasonSessionDay[]`

**`SeasonSessionDay`**
- `id`, `sessionId`, `date`
- Remove `startTime`/`endTime` (move to day-venue)
- Relation: `dayVenues: SeasonSessionDayVenue[]`

**`SeasonSessionDayVenue` (NEW — the scheduling substrate)**
- `id`, `dayId`, `venueId`
- `startTime`, `endTime` (override; fall back to VenueHours → Season defaults)
- Relation: `courts: SeasonSessionDayVenueCourt[]` — which specific courts this booking gets

**`SeasonSessionDayVenueCourt`**
- `id`, `dayVenueId`, `courtId`

**`SeasonVenue` (renamed from `LeagueVenue`)**
- Same shape but keyed by `seasonId`. Mostly a "this season uses these venues" registry + defaults; actual availability lives on the day-venue rows.

**`Division` (renamed from `LeagueDivision`)** — unchanged fields

**`SchedulingGroup` (NEW)**
- `id`, `seasonId`, `name`
- `divisions: Division[]` (many-to-many)
- Used by generator to merge small divisions into one scheduling pool without merging their standings. Divisions not in any group schedule on their own.

**`TeamSubmission` (renamed from `LeagueTeam`)**
- Unchanged fields except renamed `leagueId → seasonId`
- `paymentStatus: PaymentStatus` (`UNPAID` | `PAID_MANUAL` | `PAID_STRIPE` | `WAIVED`) — replaces simple `paymentId` link (paymentId stays for Stripe linkage but doesn't gate approval)

**`Game` (existing, minor additions)**
- `seasonId` (replaces `leagueId`), `phase: SessionPhase`, `sessionId`, `dayId`, `dayVenueId`, `courtId`
- `status` enum += `DEFAULTED`
- `isLocked: Boolean @default(false)` — soft lock
- `defaultedBy: String?` (home/away team id)

**`SeasonTeamBlackout` (v2 placeholder — table only, not consumed yet)**
- `id`, `seasonTeamId`, `date`, `startTime?`, `endTime?`, `reason`

### Enums
- `SeasonType`: `FALL_WINTER`, `SUMMER`, `SPRING`, `CUSTOM`
- `SessionPhase`: `REGULAR`, `PLAYOFF`
- `PaymentStatus`: `UNPAID`, `PAID_MANUAL`, `PAID_STRIPE`, `WAIVED`
- `SchedulingPhilosophy`: `FAMILY_FRIENDLY`, `SPREAD_DAYS`

### Migration strategy
Since models rename (`LeagueSession → SeasonSession`, etc.), do this as a single Prisma migration + one-shot data transform that creates one `Season` per existing `League` row and repoints FK chains. Non-prod data can be nuked and re-seeded.

---

## Phase 1 — League + Season CRUD

- `POST /api/leagues` — create persistent league (name, description).
- `GET/PATCH /api/leagues/[id]` — manage.
- `POST /api/leagues/[id]/seasons` — create season under league.
- `GET/PATCH /api/seasons/[id]` — manage season (all scheduling/pricing fields).
- Pages:
  - `/leagues/create` (simpler, just league metadata)
  - `/leagues/[id]` (league dashboard — lists seasons, has "New Season" CTA)
  - `/leagues/[id]/seasons/[seasonId]/manage` (current `/leagues/[id]/manage` content, one level deeper)

---

## Phase 2 — Venues + Courts

- Extend venue editor with:
  - Court editor (add/name/reorder courts)
  - Weekly hours editor (7-day grid with open/close per day)
- API: `POST/GET/DELETE /api/venues/[id]/courts`, `PUT /api/venues/[id]/hours`
- Back-compat: keep `Venue.courts` Int as derived count for now, migrate reads later.

---

## Phase 3 — Season setup UI (manage page rewrite)

The single 946-line `manage/page.tsx` becomes tabs under `/leagues/[id]/seasons/[seasonId]/manage`:

1. **Overview** — status + progress checklist
2. **Divisions** — CRUD (ageGroup, gender, tier, maxTeams)
3. **Venues** — pick from global venues → `SeasonVenue` rows with override knobs
4. **Sessions** — create session → add days → per-day add venue(s) → per-venue pick courts + override hours. Phase=REGULAR for v1.
5. **Scheduling settings** — game format, season targets, philosophy (hidden by default), cross-division toggle
6. **Tiebreakers** — ordered list editor with standard options: Wins → Win % → Head-to-head → Point differential → Points scored → Points allowed → Coin flip. Locked at finalize.
7. **Registrations** — team list with PENDING/APPROVED/REJECTED filters + payment-status column + "mark paid" quick action
8. **Schedule** — read-only until generated, then editable grid (Phase 6+)

---

## Phase 4 — Registration pipeline

Minimal changes from today, plus:
- Club submit API renames `/api/leagues/[id]/submit` → `/api/seasons/[id]/submit`.
- Roster snapshot behavior unchanged.
- League owner can approve without payment. Payment status tracked separately:
  - `PATCH /api/seasons/[id]/teams/[id]` supports `status` (approve/reject/withdraw) *and* `paymentStatus` (mark paid/unpaid/waived) independently.
- Notifications unchanged.

Division capacity: already enforced at submit time (per memory); verify it checks `maxTeams` against APPROVED + PENDING count and rejects submit past cap.

---

## Phase 5 — Finalization (expanded preflight)

Extend the existing preflight in `PATCH /api/seasons/[id]` when `status: FINALIZED`:
- All existing checks (required scheduling fields, ≥1 division/session/venue, no PENDING teams) ✓
- NEW: every session has ≥1 day with ≥1 day-venue with ≥1 court
- NEW: tiebreaker order non-empty
- NEW: if `allowCrossDivisionScheduling` and any `SchedulingGroup` exists, every division in a group has ≥2 teams
- NEW: total court-minutes available across sessions ≥ estimated required minutes (best-effort feasibility check — warn, don't block)

On success:
- Lock all rosters (`isLocked=true`, already done)
- Lock tiebreakers (`tiebreakersLockedAt = now`)
- Persist a snapshot of the scheduling config onto the season for audit

---

## Phase 6 — Schedule generator (regular season)

### API
- `POST /api/seasons/[id]/schedule/preview` — runs generator, returns proposed game list + unassigned/warnings. Does NOT write.
- `POST /api/seasons/[id]/schedule/commit` — writes `Game` rows in a transaction, clears any existing REGULAR games if requested.
- `DELETE /api/seasons/[id]/schedule` — wipe (only if no games have statuses beyond SCHEDULED).

### Algorithm (v1)

For each scheduling unit (division, or SchedulingGroup if divisions are grouped):

1. **Build slot inventory**: enumerate all `SeasonSessionDayVenueCourt` rows across the season's REGULAR sessions. For each court, subdivide the `[startTime, endTime]` window into `gameSlotMinutes` increments. Each slot = `{ sessionId, dayId, courtId, startAt, endAt, venueId }`.

2. **Build pairing pool**: compute `gamesGuaranteed × teamCount / 2` target pairings. Pick pairings with a fairness heuristic:
   - Start with all unique pairs sorted by how few times each team has played the other.
   - If target > unique pairs available: cycle through again (allowed repeats — small divisions).
   - If target < unique pairs: sample evenly, preferring pairs not yet seen (large divisions).

3. **Assign pairings to slots** (constraint-solver pass, greedy with backtracking):
   - For each pairing, find a slot where **neither team is double-booked** and court isn't double-booked.
   - Prefer slots that hit soft goals in order: session target not yet met for both teams → philosophy preference (clustering vs spreading for each team) → back-to-back avoidance (unless SPREAD_DAYS) → opponent diversity.
   - Hard fail conditions bubble up as "cannot schedule X games — insufficient slots."

4. **Return preview**: `{ games[], unscheduled[], warnings[], utilization: { courtHoursUsed, courtHoursAvailable } }`.

Philosophy branch:
- `FAMILY_FRIENDLY`: when a team plays multiple games in one day, minimize gap between their games; avoid splitting a team's weekend across multiple days when possible.
- `SPREAD_DAYS`: maximize distinct days per team across the season; avoid clustering same-day games for one team.

### Constraint priorities (codified)

```
Hard:
  - no team plays two games at overlapping times
  - no court hosts two games at overlapping times
  - games fall inside day-venue window
  - team is APPROVED and roster locked

Soft (high → low, philosophy-dependent):
  - gamesGuaranteed hit for each team
  - idealGamesPerDayPerTeam not exceeded
  - opponent diversity
  - targetGamesPerSession met for each team
  - philosophy: FAMILY_FRIENDLY clustering OR SPREAD_DAYS dispersion
  - back-to-back slot avoidance
  - no unreasonable gap between a team's games in one day (FAMILY_FRIENDLY only)
```

---

## Phase 7 — Schedule editing + reschedule assist

- Game list view becomes editable: change scheduledAt, venue/court, home/away teams, status.
- `PATCH /api/games/[id]` — checks no new double-book; requires season status ∈ {`FINALIZED`, `IN_PROGRESS`}.
- Soft lock: `Game.isLocked` defaults to `true` after commit; toggle per game to edit. No hard lock on `IN_PROGRESS`.
- **Cancel / default action** on a game:
  - Sets status `CANCELLED` or `DEFAULTED`, clears `scheduledAt` reassignment target
  - Opens "Reschedule assist" panel: runs a mini-solver over the *next 1–2 sessions* and returns open slots that would respect hard constraints + the team's existing commitments
  - Owner picks one → creates a new game (or updates the existing row's `scheduledAt` if postponed)
- Standings recalc triggers on any status transition to/from `COMPLETED` or `DEFAULTED`.

---

## Phase 8 — Standings

- `GET /api/seasons/[id]/standings` — derived view, per-division.
- Reads all `COMPLETED` + `DEFAULTED` games with `phase=REGULAR`.
- Applies tiebreakers from season config.
- No persistent table in v1 — fully computed on read. (Can denormalize later if slow.)

---

## Phase 9 — Out of scope for this plan (next phases)

- Playoffs generation (separate plan — driven by standings + playoff format).
- Public league pages + schedule/standings viewable by parents.
- Officials/scorekeeper assignment to games.
- Live scoring + game events (existing tables already there, just no UI).
- Per-team blackouts consumed by generator.
- Stripe payment flow.
- Schedule change notifications to club managers / parents.

---

## Suggested execution order

Each phase = 1 PR. Phases 0–1 are unblocking; 2–3 can parallel. Scheduler (6) is the biggest and riskiest — propose building it in two sub-PRs (slot inventory + pairing pool first with a test harness, then the solver).

1. **PR 1**: Phase 0 schema + migration + update all existing API handlers to new names.
2. **PR 2**: Phase 1 (League/Season CRUD split).
3. **PR 3**: Phase 2 (Courts + VenueHours).
4. **PR 4**: Phase 3 (Season manage UI redesign with tabs).
5. **PR 5**: Phase 4 + Phase 5 (registration tweaks + finalization preflight extensions).
6. **PR 6a**: Scheduler slot inventory + pairing generation + preview-only API (no writes).
7. **PR 6b**: Solver + commit API + wipe.
8. **PR 7**: Game edit UI + reschedule assist.
9. **PR 8**: Standings computation.
