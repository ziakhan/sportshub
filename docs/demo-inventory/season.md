# Season / Live Scoring / League / Chat / Polls / Playoffs — Verbatim Screen Inventory

Transcribed directly from source. All quoted strings are copied verbatim from the code (JSX text, template literals with computed values shown as `${...}` templates). Nothing paraphrased.

---

## Scoring console (pre-game: attendance) — `/games/[id]/score`
- Source files: `apps/web/src/app/(scoring)/games/[id]/score/page.tsx`, `apps/web/src/components/scoring/scoring-console.tsx` (lines ~644–819), `apps/web/src/components/scoring/pre-game-checklist.tsx`
- Layout: A full-screen modal ("Game-day checklist") appears first over everything, then dismisses into the attendance roll-call screen — two side-by-side roster cards (home/away) of tappable player chips, followed by a starting-five picker screen, before the live console renders.
- Pre-game checklist modal fields/controls:
  - Eyebrow: `"Before tip-off"`
  - Heading: `"Game-day checklist"`
  - Readiness rows, label/value pairs: `"Scorekeeper"` / `"Referee"` — value shown or `"Not assigned"`
  - Section: `"Run the game clock?"` with helper text: `"Only choose Yes if you'll operate start/stop during play — otherwise minutes count wrongly. Most games just use the arena clock."`
    - Button: `"Yes — I'll run it"`
    - Button: `"No clock"`
  - Section: `"Need a volunteer scorekeeper?"` with helper text: `"Generate a one-time link and send it over WhatsApp — they type their name and start scoring, no account."`
    - Button (no link yet): `"Generate guest link"` (busy state: `"Generating…"`)
    - Once generated: link box (monospace, the invite URL), buttons `"Copy link"` (toggles to `"Copied ✓"`) and `"Share on WhatsApp"` (opens `https://wa.me/?text=Can you keep score for our game? Tap to start: <url>`)
    - Fine print: `"Generating a new link kills the old one; the link dies a few hours after the game."`
  - Dismiss button: `"Continue to attendance & scoring →"`
- Attendance screen:
  - Heading template: `"Attendance — {homeTeam.name} vs {awayTeam.name}"`
  - Body copy: `"Everyone starts as present — tap whoever is missing. Absent players show on the scoresheet and don't count a game played in their season stats."` (+ conditionally appended: `" Players whose family said "Not going" are pre-marked — tap to correct."`)
  - Per-team card header: `"{teamName}"` with count template `"{present} here · {absent} absent"`
  - Player chip: `"#{jerseyNumber}"` + `"{name}"`, sub-label `"absent"` or `"present"`
  - Empty roster: `"No roster found for this team."`
  - Button: `"Continue to starting lineups →"`
- Starting-five screen:
  - Heading: `"{homeTeam.name} vs {awayTeam.name}"`
  - Sub-copy template: `"{leagueName} · {venueName} · pick each starting five, then start the game"`
  - Per-team card: `"{teamName}"` + `"starting five: {n}/5"`; player chips `"#{jersey}"` + `"{name}"`
  - Buttons: `"← Attendance"`, `"Start game"` (disabled until both fives = 5), footer note: `"Fewer than 5 marked players? Tap the ones who are here — you can fix lineups with SUBS any time."`
  - "Start game" appends ATTENDANCE + LINEUP × 2 + `PERIOD_START` period 1 events.

## Scoring console (live) — `/games/[id]/score`
- Source files: `apps/web/src/components/scoring/scoring-console.tsx` (lines ~820–1911), `apps/web/src/components/scoring/signature-pad.tsx`
- Layout: Sticky header bar (score/period/clock/foul counts, last-3-events ticker, sync badge, BOX/layout/spectator-link/full-screen/UNDO controls) above a form-factor-dependent body — tablet layout is a 3-column grid (home floor tiles | action pad | away floor tiles); phone portrait stacks two color-coded jersey chip rows plus the action pad; short/landscape phones collapse the header to one line. Four full-screen sheet overlays (clock edit, rebound picker, box score, substitutions) slide up over everything else.
- Header fields/controls (normal, non-short layout):
  - Home/away name row with colored dot; score in large tabular-nums
  - `"fouls {n}"` and, once ≥7 in the period, appended `" · bonus"`
  - Period label via `periodLabel()`: `"Q{n}"` (QUARTERS) or `"H{n}"` (HALVES); `"OT{n}"` beyond regulation
  - Clock button (only when `gameClockMode === "SIMPLE"`): formatted `M:SS` + `"⏸"` (running) or `"▶"` (stopped); tapping toggles CLOCK_START/CLOCK_STOP
  - Clock-edit button: `"✎"` (aria-label `"Adjust the clock"`)
  - Period control: if period open, `"End {periodLabel}"`; if closed, `"Start {periodLabel(period+1)}"` (+ `" (OT)"` suffix on the one-line variant when it crosses into overtime) and, once `period >= regulationPeriods`, `"End game →"` (one-line variant: `"End game"`)
  - Last-3-events ticker chips: `"{miss? "miss " : ""}{EVENT_LABELS[type]}{" #"+jersey if any} ✕"` — tap to undo that one event
  - Sync badge: `"synced"` when queue empty, else `"{n} not saved"` (title tooltips: `"All events saved"` / `"Events not reaching the server yet — check connection or lock"`)
  - `"BOX"` button (title `"Box score — points, rebounds, assists, fouls"`) opens the box-score overlay
  - Layout-switch button (tablet/short excluded, title `"Switch player layout (rows vs tiles)"`): label shows the *current* mode's name — `"Rows"` when `mobileLayout === "rows"`, else `"Tiles"` — tapping flips to the other layout
  - Spectator link icon button → `/live/{gameId}` (title `"Open the public spectator page (share this one with parents)"`)
  - Full-screen toggle (only if supported): `"Full screen"` / `"Exit full screen"`
  - `"UNDO"` button — voids the most recent event
  - One-line/landscape variant condenses to the same controls with `"BOX"`, a ✓/count sync pill, and `"UNDO"`
