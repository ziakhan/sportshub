# League Screens — Verbatim Inventory

Source root: `apps/web/src/app/(platform)/manage/leagues/`

---

## Create League — `/manage/leagues/create`
- Source files: `apps/web/src/app/(platform)/manage/leagues/create/page.tsx`
- Layout: A single centered card (`max-w-xl`) with a page title, one intro sentence, an error banner slot, then one white rounded card holding the form fields, then a two-button row (Cancel / Create League) below the card.
- Fields:
  - "League Name *" — text input, `required`, placeholder `"e.g. NPH Showcase League"`. Zod (`POST /api/leagues`): `name: z.string().min(3).max(200)`.
  - "Description" — textarea, `rows={3}`, placeholder `"About this league..."`. Zod: `description: z.string().optional()`.
- Buttons/actions:
  - "Cancel" — link, styled as a button, left of the primary button; navigates to `/manage/leagues`.
  - "Create League" (shows "Creating..." while submitting, `disabled` during submit) — primary button, `flex-1`; on submit POSTs to `/api/leagues`, then `router.push(`/manage/leagues/${data.id}`)` on success. On failure shows the error banner with the server's `error` message (or `"An error occurred"`).
- Table columns: none.
- Status/badge strings: none.
- Empty states: none (create form only).
- Copy verbatim:
  - Title: "Create League"
  - Subtitle: "A league is the persistent parent. You'll add seasons (Fall 2026, Winter 2026-27, etc.) on the next screen."
- Rules/behavior worth showing in a demo:
  - Creating a league auto-grants the creator a `LeagueOwner` `UserRole` scoped to that league (no season exists yet — seasons are a separate creation step).

---

## League Dashboard — `/manage/leagues/[id]`
- Source files: `apps/web/src/app/(platform)/manage/leagues/[id]/page.tsx` (imports `LeagueScoringSettings` from `apps/web/src/components/scoring/league-scoring-settings.tsx`, and shared UI kit `StatTile`, `AnimatedNumber`, `Button`, `PanelHeader`, `Badge` from `@/components/ui`)
- Layout: Back link ("&larr; Back to Leagues") → a hero card with a "League" eyebrow pill, the league `name` as an H1, optional `description`, and a right-aligned action row (Public hub / Customize page / Payments / Messages / New Season). Below: a 4-tile stat bar (Seasons/Teams/Games/Divisions, shown only if seasons exist). Then the "Live scoring settings" panel (`LeagueScoringSettings`). Then a conditionally-shown "Create a season" form panel. Then a "Seasons" section rendered as a responsive 2-column card grid (one card per active season). Then a collapsible "Past seasons (N)" list.
- Fields (Create a season form, shown when "New Season" is toggled open):
  - "Label *" — text input, `required`, placeholder `"e.g. Fall 2026, Winter 2026-27"`. Zod (`POST /api/leagues/[id]/seasons`): `label: z.string().min(1).max(100)`.
  - "Season Type" — select, options: "Fall / Winter" (`FALL_WINTER`, default), "Spring" (`SPRING`), "Summer" (`SUMMER`), "Custom" (`CUSTOM`). Zod: `type: z.enum([...]).default("FALL_WINTER")`.
  - "Start Date" — date input. Zod: `startDate: z.string().datetime().optional()`.
  - "End Date" — date input. Zod: `endDate: z.string().datetime().optional()`.
  - "Registration Deadline" — date input. Zod: `registrationDeadline: z.string().datetime().optional()`.
  - "Team Fee ($)" — number input, `min="0"`, `step="0.01"`, placeholder `"e.g. 3500"`. Zod: `teamFee: z.number().min(0).optional()`.
  - "Games Guaranteed" — number input, `min="1"`, placeholder `"e.g. 10"`. Zod: `gamesGuaranteed: z.number().min(1).optional()`.
  - Helper text under the fields: "You'll configure divisions, venues, sessions, and scheduling on the next screen."
  - (Not exposed as inputs but silently carried in the POST body when arriving via "Create Next Season" `?from=<seasonId>`: `targetGamesPerSession`, `gameSlotMinutes`, `gameLengthMinutes`, `gamePeriods` — copied from the prior season.)
- Buttons/actions:
  - "Public hub" — link/button in the hero action row, external `<a>` to `/manage/leagues/${leagueId}/public`.
  - "Customize page" — button, links to `/manage/leagues/${leagueId}/customize`.
  - "Payments" — button, links to `/manage/leagues/${leagueId}/payments`.
  - "Messages" — button, links to `/manage/leagues/${leagueId}/messages`.
  - "New Season" / "Cancel" (toggles label + icon) — button, toggles the create-season panel open/closed.
  - "Create Season" (shows "Creating..." while submitting) — submit button inside the create-season form; POSTs to `/api/leagues/${leagueId}/seasons`, then `router.push` to `/manage/leagues/${leagueId}/seasons/${data.id}/manage` on success.
  - "Clear" — small text button inside the "Prefilled from …" banner; resets the prefill state and navigates back to the bare `/manage/leagues/${leagueId}` URL.
  - "Create First Season" — button in the empty-seasons state; opens the create-season panel.
  - "Create Next Season" — button shown when all seasons are completed; links to `/manage/leagues/${leagueId}?from=${pastSeasons[0].id}` (prefill flow).
  - Season cards (in the "Seasons" grid) — each entire card is a `<Link>` to `/manage/leagues/${leagueId}/seasons/${season.id}/manage`.
  - "Show" / "Hide" — toggle button in the "Past seasons (N)" panel header, expands/collapses the list.
  - Per past-season row: "Manage" link → `/manage/leagues/${leagueId}/seasons/${season.id}/manage`; "Public page" link → `/league/${season.id}`.
