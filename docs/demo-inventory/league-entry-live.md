# League Entry & Live Ops — Verbatim Inventory

Covers: a club browsing/registering into a league season, the referee's shift-offer inbox, the printable official scoresheet, the personal cross-team calendar, the notifications inbox, and the exact notification/email templates fired when a league commits its schedule.

---

## Browse Leagues (list) — `/browse-leagues`
- Source files: `apps/web/src/app/(platform)/browse-leagues/page.tsx` (no further client-component imports; `formatCurrency` from `@/lib/countries` is a pure formatter, not a component)
- Layout: Page header ("Browse Leagues" + subtitle), an optional one-line "hidden leagues" notice, then either an empty-state card or a responsive 2-column grid of league/season cards. Each card is an entire `<Link>` to the season detail page, deep-linking the preselected team (`?team=`) through from the caller.
- Fields: none (browse/read-only page, no form inputs).
- Buttons/actions:
  - Each card is a full-card `<Link href={`/browse-leagues/${season.id}${teamParam ? `?team=${teamParam}` : ""}`}>` — click navigates to the season detail/registration page.
- Table columns: none (card grid, not a table).
- Status/badge strings:
  - "Open" — pill (`bg-court-100 text-court-700`), shown only when `season.status === "REGISTRATION"` and the deadline hasn't passed.
- Card body copy (computed):
  - Title: `{league.name}`, subtitle: `{season.label}`
  - Fee: `${formatCurrency(season.teamFee, league.currency)}/team` (only if `teamFee` set)
  - `${season.gamesGuaranteed} games` (only if set)
  - `${season._count.teamSubmissions} teams registered` (always shown)
  - Deadline: `Deadline: ${format(new Date(season.registrationDeadline), "MMM d")}` — rendered in red (`text-red-500`) if the deadline has passed.
- Empty states:
  - No open seasons at all: heading "No leagues open for registration" + body "Check back soon for upcoming league seasons."
  - Loading: "Loading leagues..." (also the `<Suspense>` fallback).
- Hidden-leagues notice (only rendered when arriving with a `?team=` param and that team already has season links):
  - Exact template: `` `${hiddenCount} league${hiddenCount === 1 ? "" : "s"} hidden — this team is already registered (or awaiting club approval) there.` ``
- Rules/behavior worth demoing:
  - Seasons the deep-linked team is already submitted to (or has a pending club-approval request for) are filtered out of the list entirely — "so you can't register twice" (inline code comment, owner 2026-07-15).
  - Page title: "Browse Leagues"; subtitle: "Find leagues to register your teams".

---

## Season Detail / Register Team — `/browse-leagues/[id]`
- Source files: `apps/web/src/app/(platform)/browse-leagues/[id]/page.tsx` (no further client-component imports)
- Layout: A "&larr; Back to Leagues" link, an optional inline success/error message banner, then a 3-column responsive grid: a 2-column-wide left stack (season info card → Divisions card → Registered Teams card) and a sticky right-column registration card (fee display + team/division pickers + roster checklist + submit button).
- Fields (right-column "Register Your Team" panel, shown only when `canRegister`):
  - "Select Team" — `<select>`, options `Choose team...` (empty value) then `{t.name} ({t.ageGroup}{t.gender ? ` ${t.gender}` : ""})` for each of the user's not-yet-registered teams.
  - "Select Division" — `<select>`, options `Choose division...` (empty value) then `{d.name} ({d.ageGroup})` for each season division.
  - "League roster version (`{selectedPlayers.size}/{roster.length} selected`)" — a scrollable checklist (`max-h-56`) of checkboxes, one per eligible player: `checkbox` per player, label text `{jerseyNumber ? `#${jerseyNumber} ` : ""}{name}`, plus a position tag (e.g. "G", "F") for eligible players or an "ineligible" pill (with title tooltip `` `Already rostered this season with ${p.conflict.clubName} (${p.conflict.teamName})` ``) for conflicted ones — conflicted checkboxes are disabled and pre-unchecked.
  - Helper line under the checklist (only if any player is conflicted): "Grayed players already play in this season with another club."