- EVENT_LABELS map (used in the ticker and elsewhere): `SCORE_2PT → "2PT"`, `SCORE_3PT → "3PT"`, `SCORE_FT → "FT"`, `REBOUND → "REB"`, `ASSIST → "AST"`, `STEAL → "STL"`, `BLOCK → "BLK"`, `TURNOVER → "TO"`, `FOUL → "FOUL"`, `SUBSTITUTION → "SUB"`, `PERIOD_START → "period start"`, `PERIOD_END → "period end"`, `CLOCK_START/CLOCK_STOP → "clock"`, `LINEUP → "lineup"`
- Action pad (sticky bottom bar):
  - Status strip (fixed height, three mutually-exclusive states):
    - Idle hint: `"Tap an action, then a player — either order works"`
    - Action pending: `"{EVENT_LABELS[type]}{" miss" if made===false} — now tap the player"`
    - Player pending: `"#{jersey} — now tap an action"`
    - Assist chain: `"Assist by?"` + jersey buttons for on-floor teammates (excluding shooter) + `"skip"`
  - Score buttons (row 1, exact labels): `"+2"` (SCORE_2PT made), `"+3"` (SCORE_3PT made), `"FT ✓"` (SCORE_FT made); if `statDepth !== "SCORE_ONLY"` also `"2 ✗"`, `"3 ✗"`, `"FT ✗"` (misses)
  - Row 2 (shown when `showMisses`): `"REB"` (REBOUND), `"AST"` (ASSIST)
  - Row 2 (shown when `statDepth === "FULL"`, i.e. `showHustle`): `"STL"` (STEAL), `"BLK"` (BLOCK), `"TO"` (TURNOVER)
  - Always: `"FOUL"` (regular foul); if `showHustle`, also `"TECH"` (FOUL with `technical: true`)
- Floor tiles (tablet layout): each on-court player tile shows `"#{jersey}"`, foul pips as repeated `"•"` (capped at `FOUL_LIMIT` = 5), and `"{name}"`; fouled-out players are disabled/dimmed. Below the five: `"SUBS ⇄ ({benchCount} on bench)"`.
- Chip row (phone rows layout): a `"⇄"` subs button (aria-label `"Substitutions — {teamName}"`) plus one number-only chip per on-floor player (jersey + foul dots).
- Compact column (phone tiles layout): `"⇄ {teamName}"` subs button + rows showing jersey number, foul dots (red), and name.
- Rebound picker overlay: heading `"Who got the rebound?"`; sub-copy `"Missed shot{" by #"+jersey if any} — tap whoever grabbed the ball. Their team keeps it (offensive) or takes it over (defensive)."`; two columns labeled `"Offense · {teamName}"` / `"Defense · {teamName}"`; footer button `"Skip — no rebound recorded"`.
- Box-score overlay: heading template `"Box score — {homeTeam.name} {homeScore} · {awayScore} {awayTeam.name}"`; `"Close"` button; footnote `"● = on the floor · red PF = one foul from fouling out. Live — updates as you score."` Table columns: `"Player"`, `"PTS"`, `"REB"`, `"AST"`, `"PF"` (PF shown red+bold at `FOUL_LIMIT - 1`; technical fouls append `" (T{n})"`).
- Clock-edit sheet: heading `"Set the clock"`; sub-copy `"Match it to the arena clock — {running ? "it keeps running from the new time" : "it stays paused at the new time"}."`; two numeric inputs (minutes/seconds, aria-labels `"Minutes"`/`"Seconds"`); buttons `"Cancel"` and `"Set clock"`.
- Substitutions overlay: heading `"Substitutions — {teamName}"`; sub-copy `"Tap who comes OUT, then who goes IN. Stage as many swaps as you need, then apply."`; section labels `"On the floor"` and `"Bench"` (uppercase); staged-swap row `"#{out} out → #{in} in"` with a `"✕"` remove; fouled-out bench entries show `" (fouled out)"`; buttons `"Cancel"` and `"Apply {n} swap(s)"` (pluralized: `"swap"` vs `"swaps"`).
- Lock takeover screen: heading `"Game is being scored elsewhere"`; body `"{holder} is currently scoring this game on another device."`; button `"Take over scoring on this device"`.
- Loading/error states: `"Loading game…"`; error text is server-supplied, e.g. `"This account can't score this game. Scoring is open to the league owner and staff of the two competing clubs — sign in with one of those accounts."` (403) or `"You're not signed in — sign in first, then reopen this page."` (401).