- Table columns: none (card/grid layout, not tables).
- Status/badge strings (season status badges, from `STATUS_LABELS`):
  - `DRAFT` → "Draft" (tone: neutral)
  - `REGISTRATION` → "Open for Registration" (tone: court)
  - `REGISTRATION_CLOSED` → "Registration Closed" (tone: play)
  - `FINALIZED` → "Finalized" (tone: hoop)
  - `IN_PROGRESS` → "In Progress" (tone: play)
  - `COMPLETED` → "Completed" (tone: neutral)
  - Season type labels (`SEASON_TYPE_LABELS`): `FALL_WINTER` → "Fall / Winter", `SPRING` → "Spring", `SUMMER` → "Summer", `CUSTOM` → "Custom"
  - Past-season rows always show a `Badge tone="neutral"` reading "Completed".
- Empty states:
  - No seasons at all: "No seasons yet. Create your first season to start accepting team registrations." + "Create First Season" button.
  - Seasons exist but all are completed: "No active seasons — the last one is completed and archived below." (em dash rendered via `&mdash;`) + "Create Next Season" button.
  - League not found (load failure): "League not found."
  - Loading: "Loading..."
- Rules/behavior worth showing in a demo:
  - "Create Next Season" (`?from=<seasonId>`) prefills label (year auto-advanced, e.g. "Summer 2026" → "Summer 2027", "Winter 2026-27" → "Winter 2027-28"), season type, team fee, games guaranteed, and scheduling/game-format fields from the prior season — but never copies teams or divisions. Banner text: "Prefilled from **{label}** — fee and game format copied. Teams and divisions start fresh."
  - Stat tiles (Seasons / Teams / Games / Divisions) only render once at least one season exists.
  - Card counts per season (Divisions / Teams / Games) animate in via `AnimatedNumber`.

### Live scoring settings panel (embedded on the League Dashboard)
- Source file: `apps/web/src/components/scoring/league-scoring-settings.tsx`
- Layout: A white rounded card titled "Live scoring settings" with subtitle "What scorekeepers track at the table, and how game time runs." Three columns: Stats tracked (radio cards), Game clock (select), Periods (select + number input + checkbox). Save button bottom-right.
- Fields:
  - "Stats tracked" — radio group, options (label / hint):
    - "Score only" — "Score, fouls, subs — six buttons" (`SCORE_ONLY`)
    - "Standard" — "Adds missed shots, rebounds, assists" (`STANDARD`, default)
    - "Full" — "Adds steals, blocks, turnovers" (`FULL`)
  - "Game clock" — select: "Start/stop clock on the console" (`SIMPLE`, default), "No clock — periods only" (`OFF`). Helper: "With the clock on, minutes played per player are tracked automatically."
  - "Periods" — select "4 quarters" (`QUARTERS`, default) / "2 halves" (`HALVES`) plus a number input (`min={1}`, `max={30}`, default `10`) labeled implicitly "min".
  - "Require referee sign-off" — checkbox (default unchecked). Sub-copy: "The referee types their name at the table before a game can be finalized — like signing the paper scoresheet. The signature appears on the printed sheet."
- Buttons/actions:
  - "Save scoring settings" (shows "Saving…" while busy) — PATCHes `/api/leagues/${leagueId}` with `{ statDepth, gameClockMode, periodType, periodMinutes, requireRefereeApproval }`. On success shows green banner: "Scoring settings saved — applies to every game from the next console load." On failure shows red banner with server error or "Failed to save".

---

## Season Manage — `/manage/leagues/[id]/seasons/[seasonId]/manage`
- Source files: `apps/web/src/app/(platform)/manage/leagues/[id]/seasons/[seasonId]/manage/page.tsx` + 11 tab components under `.../manage/components/` (`overview-tab.tsx`, `divisions-tab.tsx`, `venues-tab.tsx`, `sessions-tab.tsx`, `scheduling-tab.tsx`, `tiebreakers-tab.tsx`, `teams-tab.tsx` (+ `roster-requests-panel.tsx`, and `@/components/withdrawal-requests-panel.tsx`), `referees-tab.tsx`, `schedule-tab.tsx`, `standings-tab.tsx`, `playoffs-tab.tsx`), shared `types.ts`.
- Layout: Back link ("&larr; Back to {league.name}") → header row with the season `label` (uppercase, condensed font) as H1, the league `name` as a subtitle, a status `Badge`, and a right-aligned lifecycle action button (only one shown at a time, the next forward status). Below that: a horizontal tab strip (`role="tablist"`) with 11 tabs, each rendering one panel component.
- Tabs (exact labels, in order): "Overview", "Divisions", "Venues", "Sessions", "Scheduling", "Tiebreakers", "Teams", "Referees", "Schedule", "Standings", "Playoffs".
- Lifecycle button labels (by target status, `STATUS_FLOW` = DRAFT → REGISTRATION → REGISTRATION_CLOSED → FINALIZED → IN_PROGRESS → COMPLETED):
  - → REGISTRATION: "Open Registration"
  - → REGISTRATION_CLOSED: "Close Registration"
  - → FINALIZED: "Finalize Season" (disabled unless `canFinalize` — all preflight checks pass)
  - → IN_PROGRESS: "Start Season"
  - → COMPLETED: "Mark Completed"
  - Status badge label uses the same `STATUS_LABELS` map as the League Dashboard ("Draft" / "Open for Registration" / "Registration Closed" / "Finalized" / "In Progress" / "Completed").