- Buttons/actions:
  - "&larr; Back to Leagues" — link to `/browse-leagues`.
  - Submit button — label logic: `submitting ? "Sending..." : needsClubApproval ? "Request club approval" : "Submit Team"`. Disabled while submitting or until both team and division are chosen.
    - If the acting user's role can't submit directly (`selectedTeamObj.canSubmitDirectly === false` — e.g. Staff/team manager), POST goes to `/api/seasons/${seasonId}/submission-requests` instead of `/api/seasons/${seasonId}/submit`, and a note appears below the button: "League fees are paid by the club, so a club owner/manager approves this registration before it reaches the league."
  - Always-visible microcopy under the button: "Only the selected players are submitted — the league sees this version, not your full club roster."
- Validation / toast copy (all rendered in the inline message banner, `message.type` success=green/error=red):
  - "Select a team and division" (client-side, missing team or division)
  - "Select at least one player for the league roster" (client-side, roster loaded but zero players checked)
  - On submit success: `data.message` from the API, falling back to "Team submitted successfully!"
  - On submit failure: `data.error` from the API, falling back to "Failed to submit"
- Table columns: none (card/list layout).
- Status/badge strings:
  - "Open" pill (`rounded-full bg-green-100`) next to the season label, shown when `canRegister`.
  - Registered-team status pill: `t.status.toLowerCase()` (e.g. "approved", "pending") — green tone for `APPROVED`, amber/hoop tone otherwise.
- Info tiles on the season card (each only rendered if the underlying field is set):
  - "Season" → `{format(startDate, "MMM d")} - {endDate ? format(endDate, "MMM d, yyyy") : "TBD"}`
  - "Games Guaranteed" → `{gamesGuaranteed} regular season`
  - "Registration Deadline" → `{format(registrationDeadline, "MMM d, yyyy")}` (red text if passed)
  - "Game Format" → `{gameLengthMinutes}min ({gamePeriods === "QUARTERS" ? "4 quarters" : "2 halves"})`
- Section headings: "Divisions" (division chips: `{d.name}` + `{d.ageGroup}{gender ? ` • ${gender}` : ""}`); `` `Registered Teams (${registeredTeams.length})` `` (rows: team name + tenant/club name + division tag + status pill).
- Fee display: large centered `{formatCurrency(season.teamFee, currency)}` with caption "per team" (shown only if `teamFee` is set).
- Empty states:
  - No teams owned at all: "You don't have any teams yet. Create a team first."
  - All owned teams already registered: "All your teams are already registered."
  - Registration closed (deadline passed): "Registration deadline has passed."
  - Registration not yet open: "Registration is not open yet."
  - Season not found: "Season not found."
  - Loading: "Loading..."
- Rules/behavior worth demoing:
  - Club owners/managers submit directly; Staff/team-manager-only submitters get routed into a club-approval request instead (`needsClubApproval`), keeping fee liability with the club.
  - The roster picker is a *subset* selector — the league only ever sees the checked players, not the full club roster, and a player already rostered elsewhere this season is automatically excluded and flagged "ineligible".
  - "Registered Teams" list on the season page updates live after a successful submit (re-fetches season data).

---

## Referee Requests (Shifts & Availability) — `/referee/requests`
- Source files: `apps/web/src/app/(platform)/referee/requests/page.tsx` (no further client-component imports)
- Layout: Header ("Shifts & availability" + subtitle + "My profile →" link), an optional inline note banner, an "Offers" card (pending shift offers list + a "Your booked shifts" sub-list), then a "My availability" card (add-slot form + declared-slots list).
- Fields (availability add-slot form):
  - "Date" — `<input type="date">`.
  - "From" — `<input type="time">`, default value `"09:00"`.
  - "To" — `<input type="time">`, default value `"18:00"`.
- Buttons/actions:
  - "Add" — adds an availability slot; POSTs `/api/referee/availability` `{ date, startTime, endTime }`; disabled until a date is chosen.
  - "Remove" — per declared slot; DELETEs `/api/referee/availability?id=${id}`.
  - "Accept" — per pending offer; PATCHes `/api/referee-requests/${id}` `{ action: "accept" }`.
  - "Decline" — per pending offer; PATCHes `/api/referee-requests/${id}` `{ action: "decline" }`.
  - "My profile →" — link to `/referee/profile`.
  - Both Accept/Decline buttons disable (`busy === r.id`) while their request is in flight.