## Scoring console — Review & finalize screen — `/games/[id]/score` (End game state)
- Source: `scoring-console.tsx` lines ~862–1041
- Layout: centered column — score heading, two box-score tables side by side, a referee-approval panel, then action buttons.
- Heading template: `"Review: {homeTeam.name} {homeScore} — {awayScore} {awayTeam.name}"`
- Referee approval panel:
  - Title: `"Referee approval"` + `" (required by this league)"` or `" (optional)"` depending on `config.requireRefereeApproval`
  - Mode toggle (only if any referee has a PIN set): `"Signature"` / `"Referee PIN"`
  - PIN mode copy: `"The assigned referee enters their personal PIN — verified against their account, the strongest form of approval."`; referee-name pill buttons; password input placeholder `"Referee PIN"`
  - Signature mode: `<SignaturePad>` (placeholder inside empty canvas: `"Referee signs here"`; `"Clear signature"` link) + text input placeholder `"Referee's printed name (optional with a signature)"`
  - Conditional link when required approval missing: `"Referee unavailable? Finalize without approval (stamped on the sheet)"` — confirm dialog: `"Finalize WITHOUT referee approval? The scoresheet will be clearly stamped as not approved by the referee."`
- Buttons: `"← Back to scoring"`, and `"Mark final"` (busy: `"Finalizing…"`; disabled + tooltip `"The referee must sign off first"` when required and missing)
- Box tables (shared `boxTable()` helper) columns: `"Player"`, `"PTS"`, `"REB"`, `"AST"`, `"PF"`; header label passed in is the team name.

## Scoring console — Finalized/Final screen — `/games/[id]/score`
- Source: `scoring-console.tsx` lines ~596–642
- Heading: `"Final"`
- Score line template: `"{homeTeam.name} {homeScore} — {awayScore} {awayTeam.name}"`
- Links: `"Official scoresheet (print) →"` (`/scoresheet/{gameId}`), `"Public box score →"` (`/live/{gameId}`)
- Correction (league owner / platform admin only, `canCorrect`): button `"Correct result"` with confirm dialog `"Reopen this finalized game for corrections? Use Mark final again to republish the result."`; helper text `"League owner correction — the record stays official until you re-finalize."`
- While correcting: banner `"Correcting a finalized game — Mark final again to republish the result."` (bold on "Mark final").

---

## Public live game page — `/live/[gameId]`
- Source files: `apps/web/src/app/(public)/live/[gameId]/page.tsx`, `apps/web/src/app/(public)/live/[gameId]/live-view.tsx`, `apps/web/src/components/scoring/flash-num.tsx`, `apps/web/src/lib/scoring/fold.ts` (fold engine, shared with the console)
- Layout: A full-bleed dark "broadcast stage" hero gradient-washed in both teams' colors — league/season line, then a 3-column row (home team stacked crest/name/record/score, center game-state column, away team mirrored) and venue line below. Below the hero: a floating "Score" pill (if the viewer can score and the game isn't final), then either a pre-game two-column roster/season-averages view, or (once any stats exist) a `Game | Stats | Plays` tab bar on phones with the linescore + leaders + team-stat-comparison cards, and a box-score/play-by-play layout that goes side-by-side on desktop (both team box scores plus a sticky play-by-play rail).
- Status/badge strings:
  - Sticky mini score chip center label: `"Live · {periodLabel}"` when live, `"Final"` when final, `"vs"` otherwise (chip has aria-label `"Back to the scoreboard"`)
  - Hero center column: `"Live"` pill (uppercase, pulsing dot) with period label below, plus ticking clock `M:SS` if `clockMode === "SIMPLE"`; `"Final"` pill when completed; otherwise the scheduled date/time (`"EEE, MMM d, h:mm a"`-style via `toLocaleString`)
  - Score hero: winner's score renders in the highlight color, loser's dimmed to `text-white/60` (final games only)
- Fields/controls:
  - `"Score"` floating action button → `/games/{gameId}/score` (visible only if `canScore` and not final)
  - Phone tab bar labels: `"Game"`, `"Stats"`, `"Plays"`
  - Box-score team switcher (phones): buttons show each team's full name, colored when active
  - Play-by-play filter chips: `"All"`, `"Scoring"`, plus one chip per period played (`Q1`…`Q4`, `OT1`…)
  - Rail heading: `"Play-by-play"` (desktop only — the phone tab label already says it)