- Empty/loading states: "Loading..." while fetching; "League not found." if the season fetch fails.
- Rules/behavior worth showing in a demo:
  - Status changes PATCH `/api/seasons/${seasonId}` with `{ status: newStatus }`. A 422 response populates the preflight error list (`finalizeErrors`) and any `warnings`.
  - Season status is one-way: cannot move backward, and cannot jump across FINALIZED without passing through it (enforced server-side in `apps/web/src/app/api/seasons/[id]/route.ts`).
  - Finalize preflight checklist (only computed when the next status is FINALIZED) — exact labels:
    - "At least one division created"
    - "At least one game session scheduled"
    - "Every session has a day with venue + court"
    - "At least one venue assigned"
    - "No teams pending approval"
    - "Max games per season defined"
    - "Period / half length defined"
    - "Tiebreaker order configured"
  - Server-side finalize also checks (only surfaces via the 422 `missing`/`warnings` arrays, not the client checklist above): "Max games per team per season must be set in Scheduling Settings", "Period / half length (minutes) must be set in Scheduling Settings", "At least one division is required", "At least one game session is required", "At least one venue must be assigned", "`${pendingCount} team(s) are still pending — approve or reject all teams first`", `Session "{label}" needs at least one day with a venue and court`, "Tiebreaker order is empty — configure at least one rule in the Tiebreakers tab", `Division "{name}" is in a scheduling group but has {n} team(s) — needs at least 2`, "No approved teams — approve at least one team before finalizing". Warnings (non-blocking): `Division "{name}" has {n} team(s) — the scheduler will skip it (needs at least 2).` and a feasibility warning: `Feasibility: ~{requiredCourtMinutes} court-minutes needed for {requiredGameCount} games, but only {availableCourtMinutes} are configured. The scheduler may leave games unplaced.`
  - Finalizing locks every `SeasonRoster` (`isLocked: true`) and sets `tiebreakersLockedAt`.
  - Season completing (status → COMPLETED) triggers `sendSeasonReviewInvites`. Season opening (status → REGISTRATION) notifies every club that has previously submitted a team to another season of this league, both bell notification and email, headline: `${leagueName} — ${seasonLabel} is open for team registration`.