- Toast/note copy (rendered in the note banner):
  - Accept success: `` `You're booked — assigned to ${data.gamesAssigned} game${data.gamesAssigned !== 1 ? "s" : ""} that day.` `` (e.g. "You're booked — assigned to 3 games that day.")
  - Decline success: "Declined."
  - Failure: `data.error` from the API, falling back to "Couldn't respond"
  - Availability save failure: `data.error`, falling back to "Couldn't save availability"
- Table columns: none (card/row layout, not tables).
- Row copy (pending offer): `` `${r.leagueName} · ${format(new Date(r.date), "EEE, MMM d")} · ${r.window}` `` plus a smaller line `` `${r.seasonLabel}${r.sessionLabel ? ` · ${r.sessionLabel}` : ""}` `` and, if `r.message`, a quoted line `` `"${r.message}"` `` below.
- Row copy (declared availability slot): `` `${format(new Date(s.date), "EEE, MMM d")} · ${s.startTime}–${s.endTime}` ``
- Status/badge strings:
  - "first accept wins" — bold pill (`bg-hoop-100 text-hoop-700`) shown on broadcast offers (`r.broadcast`).
  - "booked" — pill (`bg-court-100 text-court-700`) prefixing each row in "Your booked shifts".
- Section headings:
  - `` `Offers${pending.length > 0 ? ` (${pending.length})` : ""}` `` (e.g. "Offers (2)")
  - "Your booked shifts" (uppercase, tracked-wide label, `text-xs`)
  - "My availability" + subtitle "Days and hours you can work — leagues see this when they pick a referee."
- Empty states:
  - No pending offers: "No open offers right now."
  - No declared availability: "No upcoming availability declared."
  - Loading offers: "Loading…"
- Page header copy: H1 "Shifts & availability"; subtitle "Leagues book you by the day — keep your availability current and answer offers here."
- Rules/behavior worth demoing:
  - Broadcast offers ("first accept wins") go to a pool of referees; whoever accepts first gets the whole day's slate of games at that venue/session — the badge signals the race.
  - Accepting assigns the referee to every game in that day's window in one action (`gamesAssigned` count in the confirmation).
  - `PENDING` offers and `ACCEPTED`-and-`mine` bookings are the two lists shown; declined/other-ref-accepted offers simply disappear from view on refetch.

---

## Official Scoresheet (printable) — `/scoresheet/[gameId]`
- Source files: `apps/web/src/app/(sheet)/scoresheet/[gameId]/page.tsx` (server component) + `apps/web/src/app/(sheet)/scoresheet/[gameId]/print-button.tsx` (client) + `apps/web/src/app/(sheet)/layout.tsx` (bare layout, no site chrome — "the sheet is a document")
- Access: gated by `getSessionUserId()` + `canViewScoresheet()` — league/club people only per inline comment ("league owner, either club's staff, the assigned referee, platform admin. Families get the live page and box score instead"); unauthenticated users are redirected to `/sign-in?callbackUrl=/scoresheet/${gameId}`, unauthorized viewers get `notFound()`.
- Layout: A single bordered "document" block (`border-2 border-black`, print CSS forces `size: letter landscape; margin: 0.35in`). Regions top to bottom: optional "unofficial" warning banner → header (title/league/season left, date/venue/court right) → center scoreboard (home score — quarter-by-quarter line-score table — away score) → stacked per-team boxscore tables (home then away) → scoring-key legend line → optional "finalized without referee approval" banner → signature row (Referee / Scorekeeper) → non-printing action button row.
- Header block:
  - Title: "Official Scoresheet" (uppercase, bold)
  - Subtitle line: `` `${game.season?.league?.name ?? "—"}${game.season?.label ? ` · ${game.season.label}` : ""}` ``
  - Right-aligned: `{new Date(game.scheduledAt).toLocaleString()}` then `` `${game.venue?.name ?? ""}${game.court?.name ? ` · ${game.court.name}` : ""}` ``