- Pre-game (SCHEDULED, no stats yet) copy: `"This game hasn't started yet"` / `"Live score, leaders and the box score appear here automatically at tip-off — the page refreshes on its own. Season numbers below."` Roster table columns: `"Player"`, `"GP"`, `"PPG"`, `"RPG"`, `"APG"`; empty-roster copy `"Roster not submitted yet."`
- Game tab cards:
  - `"Game leaders"` heading, `leadersCard` with sections `"Points"`, `"Rebounds"`, `"Assists"`, `"Defense"` (Defense shows whichever of STL/BLK is higher, unit label `"STL"` or `"BLK"`); each leader cell shows jersey badge, `shortName`, big stat number + unit (`"PTS"`/`"REB"`/`"AST"`), and a sub-line (e.g. `"{REB} REB · {AST} AST"`)
  - `"Team stats"` heading, `teamStatsCard` compare rows labeled: `"Field goals"`, `"3-pointers"`, `"Free throws"` (each showing `"{m}-{at} · {pct}%"`, or `"0-0"` at zero attempts), `"Rebounds"`, `"Assists"`, `"Steals"`, `"Blocks"`, `"Turnovers"`, `"Fouls"` — each with a two-color proportion bar
  - Linescore table: header cells are period numbers 1–4 (fixed, dash `"–"` for unplayed) plus any OT columns (`OT1`, …) and a final `"Tot"` column; row label uses `shortTeam()` abbreviation (e.g. `"BF · G10"`)
- Box-score table (`statsTable`) columns: `"Player"`, optional `"Min"`, `"Pts"`, `"Reb"`, `"Ast"`, `"Stl"`, `"Blk"` (desktop/sm+ only), `"TO"`, `"PF"` (desktop/sm+ only). Group header rows: `"Starters"` and `"Bench"`. Top scorer gets a `"TOP"` badge. On-floor players (live only) get a green `" ●"` suffix on the name. Team totals row labeled `"Team"`.
- Play-by-play line generator (`describe()`):
  - Made shot: `"{who} {SCORE_FT ? "makes a free throw" : "scores {pts}"}"`
  - Missed shot: `"{who} misses {SCORE_FT ? "a free throw" : "a {pts}-pointer"}"`
  - Foul: `"Foul on {who or "team"}"` (+ `" (technical)"` suffix)
  - Substitution: `"Sub: #{inJersey} in, #{outJersey} out"`
  - Period start: `"{periodLabel}"` (e.g. `"Q1"`); period end: `"End of period"`
  - Narrative merge tails appended to made/miss lines: `", assisted by #{jersey} {shortName}"` or `" — {offensive|defensive} rebound #{jersey} {shortName}"`
  - Period separator rows show `"{periodLabel}"` (start) or `"End of period"` (end)
  - Empty play list: `"No plays yet."`
- Player-name privacy rule baked into `shortName()`: pre-shortened privacy names (e.g. `"Cameron K."`) are passed through unchanged; otherwise compresses to `"{First} {LastInitial}."` (e.g. `"Aiden M."`).
- Real-time behavior: initial full load via `GET /api/live/{gameId}`; subsequent polls use `?sinceSeq={lastSeq}` and merge only new/voided events (never replace state). A `useRealtime` socket subscribed to room `game:{gameId}` fires an immediate poll on a `game.update` event; the interval itself still runs as a safety net at `20_000ms` while connected or `10_000ms` while disconnected. A `FlashNum` component pulses green (CSS class `score-flash`) on every score/box-score cell whose value changes. An `IntersectionObserver` toggles the sticky mini score-chip. The countdown game clock (when `clockMode === "SIMPLE"` and status LIVE) re-derives from `clockSecondsAtLastEvent` and ticks client-side every 500ms while `clockRunning`.
- Loading/error states: `"Loading…"` (no data yet), `"Couldn't load this game."` (fetch error).

---

## Scores listing — `/scores`
- Source files: `apps/web/src/app/(public)/scores/page.tsx`, `apps/web/src/components/ui/score-card.tsx`, `apps/web/src/components/ui/badge.tsx`, `apps/web/src/components/realtime-refresh.tsx`
- Layout: A `SectionHeader` ("Scores") followed by a horizontal row of league-filter pill links, then stacked sections — "Your games" (if signed in and has any), "Live now", "Upcoming" (grouped by day), "Recent results" (grouped by day, newest first) — each rendering a responsive grid of `ScoreCard`s.
- Page metadata title: `"Scores"`; description: `"Live youth basketball scores, recent finals and upcoming games across every league."`
- SectionHeader copy: eyebrow `"Around the hub"`, title `"Scores"`, description `"Live games, this week's finals and what's coming up — across every league."`
- Filter pills: `"All leagues"` plus one pill per league name; when a season filter is active, an extra pill `"Standings & league hub →"` links to `/league/{seasonId}`
- Section headings: `"Your games"` (badge count, tone `hoop`) with sub-copy `"Games for your kids' teams and teams you follow."`; `"Live now"` (badge tone `live`, dotted); `"Upcoming"`; `"Recent results"`
- `GameCard` status derivation: `LIVE` → `"LIVE"`, `COMPLETED` → `"FINAL"`, else `"SCHEDULED"` (passed into `ScoreCard`)
- `ScoreCard` status badges (`StatusBadge`): `"Live"` (tone `live`, dot), `"Final"` (tone `neutral`), `"Cancelled"` (tone `danger`), `"Default"` (tone `warning`), else `"Upcoming"` (tone `play`)
- `ScoreCard` date label for scheduled games: `format(scheduledAt, "h:mm a")`; day-group headings: `"Today"` or `format(date, "EEEE, MMMM d")`
- Day-group section day headers use the same `"Today"` / `"EEEE, MMMM d"` pattern
- Highlights link (when present): `"Highlights"`
- Empty state: `"No games in this window — check back soon."`
- Real-time behavior: `<RealtimeRefresh rooms={["scores"]} events={["game.update"]} />` — an invisible client island joins the `scores` realtime room; on a `game.update` event it debounces 2000ms then calls `router.refresh()`, causing the whole server component to re-render with fresh data. No client-side diffing — a full page re-fetch.
- Rules worth demoing: "Your games" pins the viewer's kids'/staffed/followed teams' games above the generic feed and de-duplicates them out of the sections below (`notMine()` filters).