### Overview tab
- Source file: `.../manage/components/overview-tab.tsx`
- Layout: (if season is COMPLETED) a green-bordered "Season complete" close-out card at the top with 3 stat callouts (Teams/Games/Divisions) plus a "Ran" date range and 3 action buttons. Then (if a next status exists) the finalize preflight checklist panel. Then a 4-tile stat bar (Divisions/Teams/Sessions/Venues). Then a "Season summary" panel with a 2-column key/value grid.
- Fields: none (read-only tab).
- Buttons/actions (close-out card, only shown when `leagueStatus === "COMPLETED"`):
  - "Create next season" — links to `/manage/leagues/${leagueId}?from=${seasonId}`.
  - "Final standings" — clicks the "Standings" tab button programmatically (falls back to `/league/${seasonId}` if the tab button can't be found in the DOM).
  - "Public season page" — links to `/league/${seasonId}`.
- Status/badge strings:
  - Close-out card header badge: `Badge tone="court" dot` reading "Completed".
  - Preflight banner heading: "✓ Ready to finalize" (green) when all checks pass, else "Complete these before finalizing" (amber). Each check row shows "✓" or "✗".
  - "Could not finalize:" heading (red) above `finalizeErrors` list items, each prefixed "• ".
  - "Warnings:" heading (amber) above `finalizeWarnings` list items, each prefixed "• ".
- Copy verbatim:
  - Close-out card title: "Season complete"
  - Body: "**{label}** has wrapped up. Results and standings are locked in and stay browsable — when you're ready, start the next season with this one's setup carried over."
  - Stat labels: "Teams", "Games", "Divisions", "Ran" (date range shown as "MMM d – MMM d, yyyy").
  - "Season summary" panel rows (each only rendered if the value exists): "Start:", "End:", "Registration Deadline:", "Team Fee:" (formatted currency), "Games Guaranteed:", "Playoffs:" (shows `playoffFormat` with underscores replaced by spaces, e.g. "SINGLE ELIMINATION").
  - Stat-bar tile labels: "Divisions", "Teams", "Sessions", "Venues".

### Divisions tab
- Source file: `.../manage/components/divisions-tab.tsx`
- Layout: One panel "Divisions". Lock banner (amber) shown when season status is FINALIZED/IN_PROGRESS/COMPLETED. Existing divisions listed as rows (name, age group, gender, capacity, team count, rename/remove icons). Below the list (only when unlocked): an inline add-division form (name, age group select, gender select, tier select, max teams input, "Add Division" button).
- Fields (add form):
  - "Division name" — text input, placeholder `"Division name"`. Zod (`POST /api/seasons/[id]/divisions`): `name: z.string().min(1).max(100)`.
  - "Age group..." — select, placeholder option `"Age group..."`, options: "U10", "U12", "U14", "U16", "U18", "U19", "Junior", "Senior". Zod: `ageGroup: z.string().min(1)`.
  - Gender select — options: "Boys" (`MALE`, default selected), "Girls" (`FEMALE`), "Co-ed" (empty value). Zod: `gender: z.enum(["MALE","FEMALE","COED"]).optional()`.
  - Tier select — options: "Tier 1 (Top)" (value `1`, default), "Tier 2" (`2`), "Tier 3" (`3`). Zod: `tier: z.number().min(1).default(1)`.
  - "Max teams (optional)" — number input, `min="1"`, `max="128"`. Zod: `maxTeams: z.number().int().min(1).max(128).optional()`.
  - Inline edit mode: "Division name" text input (rename always allowed) + "Max teams (blank = unlimited)" number input `min="1" max="128"` (only editable when season is unlocked). If locked, shows: "Season is locked — only the name can be changed."
- Buttons/actions:
  - "Add Division" — full-width button at bottom of the add form; POSTs then clears the form and refreshes.
  - Rename (pencil icon, `aria-label="Rename {name}"`) — opens inline edit; "Save" / "Cancel" buttons while editing.
  - "Remove" (red text, hidden when locked) — confirms with: `Delete division "{name}"? {n} team(s) are/is assigned to it — this cannot be undone.` (or, if zero teams: `Delete division "{name}"? This cannot be undone.`), then DELETEs.
- Table columns: none (row list, not a `<table>`).
- Status/badge strings: none (plain text "{n} teams", capacity shown as "Capacity: {used}/{maxTeams}" or "Capacity: unlimited").
- Empty states: none explicit (an empty division list just renders no rows).
- Copy verbatim:
  - Lock banner: `Season is {in progress|<status lowercased>} — divisions are locked. Structural changes need the season reopened.`
- Rules/behavior worth showing in a demo:
  - Renaming a division is always allowed, even when the season is locked; changing age group/gender/tier/capacity is blocked once locked (`isSeasonLocked` = FINALIZED/IN_PROGRESS/COMPLETED).
  - Removing a division that has teams assigned warns with the team count before deleting.

### Venues tab
- Source file: `.../manage/components/venues-tab.tsx` (imports `VenueSelector`, `VenueEditor` from `@/components/venue-selector` / `@/components/venue-editor`)
- Layout: One panel "Venues" listing each assigned venue (name, address/city, court count) with "Edit courts & hours" / "Close" toggle and "Remove" link; expanding a venue reveals an inline `VenueEditor`. Below the list: a `VenueSelector` search/picker plus a conditional "Add to League" button.
- Fields: Venue picker (`VenueSelector` component — not read in depth here beyond its use); no other raw inputs on this tab (courts/hours are edited inside the `VenueEditor` sub-component).
- Buttons/actions:
  - "Edit courts & hours" / "Close" — toggles the inline `VenueEditor` panel for that venue.
  - "Remove" (red text) — DELETEs `/api/seasons/${seasonId}/venues?leagueVenueId=${v.id}`.
  - "Add to League" — only shown once a venue is selected in the picker; POSTs `{ venueId }` to `/api/seasons/${seasonId}/venues`.
- Table columns: none (row list).
- Status/badge strings: court count text — `"{n} court(s)"` or `"No courts defined"`.
- Empty states: none explicit for zero venues (list just renders empty above the picker).
- Rules/behavior worth showing in a demo:
  - Any failed mutation (add/remove) surfaces via `window.alert` with the server's error message or `"The change couldn't be saved"` (all mutating fetches route through a `checkedFetch` helper — added after a prior bug where failed 403/500s looked like silent success).

### Sessions tab
- Source file: `.../manage/components/sessions-tab.tsx`
- Layout: One panel "Sessions (game days)". Lock banner (amber) when season is finalized/in-progress/completed. Existing sessions listed (label, venue name if any, "Remove" link, then each game day as "{Weekday, Mon d} {start}-{end}"). Below (only when unlocked): add-session form — label input, repeatable day rows (date + start time + end time + remove-day "x"), "+ Add another day" link, optional venue-hours hint, "Add Session" button.
- Fields:
  - Label input — placeholder `"Label (e.g. Week 1)"`. Zod (`POST /api/seasons/[id]/sessions`): `label: z.string().optional()`.
  - Per day row: date input, start-time input (`type="time"`, default `09:00`), end-time input (default `17:00`). Zod: `days: z.array({ date: z.string(), startTime: z.string().min(3), endTime: z.string().min(3) }).min(1)`.
  - Picking a date auto-fills the start/end time from the first assigned venue's stored hours for that weekday (if configured); the hint text reads: `Times default to {venueName}'s hours for the chosen weekday — edit as needed.`
- Buttons/actions:
  - "+ Add another day" — appends another day row to the form.
  - "x" (remove-day) — removes a day row (only shown once there's more than one row).
  - "Add Session" — full-width button; POSTs the valid (dated) rows, then clears the form and refreshes.
  - "Remove" (red text, per session, hidden when locked) — confirms with `Remove session "{label}"? Its game days and venue slots go with it. This cannot be undone.`, then DELETEs.
- Table columns: none.
- Status/badge strings: none.
- Empty states: none explicit.
- Copy verbatim:
  - Lock banner: `Season is {in progress|<status lowercased>} — sessions are locked while games are being played.`
- Rules/behavior worth showing in a demo:
  - Sessions/game-days lock the same way divisions do (FINALIZED/IN_PROGRESS/COMPLETED blocks add/remove).

### Scheduling tab
- Source file: `.../manage/components/scheduling-tab.tsx`
- Layout: Three stacked panels: "Scheduling approach" (philosophy radios + cross-division checkbox), "Scheduling groups" (list + add form), "Scheduling Settings" (grid of numeric/select fields with a "Save Settings" button in the panel header, plus a "Playoffs (optional...)" sub-section at the bottom).
- Fields (Scheduling approach panel):
  - "Philosophy" — radio cards: "Family-friendly" — "Pack each team's games into fewer days so families spend less time at venues." (key `FAMILY_FRIENDLY`); "Spread days" — "Distribute each team's games across more session days for more player rest." (key `SPREAD_DAYS`). Saved immediately on click via `patchSeason({ schedulingPhilosophy })`.
  - "Allow cross-division scheduling" — checkbox. Sub-copy: "When enabled, the scheduler may place games between teams in different divisions (within a scheduling group) to fill the slate." Saved immediately via `patchSeason({ allowCrossDivisionScheduling })`.
  - (Scheduling groups panel) "Group name (e.g. U10 + U12 boys)" — text input; a checkbox grid of divisions (label shows `{name} ({ageGroup}·{gender})`); intro copy: "Group divisions that can share a slate (e.g. nearby age groups). Games still follow division rules unless cross-division scheduling is on."
  - (Scheduling Settings panel, all under helper text: "Fields marked <span class=hoop>*</span> are required before the league can be finalized"):
    - "Max games per team per season *" — number input, `min="1"`, placeholder `"e.g. 10"`.
    - "Games per session per team" — number input, `min="1" max="10"`, default "1".
    - "Ideal games per day per team" — number input, `min="1" max="5"`, default "1". Helper: "Scheduler only exceeds this if unavoidable"
    - "Game format" — select: "2 Halves" (`HALVES`, default), "4 Quarters" (`QUARTERS`).
    - "Half / quarter length (min) *" — number input, `min="5" max="30"`, placeholder `"e.g. 20 for halves, 10 for quarters"`.
    - "Game length (min)" — number input, `min="20" max="60"`, default "40".
    - "Game slot length (min)" — number input, `min="30" max="180"`, default "90". Helper: "Includes warmup + transition buffer"
    - "Default courts per venue *" — number input, `min="1" max="20"`, placeholder `"e.g. 2"`. Helper: "Can be overridden per venue in the Venues panel"
    - "Default venue hours" — two time inputs (default `09:00`–`20:00`). Helper: "Session-day times override these defaults"
    - Playoffs sub-section (heading: "Playoffs (optional — can be set later)"):
      - "Playoff format" — select: "None / TBD" (empty value), "Single Elimination" (`SINGLE_ELIMINATION`), "Double Elimination" (`DOUBLE_ELIMINATION`), "Round Robin" (`ROUND_ROBIN`). Saved on change via PATCH `{ playoffFormat }`.
      - "Teams advancing to playoffs" — number input, `min="2" max="64"`, placeholder `"e.g. 8"`, saved `onBlur` via PATCH `{ playoffTeams }`.
      - NOTE: These two fields exist in the Scheduling tab's "Scheduling Settings" panel, but the actual bracket-generation UI is the separate **Playoffs tab**, which uses a newer guided wizard with a different, richer format set (see Playoffs tab below) — this pair of fields appears to be legacy/parallel config that isn't read by the wizard.
- Buttons/actions:
  - "Add scheduling group" — button, disabled until a name is entered; POSTs `{ name, divisionIds }` to `/api/seasons/${seasonId}/scheduling-groups`.
  - "Edit" / "Remove" — per scheduling group; edit reveals inline name input + division checkboxes with "Save"/"Cancel"; Remove confirms "Remove this scheduling group?" then DELETEs.
  - "Save Settings" (shows "Saving…" while busy) — panel-header button; PATCHes `/api/seasons/${seasonId}` with the full settings object (gamesGuaranteed, targetGamesPerSession, gameLengthMinutes, gameSlotMinutes, gamePeriods, periodLengthMinutes, idealGamesPerDayPerTeam, defaultVenueOpenTime, defaultVenueCloseTime).
- Table columns: none.
- Status/badge strings: none.
- Empty states: "No groups yet. Create one below." (scheduling groups list); group with no divisions shows "No divisions" as its subtitle.
- Rules/behavior worth showing in a demo:
  - All mutations route through the same `checkedFetch` pattern — failures alert with the server error or "The change couldn't be saved".
  - "Max games per team per season", "Half / quarter length (min)", and "Default courts per venue" are flagged with a red asterisk as required for finalization (matches the Overview tab's preflight checklist items "Max games per season defined" and "Period / half length defined").

### Tiebreakers tab
- Source file: `.../manage/components/tiebreakers-tab.tsx`
- Layout: One panel "Tiebreaker order" with an optional "Locked {date}" badge in the header. An ordered list of configured tiebreakers (rank number, label, up/down/remove controls) or empty-state text. Below: an "Add a tiebreaker" row of pill buttons for unused options.
- Fields/options (`TIEBREAKER_OPTIONS`, key → label): `HEAD_TO_HEAD` → "Head-to-head record"; `POINT_DIFFERENTIAL` → "Point differential"; `POINTS_SCORED` → "Points scored"; `POINTS_ALLOWED` → "Points allowed (fewest)"; `WINS` → "Total wins"; `COIN_FLIP` → "Coin flip (last resort)".
- Buttons/actions:
  - "↑" / "↓" — reorder a tiebreaker (disabled at the ends of the list, and disabled entirely once locked).
  - "Remove" — removes a tiebreaker from the order (disabled once locked).
  - "+ {label}" pill buttons — adds that tiebreaker to the end of the order (disabled once locked).
  - All changes save immediately via `patchSeason({ tiebreakerOrder })` (no separate Save button).
- Status/badge strings: `Badge tone={toneForStatus("LOCKED")}` with a lock icon reading `Locked {format(tiebreakersLockedAt, "MMM d, yyyy")}` once the season has finalized.
- Empty states: "No tiebreakers configured."
- Copy verbatim: "Used to rank teams with identical records. Applied top-to-bottom until one team wins the tiebreaker."
- Rules/behavior worth showing in a demo:
  - Tiebreaker order locks permanently at Finalize (`tiebreakersLockedAt`); the API rejects any PATCH to `tiebreakerOrder` after that with 409 "Tiebreakers are locked for this season and cannot be edited."

### Teams tab
- Source file: `.../manage/components/teams-tab.tsx` (embeds `RosterRequestsPanel` from `roster-requests-panel.tsx` and `WithdrawalRequestsPanel` from `@/components/withdrawal-requests-panel.tsx`)
- Layout: Three stacked panels: `WithdrawalRequestsPanel` (renders nothing if empty), "Roster changes" panel (policy controls + override editor + pending roster-change queue), "Registered teams" panel (status/payment filter pills in the header, then one row per team with status + payment badges and inline action buttons).
- Fields (Roster changes panel — policy):
  - "After rosters lock" — select: "Changes need my approval" (`REQUEST_ONLY`, default), "Clubs edit freely until a deadline" (`OPEN_UNTIL_DEADLINE`), "No changes at all" (`CLOSED`).
  - "Change deadline" — date input, only shown when policy = `OPEN_UNTIL_DEADLINE`.
  - Commissioner roster override (collapsible, link text: "Override a team's roster (audited)" / "Hide roster override"): team select ("Choose team…"), then a checkbox grid of that team's players (shows `#{jerseyNumber} {name}` when a jersey number exists), and a "Save override ({n} players)" button.
- Buttons/actions:
  - "Save policy" (shows "Saving…") — PATCHes `/api/seasons/${seasonId}` with `{ rosterChangePolicy, rosterChangeDeadline }`. Success message: "Roster policy saved."
  - Roster-request queue rows: text input "Note back to the club (optional)", "Approve" and "Deny" buttons. Approve confirms with `Approve this roster change? The listed adds/removes are applied to the locked roster immediately.` (when the request has structured additions/removals) or `Approve this roster change? The team's roster unlocks until the club saves its changes, then locks again.` (freeform request). Success messages: "Approved — changes applied to the roster." / "Approved — roster unlocked for one change." / "Denied."
  - Team filter pills (status): "All ({n})", "Pending ({n})", "Approved ({n})", "Rejected ({n})".
  - Team filter pills (payment): "Any payment", "Unpaid ({n})", "Paid ({n})".
  - Per-team row buttons (conditional on status/payment): "Approve" (→ APPROVED), "Reject" (→ REJECTED) — shown only when `status === "PENDING"`; "Withdraw" — shown when status is PENDING or APPROVED, confirms `Withdraws the team from the season — future games are cancelled and opponents notified.`, then sets status WITHDRAWN; "Mark paid" / "Waive" — shown when unpaid; "Mark unpaid" — shown when paid.
  - "Save override ({n} players)" (shows "Saving…") — commits the commissioner roster override; success message: `Roster overridden ({n} players) — the club has been notified.`
- Table columns: none (row list per team, not a literal `<table>`).
- Status/badge strings:
  - Team status badge: lowercased status text via `toneForStatus`, e.g. "pending", "approved", "rejected", "withdrawn".
  - Payment badge text (`paymentLabel` map): `UNPAID` → "unpaid", `PAID_MANUAL` → "paid", `PAID_STRIPE` → "paid (stripe)", `WAIVED` → "waived" (badge tone: green if paid, amber/"warning" if not).
  - Pending roster-request count badge in the panel header: `{n} pending`.
- Empty states:
  - "No teams registered yet." (zero teams at all)
  - "No teams match the selected status." (filters exclude everything)
  - "No pending roster-change requests."
  - Override editor: "This team has no roster in this season." (team chosen has no submission)
- Rules/behavior worth showing in a demo:
  - The commissioner roster override bypasses lock + policy entirely, is always audited (`LEAGUE_ROSTER_EDIT`), and notifies the club.
  - Roster-change policy has three modes with materially different club-side behavior: approval-gated, open-until-deadline, or fully closed.

### Referees tab
- Source file: `.../manage/components/referees-tab.tsx`
- Layout: Three stacked panels: "Book a referee for a session day" (day/shift picker, shift presets, target select, message input, send button), "Offers" (list of sent offers with status badges), "League referee pool" (current pool list + search-and-add).
- Fields (Book a day panel):
  - "Session day" — select, placeholder "Choose day…", options built from every session's game days, labeled `{sessionLabel} — {EEE, MMM d}`.
  - "Shift" — two time inputs (start/end), default `09:00`–`18:00`; shift-preset pills: "Full day (9–6)", "Morning 6h (9–3)", "Afternoon (12–6)".
  - "Send to" — select: "📢 All league referees (first accept wins)" (broadcast, empty value) or individual pool referees, labeled `{name}` (+ ` — {availability label}` once a day is chosen).
  - Message text input — placeholder "Message (optional)".
  - (Grow-pool search) "Search referees on the platform…" — search input, triggers lookup once 2+ characters typed.
- Buttons/actions:
  - "Send offer" (shows "Sending…", disabled until a day is chosen) — POSTs `/api/leagues/${leagueId}/referee-requests`. Success note: `Offer sent — the referee has been notified.` (targeted) or `Offer broadcast to ${n} referees — first to accept gets the day.` (broadcast). Failure note: the server error or "Couldn't send the offer".
  - "Cancel" — per pending offer; confirms "Cancel this offer?", then PATCHes the request with `{ action: "cancel" }`.
  - "Add" — per search result row; POSTs `{ userId }` to add that referee to the pool.
  - "Remove" — per pool referee; confirms `Remove {name} from your referee pool?`, then DELETEs.
- Table columns: none (row lists).
- Status/badge strings:
  - Availability badges (`AVAILABILITY_BADGE`): "available" (court tone), "other hours" (hoop tone), "no availability set" (neutral tone) — shown per pool referee once a day is selected.
  - Offer status badge (`toneForStatus`): shows `"accepted — {acceptedBy}"` when accepted, else the lowercased status (e.g. "pending", "declined", "cancelled").
  - Pool referee subtitle: `{certification ?? "Uncertified"} · {gamesRefereed} games` (+ `· no sign-off PIN` if the referee lacks one).
- Empty states:
  - "No offers sent yet."
  - "No referees in your pool yet — add some below."
- Copy verbatim: "Pick a day and shift, then target a referee you know — or broadcast to your whole pool and let the first taker have it. Accepting auto-assigns them to every game in the window."
- Rules/behavior worth showing in a demo:
  - Accepting an offer auto-assigns that referee to every game in the chosen window (Uber-style, first-accept-wins for broadcasts).

### Schedule tab
- Source file: `.../manage/components/schedule-tab.tsx`
- Layout: One large panel "Schedule" with header actions (Preview schedule / Commit schedule / Delete all). Below: a "Capacity planner" sub-panel (per-session cards with a checkbox per division/unit and a slots-needed-vs-available readout), then (once run) a "Preview" results card with a table of proposed games and any unscheduled pairings, then a "Add a game manually (make-up / fix)" collapsible, then the "Committed games" list (collapsible rows per game with inline actions).
- Buttons/actions (panel header):
  - "Preview schedule" (shows "Running…") — POSTs `/api/seasons/${seasonId}/schedule/preview` with `{ sessionUnits }`.
  - "Commit schedule" (shows "Committing…", disabled unless season status is FINALIZED or IN_PROGRESS, tooltip when disabled: "Finalize the season before committing") — confirms `Commit this schedule? Existing SCHEDULED games will be replaced.`, then POSTs `/api/seasons/${seasonId}/schedule/commit` with `{ replaceExisting: true, sessionUnits }`.
  - "Delete all" (only shown if games exist) — confirms `Delete all scheduled games? (games that have moved past SCHEDULED are kept)`, then DELETEs `/api/seasons/${seasonId}/schedule`.
- Capacity planner:
  - Per-session summary line: `{label} · {days} day(s) · {courts} court(s) · {gamesPerTeam} game(s)/team`; right side: `{includedDemand} of {slotsTotal} slots needed · {spare} spare` or `{-spare} short` (colored green/amber/red by how tight capacity is).
  - Per-unit checkbox pill: `{unitLabel} · {teams} teams · {gamesNeeded} games` — unchecking excludes that division/unit from the preview & commit plan for that session.
  - Footer line per session: `This session can carry up to {maxTeamsSupportable} teams at {gamesPerTeam} game(s) each.`
  - Intro copy: "What each session can hold vs what your divisions need. Untick a division to leave it out of a session — the preview and commit follow this plan."
- Preview results:
  - Header: `Preview: {n} game(s)` (+ ` · {n} unscheduled` if any pairings couldn't be placed).
  - Warnings list (amber, prefixed "• ").
  - "Slots used: {slotsUsed} / {slotsAvailable}".
  - Table columns: "When", "Home", "Away" (rows show `EEE MMM d · h:mm a` formatted time).
  - Collapsible "{n} pairing(s) couldn't be placed" — lists `{home} vs {away}{ — reason if present}`.
- Manual game add (collapsible, toggle text "+ Add a game manually (make-up / fix)" / "Hide manual game"):
  - "Home team…" select (approved teams only).
  - "Away team…" select (approved teams, excluding the chosen home team).
  - Datetime-local input (no label text, placeholder is the native picker).
  - "Add game" button (shows "Adding…", disabled until home/away/when all set) — POSTs `/api/seasons/${seasonId}/games`. Success note: "Game added."
- Committed games list:
  - Header: "Committed games" with a count badge.
  - Each collapsed row: date/time, `{homeTeam} vs {awayTeam}`, venue/court, a lock icon (🔒) if `isLocked`, and a status badge.
  - Expanded row actions: "Box score ↗" (opens `/live/{gameId}` in a new tab); "Correct result" (only when status is COMPLETED, links to `/games/{gameId}/score`, title tooltip "Reopen the console to correct the finalized result"); "Lock"/"Unlock" toggle; "Find alternates"/"Hide alternates" toggle (loads reschedule suggestions); "Forfeit: home" (confirms `Record a FORFEIT by the home team? The away team is awarded the win in standings.`); "Forfeit: away" (confirms `Record a FORFEIT by the away team? The home team is awarded the win in standings.`); "Cancel game" (disabled once CANCELLED or COMPLETED; confirms `Cancel this game? It will be excluded from standings.`).
  - Alternate-slots panel: heading "Suggested alternate slots"; each suggestion row shows formatted date/time (+ a "same day" pill when applicable) and a "Move here" button.
- Status/badge strings: game status badge shows the raw status string (e.g. "SCHEDULED", "COMPLETED", "CANCELLED", "DEFAULTED") via `toneForStatus`.
- Empty states:
  - "No games committed yet. Preview then commit once the season is finalized." (committed games list)
  - "No viable alternate slots found." (alternates panel)
  - "Searching…" while alternates load.
- Copy verbatim (panel intro): "Preview the scheduler's proposal, then commit to persist games. Season must be finalized before you can commit."
- Rules/behavior worth showing in a demo:
  - Commit is disabled until the season is FINALIZED (or IN_PROGRESS); Preview has no such gate.
  - Capacity planner lets the operator deliberately leave a division/unit out of a specific session before generating.
  - Manual game add is an escape hatch outside the generator (make-ups/fixes), open to any approved-team pairing regardless of scheduler state.

### Standings tab
- Source file: `.../manage/components/standings-tab.tsx`
- Layout: One panel "Standings" with a "Refresh" button in the header, an intro line, then one sub-block per division: a condensed uppercase division-name heading and a data table.
- Table columns (exact header order): "#", "Team", "GP", "W", "L", "T", "PF", "PA", "Diff", "Win%", "Tiebreakers".
- Buttons/actions: "Refresh" (shows "Loading…" while busy, disabled during load) — re-fetches `/api/seasons/${seasonId}/standings`.
- Copy verbatim: "Computed on read from completed games. Ties are broken in the order configured in the Tiebreakers tab."
- Empty states:
  - "Loading…" (first load)
  - "No standings yet. Standings become meaningful once games are completed." (no divisions/rows)
  - Per-division: "No teams in this division." (division has zero rows)
- Rules/behavior worth showing in a demo:
  - Standings are computed on read (not stored), ties broken per the Tiebreakers tab's saved order; each row's "Tiebreakers" column lists which rules were actually applied for that team (or "—" if none).
  - Team name in each row links to `/team/{teamId}`.

### Playoffs tab
- Source file: `.../manage/components/playoffs-tab.tsx`
- Layout: Zero or more "existing bracket" panels (one per generated playoff session, grouped by round with each game as a card), followed by a "Generate playoffs" wizard panel.
- Fields (wizard):
  - "Division" — select, placeholder "Select…", options are season divisions; a division that already has a bracket is shown disabled with suffix " (bracket exists)".
  - "Teams qualifying" — number input, `min={2} max={64}`, placeholder "e.g. 4".
  - "First round date" — date input.
  - Format options (`options`, returned dynamically per division/qualifying-count from `playoffOptionsFor`) — rendered as selectable cards showing `{label}`, an optional "Recommended" badge, a description line, and `{games} games · {rounds} round(s)`. Possible format keys from the API zod enum: `SINGLE_ELIM`, `SINGLE_ELIM_THIRD`, `PLAY_IN_ELIM`, `ROUND_ROBIN`, `POOLS_CROSSOVER`, `ELIM_CONSOLATION` (exact labels/descriptions are server-computed, not hardcoded in this component).
  - Seed preview list (once division + qualifying count chosen): heading "Seeds (current standings)", each row `#{seed} {name} {record}`.
- Buttons/actions:
  - Format cards — clickable, `aria-pressed` toggles selection.
  - "Generate bracket" (shows "Generating…", disabled until division + format + start date are all set) — POSTs `/api/seasons/${seasonId}/playoffs`.
  - "Delete bracket" (only shown when no games in that bracket have been played yet) — confirms "Delete this bracket and its unplayed games?", then DELETEs.
  - Each game card in an existing bracket links to `/live/{gameId}` (shows home/away team names, scores, a round/slot label, a status badge, and formatted date/time).
- Status/badge strings: "Recommended" badge on the suggested format card; game status badge via `toneForStatus` (e.g. "SCHEDULED", "COMPLETED").
- Empty states:
  - "Playoffs can be generated once the season is in progress." (shown instead of the wizard when season status isn't IN_PROGRESS/COMPLETED)
  - "No formats fit that number — try a different qualifying count." (zero valid formats for the chosen division/qualifying count)
- Copy verbatim:
  - Bracket panel subtitle: `{qualifying} teams · single games · later rounds appear automatically as results are finalized.{notes if present}`
  - Wizard intro: "Pick a division and how many teams qualify — you'll only be offered formats that work for that number. Seeds come from the current standings."
- Rules/behavior worth showing in a demo:
  - Guided flow: pick division + qualifying-team count first; only the formats that mathematically fit that count are then offered (with a recommended pick highlighted and game/round totals shown up front).
  - Playoffs can only be generated once the season is IN_PROGRESS or COMPLETED — not before.
  - Later rounds populate automatically as results come in (no manual advancement step).

---

## League Payments — `/manage/leagues/[id]/payments`
- Source files: `apps/web/src/app/(platform)/manage/leagues/[id]/payments/page.tsx` (server component), `apps/web/src/components/payments/obligations-table.tsx`, `apps/web/src/components/payments/payment-settings-card.tsx`, `apps/web/src/components/payments/types.ts`
- Layout: Back link ("&larr; {league.name}") → H1 "Team fees & payments" → a 3-tile stat row (Collected / Outstanding / Waived) → the obligations table (with filter pills, expandable rows, and per-row actions) → (conditionally) a blue "connect Stripe" hint banner → the "Payment settings" card.
- Fields: none directly on the page (all interaction is in the embedded `ObligationsTable` and `PaymentSettingsCard`).
- Tiles (exact labels): "Collected" (court-green tone, formatted currency), "Outstanding" (hoop-red tone), "Waived" (ink/neutral tone).
- Table columns (`ObligationsTable`, `view="merchant"`): "From", "For", "Amount" (right-aligned), "Paid" (right-aligned), "Status", plus a trailing unlabeled actions column.
- Filter pills (exact labels): "All", "Open", plus one pill per remaining status present, using `OBLIGATION_STATUS_STYLE` labels — "Paid", "Waived", "Cancelled" (also "Partially paid", "Refunded" defined in the style map though not in the page's fixed filter list, which is `["ALL", "OPEN", "PAID", "WAIVED", "CANCELLED"]`).
- Status badge labels (`OBLIGATION_STATUS_STYLE`): `PENDING` → "Owed", `PARTIALLY_PAID` → "Partially paid", `PAID` → "Paid", `WAIVED` → "Waived", `CANCELLED` → "Cancelled", `REFUNDED` → "Refunded".
- Reference-type tag labels (`TYPE_LABEL`): `TryoutSignup` → "Tryout fee", `Offer` → "Season fee", `CampSignup` → "Camp", `HouseLeagueSignup` → "House league", `TeamSubmission` → "Team fee".
- Payment method labels (`METHOD_LABEL`): `STRIPE` → "Card (online)", `CASH` → "Cash", `ETRANSFER` → "e-Transfer", `CHEQUE` → "Cheque", `OTHER` → "Other".
- Buttons/actions:
  - "Record payment" (merchant view, open obligations only) — opens the "Record a payment" modal.
  - "Waive" — confirms `Waive the remaining balance on "{description}"?`, then PATCHes `/api/obligations/${id}` with `{ action: "waive" }`.
  - "Refund" (per succeeded, non-refunded payment inside an expanded row) — confirms `Refund {amount}?`, then PATCHes `/api/payments/${paymentId}` with `{ action: "refund" }`.
  - Record-payment modal fields: "Amount received" (number, `min="0.01" step="0.01"`, prefilled to the remaining balance), "Method" select ("Cash" `CASH` default, "e-Transfer" `ETRANSFER`, "Cheque" `CHEQUE`, "Other" `OTHER`), "Note (optional)" text input placeholder `"e.g. paid at the door"`. Buttons: "Cancel" and "Record payment" (shows "Saving…", disabled until amount > 0). Modal title: "Record a payment"; subtitle: `{description} — {remaining} remaining`.
- Empty states: "No payments here yet." (zero obligations at all); expanded row with no payments: "No payments recorded yet." (merchant view has no extra copy; payer view would append offline-method instructions, not applicable here since this page is merchant-only).
- Copy verbatim (Stripe connect hint banner, shown only when `!payConfig.stripeAccountId`): "Connect Stripe below to collect team fees online — recording offline payments (e-transfer, cash, cheque) works today."

### Payment settings card (embedded)
- Layout: "Payment settings" heading, two columns — "Offline payments" and "Online payments" — then a "Save settings" button bottom-right.
- Fields:
  - "Accept offline payments" — checkbox (only shown if `offlineAllowed`); sub-checkboxes for methods: "Cash (pay at the door)", "e-Transfer", "Cheque" (disabled unless the parent checkbox is on).
  - Online mode — select, options conditionally shown: "Off — offline only" (`NONE`, only if offline is allowed), "Your own Stripe account" (`CONNECT_DIRECT`, if `connectAllowed`), "Through the platform — your share transfers to you instantly" (`PLATFORM_COLLECT`, if `platformCollectAllowed`).
- Buttons/actions:
  - "Save settings" (shows "Saving…") — PATCHes `${apiBase}/payment-config` (here, `/api/leagues/${id}/payment-config`) with `{ offlineEnabled, offlineMethods, onlineMode }`. Success message: "Settings saved". Failure: server error or "Failed to save settings".
  - "Connect with Stripe" / "Finish Stripe setup" (shows "Opening Stripe…") — POSTs `${apiBase}/payment-config/connect`, then redirects the browser to the returned Stripe URL.
- Status copy (online payments column, conditional):
  - If Stripe active: `✓ Stripe account connected — {payments go straight to your bank. | your share of each payment transfers to your bank automatically.}` (text depends on mode).
  - If Stripe started but incomplete: "Stripe setup started but not finished — payments can't be accepted yet." + "Finish Stripe setup" button.
  - If not started: `{Connect your Stripe account so card payments land directly in your bank.|Set up your Stripe account so the platform can transfer your share of each payment to your bank.}` + "Connect with Stripe" button.
  - If offline is disallowed by platform: "Offline payments are turned off by the platform — all payments to your club are made online."
  - If no online mode allowed at all: "Online payments are not enabled for your club. Contact the platform to turn them on."
  - If exactly one online mode is forced (`onlyMode` set) and offline isn't allowed: "This is the payment mode set by the platform for your club."
- Rules/behavior worth showing in a demo:
  - Payment settings availability (offline allowed, which online modes are allowed) is platform-controlled per league, not fully self-serve — the UI adapts copy/options rather than showing dead controls.