- Unofficial banner (shown when `!final`, i.e. `game.status !== "COMPLETED"`): "UNOFFICIAL — GAME NOT FINALIZED"
- Center scoreboard: home team name + huge score number, a bordered mini line-score table with one header column per period (`H1`/`H2` for halves leagues, `Q1`–`Q4` then `OT1`… for quarters) plus a final "F" (final) column, then away team name + score. Team-name cells are truncated to 12 characters (`teamName.slice(0, 12)`).
- Per-team boxscore table columns (in order): jersey `#`, player name, "Fouls" (foul-box string built from `FOUL_LIMIT = 5` boxes: "☒" personal, "Ⓣ" technical, "☐" open), one column per period (label `H{n}` / `Q{n}` (n≤4) / `OT{n-4}` (n>4)) containing scoring marks, "REB", "AST", "PTS". Table header first cell spans 2 columns and reads the team name.
  - Scoring-mark rendering per period cell: made 2s/3s render as bold `"2"`/`"3"`; missed field goals render as a struck-through `"2"` in gray (per code, only 2s are marked as misses via this path since eventType only distinguishes 2PT/3PT/FT, so misses show as their own point-value digit struck through); made free throws render as "●"; missed free throws as "○". Empty cell (no marks that period) shows "·" in light gray.
  - Non-participating players: a player on the approved roster with no recorded stat line renders one merged cell reading "DNP — did not play"; a player flagged absent for the game renders "Absent" (row text grayed).
  - Totals row: label "TOTALS", then summed fouls, per-period line score, REB/AST/PTS totals.
  - Team extras line (only if any exist): `` `Team: ${totals.stl} STL · ${totals.blk} BLK · ${totals.to} TO` ``
- Scoring-key legend (always shown, one line under both team tables):
  - Exact text: "Scoring marks per quarter, in game order: **2**/**3** = made field goal · ~~2~~ = missed (where tracked) · ● made free throw · ○ missed free throw. Fouls: ☒ personal · Ⓣ technical." (bold/strikethrough rendered inline via `<strong>`/line-through span, not literal markdown)
- Conditional banner: "Finalized without referee approval" (uppercase, bold, boxed) — shown only when the game is final, the league's `requireRefereeApproval` is on, and no referee name/signature was ever recorded.
- Signature row (2-column grid):
  - Left ("Referee"): if present, an `<img>` of the referee's captured signature above the line; text: `` `Referee${refereeName ? `: ${refereeName}` : ""}${refereeVerified ? " ✓ PIN-verified" : ""}${refereeSignedAt ? ` — signed ${new Date(refereeSignedAt).toLocaleString()}` : ""}` ``
  - Right ("Scorekeeper"): `` `Scorekeeper${game.finalizedAt ? ` — finalized ${new Date(game.finalizedAt).toLocaleString()}` : ""}` ``
- Buttons/actions (all `print:hidden`, i.e. hidden in the printed/PDF output):
  - "Download PDF (landscape)" — `<a>` to `/api/scoresheet/${game.id}` (server-generated PDF download).
  - "Print / Save as PDF" — button (from `print-button.tsx`), calls `window.print()`.
  - "Box score & amp; play-by-play" (renders as "Box score & play-by-play") — `<a>` to `/live/${game.id}`.
- Table columns: see boxscore table above (per-team) and the mini line-score table (period columns + "F").
- Status/badge strings: none as pills — "UNOFFICIAL — GAME NOT FINALIZED" and "Finalized without referee approval" are the only status-style banners, styled as plain bordered/bold text blocks (paper-record aesthetic, not colored chips).
- Empty states: `notFound()` (Next.js 404) if the game doesn't exist or the viewer lacks access — no bespoke empty-state copy on this route.
- Rules/behavior worth demoing:
  - Designed to fit one page in landscape print — explicit `@page { size: letter landscape; margin: 0.35in }`.
  - Uses live/finalized fold data for score and stats; once `COMPLETED`, uses the persisted `homeScore`/`awayScore` fields instead of the recomputed fold if present.
  - Distinguishes three player states per team: played (full stat line + marks), DNP (rostered, no action), Absent (marked absent for the game) — a real scorebook lists the whole roster, not just active scorers.

---