## Public league hub — `/league/[id]`
- Source files: `apps/web/src/app/(public)/league/[id]/page.tsx`, `apps/web/src/components/ui/standings-table.tsx`, `apps/web/src/components/ui/score-card.tsx`, `apps/web/src/components/ui/news-card.tsx`
- Layout: Branded hero banner (league logo/banner/tagline/status pills/follow button/social links/quick-stats strip) over a 2/3 + 1/3 grid: left column has "Scores & schedule" (live/upcoming/recent `ScoreCard`s), "Standings" (per-division `StandingsTable`s), "League news" (`NewsCard`s), "Teams" (grouped by division); right sidebar has a "Scoring leaders" card, a "Season" facts card, and (if registration open or a team fee exists) a registration/fee card, plus an "In season" note card.
- Hero status pills: `"Season underway"` (when `season.status === "IN_PROGRESS"`), `"Registration open"` (when open and deadline not passed, with a small dot), and the season label chip (`season.label`)
- Quick-stats strip labels: `"Team"`/`"Teams"` (pluralized), `"Games played"`, `"Divisions"`, and either `"Live now"` (if any live games) or `"Upcoming"`
- `"Edit page"` inline link (only for league owner/manager/platform admin) → `/manage/leagues/{leagueId}/customize`
- Section headings: `"Scores & schedule"`, `"Standings"` (with note `"Tied teams are shown in win-percentage order — this league hasn't configured tiebreaker rules yet."` when no tiebreaker order configured), `"League news"` (action link `"All news →"`), `"Teams"`
- Standings table columns (`StandingsTable`): `"Team"`, `"W"`, `"L"`, `"PCT"`, `"GB"`, `"STRK"` — PCT renders as `.XXX` (leading zero stripped); streak badge text like `"W3"`/`"L2"` colored green/red
- Sidebar: `"Scoring leaders"` card (label `"PPG"`, `"Full leaders board →"` link to `/league/{id}/leaders`); `"Season"` card rows `"Dates"`, `"Teams"`, `"Divisions"`, `"Games guaranteed"`, `"Playoffs"` (shows `season.playoffFormat` with underscores replaced by spaces); registration card: `"Register your team"` button, `"Deadline {date}"`, or closed copy `"Registration is closed."` / `"Registration is not open."`
- `"In season"` badge card copy: `"Games are scored live — tap any final for the full box score and play-by-play, or follow the league to see it on your homepage."`
- Empty/back link: `"← All leagues"` at top
- No playoff bracket is rendered on this public page — playoffs surface only as the `season.playoffFormat` text line in the sidebar "Season" card and as links to individual playoff games; the bracket UI itself is operator-only (see Playoffs section below).

## League leaders — `/league/[id]/leaders`
- Source files: `apps/web/src/app/(public)/league/[id]/leaders/page.tsx`, `apps/web/src/lib/stats/season.ts`, `apps/web/src/lib/queries/season-stats.ts`
- Layout: Back link, `SectionHeader`, then a responsive grid of category cards — one per stat category — each with a "top" leader highlighted in a gold-tinted strip and the rest as a numbered list.
- Back link: `"← {leagueName} {seasonLabel}"`
- SectionHeader: eyebrow `"Stat leaders"`, title `"{leagueName} leaders"`, description template `"Per-game leaders across {completedGames} completed game{s}. Players must appear in at least half of their team's games to qualify."`
- Category cards (`LEADER_CATEGORIES`, key → label): `ppg → "Points"`, `rpg → "Rebounds"`, `apg → "Assists"`, `spg → "Steals"`, `bpg → "Blocks"` — each card header also shows `"per game"` (uppercase, small)
- Top-leader row: player name link, `"{teamName} · {gamesPlayed} GP"`, big stat value to one decimal
- Ranked rows below: rank number, player name + `" · {teamName}"`, stat value
- Empty state: `"No completed games with player stats yet — leaders appear as soon as games are scored."`
- Footer privacy note: `"Player names on public pages show first name and last initial unless a parent has opted into full public names. Signed-in league and club participants see full names."`

---

## News index — `/news`
- Source files: `apps/web/src/app/(public)/news/page.tsx`, `apps/web/src/components/ui/news-card.tsx`
- Layout: `SectionHeader` followed by a responsive card grid (`NewsCard` per item) or an empty-state panel.
- Page metadata: title `"News & Game Recaps"`; description `"The latest youth basketball news: game recaps, club announcements, and league updates."`
- SectionHeader: eyebrow `"Around the hub"`, title `"News & Game Recaps"`, description `"Every scored game gets a story — plus announcements from clubs and leagues."`
- Empty state: `"No stories yet — recaps publish automatically as games are scored."` with `"← Back to the homepage"` link
- `NewsCard` fields: cover image (or a `play-100`→`hoop-100` gradient placeholder), date label + optional `"{author}"` joined by a middot, title, 2-line-clamped excerpt

## News article (AI recap) — `/news/[slug]`
- Source files: `apps/web/src/app/(public)/news/[slug]/page.tsx`, `apps/web/src/app/(public)/news/[slug]/admin-bar.tsx`
- Layout: Back link, an optional moderation `AdminBar` (only rendered for authorized managers), then a card with kind badge + date, title, hero image, body paragraphs, embedded video(s), extra image grid, and a row of context pill-links at the bottom.
- Back link: `"← All news"`
- Kind badge (recap posts only): `"Game Recap"` (tone `play`)
- Publish date format: `"EEEE, MMMM d, yyyy"`
- AI-recap footnote: `"Recap generated automatically from the official scoring record."`
- Bottom context pills: `"Box score & play-by-play →"` (→ `/live/{gameId}`), one pill per tagged team (team name), one pill per tagged club (club name), one pill for the league (league name)
- AdminBar (visible only to authorized managers — PlatformAdmin, the game's league owner, or a club owner/manager of either team):
  - Status line: `"Managing this story"` / `"Taken down"`, with sub-copy `"Only you and other story managers see these controls."` / `"Hidden from the public — only story managers can see this page."`
  - Buttons: `"Edit"`, `"Regenerate"` (recap posts only; busy: `"Regenerating…"`; confirm `"Overwrites any manual edits with a fresh AI recap. Continue?"`), `"Take down"` (busy: `"Taking down…"`; confirm `"Take this story down? It disappears from all public pages until restored."`) or `"Restore"` (busy: `"Restoring…"`) when already taken down
  - Edit mode fields: `"Title"` label + input, `"Body"` label + textarea, note (recaps only) `"Note: regenerating later will overwrite these edits with fresh AI copy."`, buttons `"Save changes"` (busy: `"Saving…"`) and `"Cancel"`

---

## Team chat — `/teams/[teamId]/chat`
- Source files: `apps/web/src/app/(platform)/teams/[teamId]/chat/page.tsx`, `apps/web/src/app/(platform)/teams/[teamId]/chat/team-chat.tsx`, `apps/web/src/components/chat/poll-bubble.tsx`
- Layout: Header row (team name link, `"{clubName} • Team chat"`, a `"Polls"` link) above a bordered chat card: optional pinned-messages strip, a collapsible members bar, the scrollable message list (day dividers, bubbles left/right by sender), an optional inline poll-composer panel, and a bottom composer bar (poll-toggle emoji button + text input + Send).
- Header: `"{teamName}"` (links to `/teams/{id}` staff-side or `/team/{id}` family-side), `"{clubName} • Team chat"`, `"Polls"` link → `/teams/{teamId}/polls`
- Members bar: toggle `"{n} member(s)"` / `"Hide ▴"` / `"Show ▾"`; mute toggle `"🔕 Muted"` / `"🔔 Mute"` (title `"Notifications are off for this chat"` / `"Mute this chat's notifications"`); expanded groups `"Staff — chat admins"` and `"Families"`; per-person `"(you)"` suffix for the viewer, `"Message"` button (busy state disabled) to start a DM, staff role label pill, family row shows `"{playerNames joined by ", "}"`
- Typing indicator: `"{name} is typing…"`
- Empty state: `"No messages yet"` / `"Say hi — coaches and families of this team can read and post here."`
- Loading state: `"Loading chat…"`
- Pagination: `"Load earlier messages"`
- Pinned strip: 📌 icon + `"{senderName}: {body}"` (truncated), `"Unpin"` control for moderators
- Message bubble chrome: sender name shown as `"You"` for the viewer or `"{name}"` for others (+ `" · {context}"` if any), `"STAFF"` pill badge for staff senders; hover actions `"Edit"` (title `"Edit message (within 15 minutes of sending)"`), `"Delete"` (own message) / `"Remove"` (staff moderating someone else's, title `"Remove message (staff)"`), `"Pin"`/`"Unpin"` (staff only), `"React"`; edited marker `"(edited)"`; timestamp `format(createdAt, "h:mm a")`
- Day dividers: `"Today"`, `"Yesterday"`, else `format(date, "EEEE, MMM d")`
- Reaction picker set: `👍 ❤️ 😂 🎉 🔥 🏀`
- Edit-in-place controls: `"Cancel"`, `"Save"` (busy: `"Saving…"`)
- Inline poll composer (staff, toggled by the 📊 button): heading `"📊 Quick poll"`, checkbox label `"Multiple choices"`, question input placeholder `"Ask the team something…"`, option inputs placeholder `"Option {n}"`, `"+ Add option"` (up to 6 options), submit `"Post poll"` (busy: `"Posting…"`)
- Composer bar: 📊 icon button (aria-label `"Post a quick poll"`), text input placeholder `"Message the team…"`, `"Send"` button
- Archived-team state: composer replaced by `"This team is archived — chat is read-only history."`; editing is disabled entirely for archived threads
- Poll message rendering: delegates to shared `PollBubble` (see below) — closed-poll pill `"Closed"`, option rows with fill bars, footer `"{n} vote(s)"` (+ `" · multiple choices allowed"`, + `" · tap to vote"` while open)
- Real-time behavior: `useRealtime` joins room `team:{teamId}`; a `typing` event shows the "is typing…" line for 3s; a `chat.message` event triggers an immediate `fetchNewer()` (delta fetch via `?after={lastCreatedAt}`, never merges the socket payload itself — API stays source of truth). A polling safety net also runs `fetchNewer` every 5000ms while disconnected or 60000ms while the socket is connected. New/updated poll vote counts arrive via the same delta fetch's `pollUpdates` array and are patched into existing poll bubbles in place.
- Rules worth demoing: edit window is a hard 15-minute cutoff mirrored client + server (`EDIT_WINDOW_MS`); polls can't be edited from the chat bubble itself (edits happen on the Polls page); staff can pin up to 3 messages (`.slice(0,3)`); archived teams keep full read-only history.

## Team polls — `/teams/[teamId]/polls`
- Source files: `apps/web/src/app/(platform)/teams/[teamId]/polls/page.tsx`, `apps/web/src/app/(platform)/teams/[teamId]/polls/team-polls.tsx`
- Layout: Header row (team name, `"{clubName} • Polls & surveys"`, `"Team Chat"` and `"Team Home"`/`"Team Page"` links) above a vertical stack of poll cards (each with question blocks + vote button), an optional create-poll form (staff), and an optional inline edit-poll form (staff).
- Header: `"{teamName}"`, `"{clubName} • Polls & surveys"`, links `"Team Chat"` (→ `/teams/{id}/chat`) and `"Team Home"` (staff) or `"Team Page"` (family) (→ `/teams/{id}` or `/team/{id}`)
- Staff-only `"New Poll"` / `"Cancel"` toggle button
- Empty state: `"No polls yet"` with sub-copy — staff: `"Ask the team something — tournament interest, practice times, jersey colors."`; family: `"When your coach or club posts a poll, it'll show up here."`
- Loading state: `"Loading polls…"`
- Poll card:
  - Title + status pill `"Open"` / `"Closed"`
  - Meta line: `"{createdByName} · {format(createdAt,"MMM d")} · {totalVoters} vote(s)"`
  - Optional description text
  - Staff controls: `"Edit"`, `"Close"`/`"Reopen"`, `"Delete"` (confirm: `"Delete "{title}" and all its votes?"`)
  - Per-question block: prompt text, meta `"{Pick any|Pick one} · {voterCount} voted"`, option rows with a proportional fill bar, vote count + `"{count} · {share}%"`, `"✓ your pick"` tag on the option(s) the viewer chose; staff additionally sees a truncated list of voter names under an option
  - Footer copy while open: `"You've voted — pick different options to change your answer."` or `"Tap an option to choose, then submit."`; vote button `"Vote"` / `"Update Vote"` (busy: `"Saving…"`)
- Create-poll form: `"Title"` (placeholder `"Tournament plans for August"`), `"Description (optional)"` (placeholder `"Help us plan the summer — answers close Friday."`), per-question block `"Question {n}"` with `"Allow multiple choices"` checkbox, `"Remove"` link, prompt input (placeholder `"Which tournaments should we enter?"`), option inputs (placeholder `"Option {n}"`, `×` remove per option once >2), `"+ Add option"` (max 12), `"+ Add another question"` (max 10), submit `"Publish Poll"` (busy: `"Publishing…"`)
- Edit-poll form (staff): heading `"Edit poll"`; once any votes exist, note `"Voting has started — wording and labels stay editable; questions and voted options are locked in."`; same field layout as create, with `"Remove"`/add-question controls disabled once locked (`title="Questions are locked once voting starts"`), voted options show `"{n} vote(s)"` and cannot be removed (title `"This option has votes — relabel it, but it can't be removed"`); buttons `"Cancel"`, `"Save Changes"` (busy: `"Saving…"`)
- Rules worth demoing: editing is unrestricted before any votes land; once a poll has votes, the question set and any already-voted option are frozen (only wording/labels stay editable) — enforced both client-side (disabled controls with title tooltips) and (per code comments) server-side.

## Chat poll bubble (shared component, rendered inside team chat)
- Source file: `apps/web/src/components/chat/poll-bubble.tsx`
- Fields/controls: question text next to a small bar-chart icon; `"Closed"` pill when not open; one button per option showing label, `"✓ your pick"` check badge (mine), `"🏆"` trophy on the leading option once closed, vote count + share `"{count} · {share}%"`, and a proportional fill bar (green `energy` tint for the viewer's own pick, gold `highlight` tint for the leading option when closed)
- Footer line: `"{n} vote(s)"` (+ `" · multiple choices allowed"` if `allowMultiple`, + `" · tap to vote"` while open)
- Behavior: single-choice taps replace the previous pick; multi-choice taps toggle (but the last remaining choice can't be un-toggled — `if (mine.size === 0) return`); voting posts to `/api/teams/{teamId}/polls/{pollId}/vote` and folds the response back into chat-bubble shape via `toChatPoll()`.

---

## Playoff bracket — operator ("Playoffs" tab) — `/manage/leagues/[id]/seasons/[seasonId]/manage` (tab=`playoffs`)
- Source files: `apps/web/src/app/(platform)/manage/leagues/[id]/seasons/[seasonId]/manage/page.tsx`, `.../manage/components/playoffs-tab.tsx`, `apps/web/src/lib/playoffs/generate.ts`, `apps/web/src/lib/playoffs/formats.ts`
- Layout: One panel per existing bracket (rounds of games in a responsive grid of link cards), followed by a "Generate playoffs" wizard panel (division picker → qualifying-team count → format cards → seed preview → date → generate).
- This tab is one of 11 season-management tabs, in order: `"Overview"`, `"Divisions"`, `"Venues"`, `"Sessions"`, `"Scheduling"`, `"Tiebreakers"`, `"Teams"`, `"Referees"`, `"Schedule"`, `"Standings"`, `"Playoffs"`.
- Existing-bracket panel:
  - Title: `bracket.label` (falls back to `"Playoffs"`)
  - Delete control (only while no games have started): `"Delete bracket"` — confirm `"Delete this bracket and its unplayed games?"`
  - Sub-copy template: `"{qualifying} teams · single games · later rounds appear automatically as results are finalized."` (+ optional plan notes appended)
  - Round headings: `"Round {n}"`
  - Per-game card: matchup label (from the plan, e.g. seed label) or fallback `"Game {slot+1}"`; a status `Badge` showing the raw game status text (`SCHEDULED`/`LIVE`/`COMPLETED`/etc., toned via `toneForStatus()`); home/away team name + score rows; formatted date/time; card links to `/live/{gameId}`
- "Generate playoffs" wizard panel:
  - Title: `"Generate playoffs"`
  - Gate copy when season isn't in progress/completed: `"Playoffs can be generated once the season is in progress."`
  - Intro copy: `"Pick a division and how many teams qualify — you'll only be offered formats that work for that number. Seeds come from the current standings."`
  - Fields: `"Division"` select (options are division names; a division that already has a bracket is disabled and suffixed `" (bracket exists)"`); `"Teams qualifying"` number input (2–64, placeholder `"e.g. 4"`); `"First round date"` date input
  - No-fit message: `"No formats fit that number — try a different qualifying count."`
  - Format option cards: label, optional `"Recommended"` badge, description, and `"{games} games · {rounds} round(s)"`
  - Seed preview heading: `"Seeds (current standings)"`; rows `"#{seed} {teamName} {record}"`
  - Submit button: `"Generate bracket"` (busy: `"Generating…"`); disabled until division + format + start date are all set
  - Errors surface inline in red text (server-supplied, e.g. `"Could not generate the bracket"` / `"Could not delete the bracket"`)
- Rules worth demoing: playoffs are single-game only (no best-of-N in this UI); the format menu is generated dynamically from the qualifying-team count (`/api/seasons/[id]/playoffs?divisionId=&qualifying=` GET); later rounds are NOT manually created — they populate automatically as earlier-round games are finalized; a division can only have one active bracket at a time.
- No public-facing bracket/series view exists — the public league hub (`/league/[id]`) only shows the season's `playoffFormat` as a text line and links directly to individual playoff games; there is no dedicated public bracket page in this codebase.

---

## Screens not found / notes
- No dedicated public playoff bracket display exists anywhere in `apps/web/src/app/(public)` — searched via `grep -ril bracket` across the app; only the operator wizard (`playoffs-tab.tsx`) renders bracket/round structure. The public homepage's mention of "Standings & playoff brackets" (`app/(public)/page.tsx` line 853) is marketing copy, not a real screen.
- `apps/web/src/components/demo/scenes-league.tsx` and `scenes-features.tsx` reference playoff/bracket imagery but are dead marketing-demo code per project memory ("components/demo/* unused code awaiting deletion") — excluded from this inventory as not-real-product screens.
- `apps/web/src/components/scoring/game-referee-control.tsx`, `game-scorekeeper-control.tsx`, and `league-scoring-settings.tsx` exist alongside the scoring console but are not imported by `/games/[id]/score` or `/live/[gameId]` — they belong to team/league management surfaces outside this brief's scope and were not transcribed.