## My Calendar — `/calendar`
- Source files: `apps/web/src/app/(platform)/calendar/page.tsx` (server) + `apps/web/src/app/(platform)/calendar/my-calendar.tsx` (client) + `apps/web/src/components/calendar/add-to-phone.tsx`, `agenda-list.tsx`, `item-popover.tsx`, `rsvp-control.tsx`
- Layout: Page header ("My Calendar" + subtitle) → calendar "lens" filter chips (one per kid/team/league, only shown if >1 lens) → a view-toggle row ("Agenda"/"Grid", agenda-only on phones) + "Add to phone" button → either the Agenda list (sticky month headers, date tiles, RSVP inline per card) or the Grid (7-day-wide, 6-week month grid, click a chip to open a popover with the same RSVP controls).
- Page header copy: H1 "My Calendar"; subtitle "Every game, practice and event across all your teams — answer Going or Can't go right here." (apostrophes rendered via `&apos;` in source).
- No-calendar-context empty state (account has no team/family/staff/referee connection): H1 "No calendar yet"; body "Your calendar fills up when you're connected to teams — as a parent, a coach, a referee, a club, or a league. This account doesn't have any of those yet."; button "Back to Home" → `/`.
- Fields: none as form inputs — RSVP is button-based (see RsvpControl below), not typed inputs.
- Buttons/actions:
  - "Agenda" / "Grid" — view-toggle buttons (segmented control), hidden below `sm` breakpoint (agenda-only on phones per owner rule 2026-07-11).
  - "📅 Add to phone" (label shows "📅 Adding…" while minting the feed token) — opens a small panel and immediately attempts to hand off to the platform's calendar app:
    - Apple/Mac UA: navigates to a `webcal://` URL (Apple Calendar's own subscribe dialog takes over).
    - Android UA: opens the Google Calendar "add by URL" page in a new tab.
    - Other: panel stays open with manual options.
    - Panel copy: heading `launched === "apple" ? "Opening Apple Calendar…" : launched === "android" ? "Opening Google Calendar…" : "Subscribe once — updates flow in"`; body `launched && launched !== "other" ? "Confirm the subscription there and every practice, game and event stays in sync. Didn't open? Use the buttons below." : "Practices, games and events for all your teams. Moves and cancellations update automatically."`
    - Panel buttons: "iPhone / Apple Calendar" (webcal link), "Google Calendar (Android)" (opens in new tab), "Copy feed URL" (copies the https URL, label flips to "Copied!" for 2s).
    - Failure copy: "Couldn't create your calendar link."
  - Lens chips — toggle a calendar on/off; `title` attribute is "Hide this calendar" (visible) / "Show this calendar" (hidden); hidden chips render label with strikethrough.
  - Agenda card click / Grid chip click — opens the `ItemPopover` for that item (title `` `${kind === "game" ? "Game — " : ""}${title}` ``, subtitle `` `${format(at, "EEE MMM d, h:mm a")}${metaLine ? ` · ${metaLine}` : ""}` ``).
  - "Watch live →" — shown on LIVE items; link to `/live/${item.id}`, click doesn't also open the popover (`stopPropagation`).
  - "Open game page →" — inside the popover for game items; link to `/live/${item.id}`.
  - "Cancel practice" / "Cancel event" — staff-only action inside the popover for non-cancelled practices/events; confirms via `window.confirm` with copy `` `Cancel this ${noun}? Everyone affected is notified.` `` then PATCHes.
  - "Restore practice" / "Restore event" — staff-only, shown once cancelled, reinstates the item (no confirm dialog).
  - "Postpone game" / "Cancel game" — league-manager-only actions on scheduled games; "Postpone game" confirm copy `` `Postpone this game? Everyone affected is notified.` ``; "Cancel game" confirm copy `` `Cancel this game? Everyone affected is notified.` ``.
  - RSVP buttons (`RsvpControl`, family view): "✓ Going" / "? Maybe" / "✕ Can't go" — one row per linked player, PUTs `/api/rsvp` `{ playerId, itemType, itemId, status }` optimistically.
  - RSVP roll-up toggle (`RsvpRollup`, staff view): clicking the summary text expands/collapses a by-status name list; toggle glyphs "▴" (open) / "▾" (closed).
- Table columns: none (agenda/grid card layouts, not tables).
- Grid legend line (bottom of grid view): "Games ·" / "Practices ·" / "Events — click any item to see details and RSVP." (each preceded by a colored swatch).
- Status/badge strings:
  - "Live" — red pill on in-progress items (agenda + grid: grid also rings the chip red).
  - "Cancelled" — red-outline pill on cancelled agenda items (also struck-through title, and struck-through/faded chip in grid).
  - RSVP roll-up summary format (`formatRsvpSummary`): `` `${going} going` `` + (if any) `` ` · ${notGoing} out` `` + (if any) `` ` · ${maybe} maybe` `` + always `` ` · ${noReply} no reply` `` — e.g. "8 going · 1 out · 2 no reply".
  - RSVP roll-up expanded group labels: "Out" (red), "Maybe" (amber), "Going" (green/court), "No reply" (ink/gray) — each followed by the matching players' names (note in quotes appended if the player left one, e.g. `Alex ("running 10 late")`).
- Time formatting: `timeRange()` renders "6:30 – 8:00 PM" style ranges (start time omits the AM/PM suffix when both start and end share the same half of the day) — inline comment notes this replaced a duration display per owner direction 2026-07-16.
- Event label logic (`eventLabel`): practices always show "Practice"; games show `` `vs ${opponent}` `` (or the raw title if no opponent); other events show `` `${TypeCapitalized} · ${title}` `` unless the title already contains the type name.
- Empty states:
  - No teams/lenses at all: "No teams yet" + "When your player joins a team — or you start coaching one — every game, practice and event lands here."
  - Has teams but nothing scheduled (agenda): "Nothing scheduled yet" + "Games, practices and events from all your teams will appear here."
  - Popover with nothing actionable: "This item has already started — RSVP is closed." / "You're officiating this game." (referee lens) / "Nothing to answer here." (fallback)
  - Loading: "Loading your calendar…"
  - Fetch error banner: "Couldn't load your calendar — refresh to try again." (initial load) / "Couldn't save your RSVP — try again." (RSVP PUT failure)
- Rules/behavior worth demoing:
  - Polls `/api/calendar/mine` every 45s (`POLL_MS`) to stay live without a manual refresh.
  - View defaults to Agenda for any account with a family (parent) team; pure-staff desktop accounts default to Grid; phones (`max-width: 639px`) are forced to Agenda regardless of saved preference.
  - Hidden-lens preference persists in `localStorage` under key `mycal-hidden-lenses`.
  - One shared feed token/URL for both the team calendar and My Calendar's "Add to phone" (same all-teams iCal feed).

---

## Notifications — `/notifications`
- Source files: `apps/web/src/app/(platform)/notifications/page.tsx` (no further client-component imports)
- Layout: A header card (an "Inbox" eyebrow pill, H1 "Notifications" with an unread count, "Mark all as read" / "Clear read" actions) above a vertical list of notification rows; unread rows are tinted and carry a dot; actionable rows (unread staff invites) show inline Accept/Decline buttons instead of routing through click-to-navigate.
- Fields: none (read/action list, no inputs).
- Buttons/actions:
  - "Mark all as read" — shown only if `unreadCount > 0`; PATCHes `/api/notifications` `{ all: true }`.
  - "Clear read" — shown only if `readCount > 0`; DELETEs `/api/notifications` `{ all: true }` (server-side "all" on DELETE only clears already-read notifications, per inline comment).
  - Row click (`handleClick`) — marks that notification read, then navigates to `notification.link` if present (staff invite/request rows with a link still navigate the same way).
  - "Accept" — for actionable staff-invite rows only; PATCHes `/api/invitations/${referenceId}` `{ action: "accept" }`, then marks read and appends `" (Accepted)"` to the displayed message.
  - "Decline" — same endpoint with `{ action: "decline" }`; appends `" (Declined)"` to the displayed message.
  - "✕" (dismiss, `aria-label="Dismiss notification"`, `title="Dismiss"`) — per-row; DELETEs `/api/notifications` `{ ids: [notification.id] }`, removes it from the list immediately.
  - Failure copy (both Accept/Decline paths): `alert(data.error || "Failed to respond")` on a non-OK response, or `alert("Failed to respond")` on a thrown error — these are native browser `alert()` dialogs, not inline toasts.
- Table columns: none (card list, not a table).
- Row anatomy: title (`notification.title`, semibold, darker if unread) + unread dot (small filled circle) → message (`notification.message`) → timestamp formatted `` `new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })` `` (e.g. "Jul 19, 2:45 PM").
- Header copy:
  - Eyebrow pill: "Inbox"
  - H1: "Notifications" with, if any unread, a trailing `` `(${unreadCount} unread)` ``
- Status/badge strings: none as colored pills beyond the small unread dot; actionability is inferred from `notification.type === "staff_invite"` plus `!isRead` plus a `referenceId`.
- Empty states:
  - No notifications at all: "No notifications yet."
  - Loading: "Loading notifications..."
- Rules/behavior worth demoing:
  - Only `staff_invite` notifications render inline Accept/Decline (not `staff_request`, despite both being checked in the click-routing logic) — and only while still unread and carrying a `referenceId`.
  - Clicking anywhere on an actionable row does *not* trigger navigation (`isActionable` rows opt out of `onClick`) — only the Accept/Decline buttons or the dismiss "✕" respond.

---

## Notification & email templates — Season schedule commit
- Source file: `apps/web/src/app/api/seasons/[id]/schedule/commit/route.ts` (calls `notifyMany` from `apps/web/src/lib/notifications.ts` and `notifyTeam` from `apps/web/src/lib/teams/practices.ts`)
- Trigger: `POST /api/seasons/[id]/schedule/commit` — a league owner (or platform admin) runs/re-runs the scheduler and persists the games. Two separate notification fan-outs happen in the same request, both scoped to teams that are `APPROVED` submissions in that season and actually received at least one committed game:

1. **Club-level bell** (one notification, to every `ClubOwner`/`ClubManager` `UserRole` at each club with a team in the season — bell only, no email):
   - `type`: `"schedule_published"`
   - `title`: "Season Schedule Published"
   - `message`: "The game schedule for your league season has been published."
   - `link`: `` `/browse-leagues/${params.id}` ``
   - `referenceType`: "Season"

2. **Per-team bell + email** (`notifyTeam`, sent to every team member — coaches, team managers, parents, self-registered players — *excluding* anyone already notified via the club-level bell above; only sent for teams with `gameCount > 0`):
   - `type`: `"schedule_published"`
   - `title`: "Game schedule published"
   - `message` (bell body, exact template): `` `${sub.team.name}: ${gameCount} games scheduled in ${seasonName}. See them on your team calendar.` `` — e.g. "U14 Elite: 12 games scheduled in NPH Showcase League Fall 2026. See them on your team calendar."
     - `seasonName` is computed as `[league.name, season.label].filter(Boolean).join(" ")`.
   - `link`: `` `/teams/${sub.teamId}/calendar` ``
   - `emailSubject` (exact template): `` `${sub.team.name} game schedule is out — ${seasonName}` `` — e.g. "U14 Elite game schedule is out — NPH Showcase League Fall 2026."
   - `emailHtml` (exact template, raw HTML string):
     ```
     <p>The game schedule for <strong>${sub.team.name}</strong> in <strong>${seasonName}</strong> has been published: <strong>${gameCount} games</strong>.</p><p>See dates and venues, get changes live, and add the schedule to your phone's calendar: <a href="${appUrl}/teams/${sub.teamId}/calendar">team calendar</a></p>
     ```
     (`appUrl` = `appBaseUrl()` from `@/lib/email`; the "team calendar" link text is literal, unescaped `'` in "phone's".)
- Delivery mechanics (`notifyTeam` in `apps/web/src/lib/teams/practices.ts`):
  - Looks up the team's chat members (`getChatMembers`), filters out any `excludeUserIds` (the already-club-notified set) and any `excludeUserId`, then calls `notifyMany` (in-app bell + DB row) for the remaining users, and separately emails every one of them via `sendEmail({ to, subject: emailSubject, html: emailHtml })` (best-effort, `Promise.allSettled`, no failure blocks the response).
- Rules/behavior worth demoing:
  - Comment in source frames the intent: "Fan the news out — one club-level bell for owners/managers, then bell + EMAIL to every team's full circle — coaches, team managers, parents, self-registered players — pointing at the team calendar where the games (and the phone iCal feed) now live."
  - A team with zero committed games (e.g. bye week / not scheduled this pass) is silently skipped — no notification, no email.
  - Club owners/managers get only the bell (no email) at the club-level step, then are excluded from the team-level bell+email step so they aren't double-notified.

---

## Not found / out of scope
- No client components beyond those listed above were imported by any of the five target pages — each page's full visible-label surface is captured above.
- `browse-leagues` and `browse-leagues/[id]` have no additional client-only sub-components (no separate `TeamPicker`/`FeeCard` files) — everything is inline in the two page files.
- `referee/requests/page.tsx` has no additional client-only sub-components — everything is inline in the one page file.
- The scoresheet's PDF download button (`/api/scoresheet/${game.id}`) was not opened — it's a server route producing a PDF, out of scope for a JSX-label transcription (no visible copy to quote beyond the button's own label, which is captured above).
- `getNavShape` (used by `/calendar` to decide `hasCalendar`) and `canViewScoresheet` (scoresheet authz) were not transcribed — they are pure logic/authorization helpers with no visible copy of their own.
