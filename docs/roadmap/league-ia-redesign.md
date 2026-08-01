# League Console IA Redesign — the honest audit (2026-07-30)

> Owner verdict on the current console: "honestly this is getting messy… settings should be in one place… Games is not a clear tab… standings don't belong under games… naming is inconsistent… people should never enter things that will be duplicated."
> Status: **BUILT 2026-07-30 (local; box deploy pending — runbook #41).** §8 is the build log. Companion state: memory file `project_league_ops_2026_07_29.md`.

## 0. Why it got messy (honest diagnosis)
The 12 tabs accreted one per feature as features shipped. The five section headers added 2026-07-29 were a *grouping of what existed*, not a design: "Games" is a junk-drawer label; settings ended up in THREE places (Registration›Settings, Playoffs›eligibility, Scheduling›game-day policies) because each rule was parked "near its feature"; Standings sat under Games because data-wise standings derive from games — but a commissioner experiences standings as an *output to monitor*, not a place to work. The root mistake: organizing by DATA TYPE instead of by the operator's JOB and the season's PHASE.

## 1. The organizing principle
A season is a pipeline: **Set up → Open registration → Review & approve → Close → Schedule → Play → Playoffs → Wrap up.** The commissioner's question at any moment is "what do I do next, and what's blocking me?" So:
- **Work surfaces** (places you DO things) get tabs.
- **Settings** (things you decide once) live in ONE place, sectioned.
- **Outputs** (standings, reports) are views, clearly separated from work.
- **Every gated action shows its unlock path** ("Generate schedule — blocked: registration still open; 1 team pending review").

## 2. Proposed structure — FLAT, no submenus (owner ruling 2026-07-30)
**Owner rule, adopted:** submenus hide things; only combine what is genuinely setup-related (Settings — the one grouping label everyone understands); every job gets a flat, self-describing top-level label. No second-level navigation ANYWHERE — within a tab, content is stacked visible sections on one scrollable page (anchors if long), never sub-tabs.

Flat row: **Overview · Clubs · Teams · Schedule · Standings · Playoffs · Referees · ⚙ Settings**

| Tab | Contents (stacked sections, all visible) |
|---|---|
| **Overview** | Needs-attention · Season checklist (§3) · Season report |
| **Clubs** | entries (approve/decline, applications) · club blast · per-club rollups |
| **Teams** | applications triage · roster-change queue + policy |
| **Schedule** | capacity math IN WORDS at top · sessions & venues (editable) · generate & review |
| **Standings** | standings view (output) |
| **Playoffs** | brackets/ops (settings live in Settings›Rules) |
| **Referees** | pool · shifts · settlements |
| **⚙ Settings** | ONE scrollable page: Basics (label/dates/deadline/fee/deposit) · Registration (questions, club agreement) · Game format (periods/lengths/slots) · Rules (playoff min-games, guests, roster policy, tiebreakers) · Divisions (structured editor §4) |

Diagnosis correction: the original 12-tab overload was a MISCLASSIFICATION problem (five tabs were settings pretending to be jobs), not a hierarchy problem — grouping into submenus treated the symptom and hid the cure. Future tabs must be recurring JOBS with self-describing names; decisions → Settings, outputs → Overview/views; row stays ≤9.

Migration: tab keys become flat; `?tab=` redirect map (divisions/venues/sessions/scheduling/tiebreakers→settings anchors, clubs/teams unchanged, schedule→schedule, standings/playoffs split, regsettings→settings#registration).

## 3. The Season checklist (mistake-proofing engine)
An ordered, always-visible list on Overview; each step = done ✓ / actionable → / **blocked (with the reason and a link to the unblocking step)**. Derived from data, no stored state:
1. **Season basics set** — dates, fee, deposit. Blocked-by: nothing.
2. **Divisions created** — ≥1 division. 
3. **Venues allocated & sessions built** — every session day has a venue with courts.
4. **Registration configured** — questions + club agreement (optional but nudged).
5. **Registration OPENED** — action lives here (status change w/ confirm).
6. **Clubs & teams reviewed** — 0 pending entries/applications; fees tracked.
7. **Registration CLOSED** — blocked while pending applications exist (today this is silently allowed → becomes a hard gate with an override).
8. **Schedule generated** — blocked until: closed + every division ≥2 teams + capacity ≥ required (planner numbers shown right here).
9. **Season FINALIZED / underway** — existing preflight becomes this step's detail view.
10. **Playoffs** — blocked until eligibility data exists (games played).
The existing finalize-preflight already computes half of this; the checklist is its generalization and becomes the ONLY place status-advance buttons live (fixes "Close Registration floating in the header, one click from disaster").

## 4. Naming strategy — DERIVED, NEVER TYPED (owner ruling)
**Rule: humans pick structure; the system composes every name. Nobody types "Burlington Force U19" anywhere.**
- **Divisions:** identity = `ageGroup` (picker: U9–U19 / Grade N) + `gender` + `tier` (int). Display name is ALWAYS composed: "U15 Boys · Tier 1". The free-text `name` field goes read-only/derived (kept in DB for legacy rows; editor stops offering it). Fixes "sometimes Tier 1 is in the name, sometimes a dropdown."
- **Teams (club side):** club creates a team by picking ageGroup (+gender). Display name = `{Club shortName} {ageGroup}` — "Burlington Force U15". Club sets `shortName` ONCE on club settings (default: club name). Multiple teams in one bracket → auto-suffix picker (Blue/White/Black or 1/2) — still a pick, not typing. `Team.name` becomes derived; DB column stays (filled by composer) so nothing downstream breaks; legacy names shown until a club touches the team.
- **Season entries/submissions:** division placement is structured pickers only (already true).
- **Why it matters:** kills duplicates/typos, makes standings/schedules read uniformly, and lets NPH trust cross-club sorting.
Schema: `Tenant.shortName String?`, `Team.nameSuffix String?`; composer in `lib/teams/naming.ts` used by every create/edit surface + backfill script.

## 5. Fix list from this owner pass (concrete defects)
1. **Venues not clickable/editable in season setup** — season venue rows: click → edit allocation (courts available, per-season hours) + link to the global venue page. Today they're inert text. 
2. **Division editor only edits free-text name** — replace with structured editor per §4 (age/gender/tier/maxTeams); name display derived.
3. **Schedule tab confusion** — add the capacity planner summary AT THE TOP in words: "You need N game slots (T teams × G games ÷ 2). Sessions currently provide M. ✓/✗" with per-session breakdown, before any generate button.
4. **Settings scattered in 3 places** — collapse per §2.
5. **"Games/Standings" mislabel** — per §2.
6. **Status buttons** — move into checklist context (§3); keep confirms.

## 6. Actions × prerequisites matrix (the "can't make a mistake" contract)
| Action | Requires first | On violation today | Target |
|---|---|---|---|
| Open registration | basics + ≥1 division | allowed silently | checklist gate w/ reason |
| Club enters season | registration OPEN | 409 (ok) | same + friendly page state |
| Approve team | division assigned (or assign-at-approval) | allowed w/o division | approval dialog asks for division inline |
| Close registration | 0 pending apps | silent | gate + "review 2 pending first" link |
| Generate schedule | closed + ≥2 teams/div + capacity OK | preflight 422 list | same checks, shown BEFORE clicking |
| Finalize | schedule exists + preflight | preflight (good) | unchanged, surfaced in checklist |
| Playoffs generate | IN_PROGRESS + standings data | allowed early | gate on games played |
| Renew season | any | fine | unchanged |
| Delete/withdraw anything | — | confirm dialogs (done) | unchanged |

## 7. Sizing (fresh session, suggested order)
1. Settings consolidation + tab rename/regroup + redirect map — **M** (mostly moving existing components).
2. Season checklist on Overview (generalize preflight; move status buttons) — **M**.
3. Derived naming (composer + division editor + team create/edit + shortName/suffix + backfill) — **M-L**, touches club-side too.
4. Venue row editability + capacity words on Schedule tab — **S-M**.
Recommend shipping 1+2 together (the "it finally makes sense" moment), then 3, then 4.

## 8. Build log — 2026-07-30: ALL FOUR PHASES BUILT (local, one pass)
Owner said "resume the league IA redesign" in the fresh session; v2 rulings above were treated as the sign-off. Everything below is local + pushed to GitHub only — box deploy pending owner approval (runbook #41).

**Shipped:**
1. **Flat nav** (§2) — 8 tabs exactly as ruled; two-level TAB_GROUPS deleted. Legacy `?tab=` keys remap (divisions→Settings#divisions, scheduling→Settings#game-format, tiebreakers→Settings#rules, regsettings→Settings#registration, venues/sessions→Schedule) with smooth-scroll to the section anchor; in-app links only ever used clubs/teams, which are unchanged.
2. **⚙ Settings one page** (§2) — stacked visible sections w/ jump row: Basics (new — label/dates/deadline/fee, editable in-console for the first time) · Registration (deposit + questions) · Game format & scheduling (settings grid + philosophy + groups) · Rules (playoff eligibility + format/teams-advancing + guests + tiebreakers) · Divisions.
3. **Season checklist** (§3) — `season-checklist.tsx` on Overview; 12 derived steps, each done/actionable/blocked-with-reason; ALL status buttons moved here (header button deleted; other tabs get a subtle "Season checklist" link). Close-registration gate: pending reviews block the primary button, "Close anyway" override stays. Finalize preflight renders inline in its step. Old OverviewTab slimmed to the COMPLETED close-out card.
4. **Derived naming** (§4) — `lib/teams/naming.ts` (AGE_GROUPS, TEAM_NAME_SUFFIXES, composeDivisionName, composeTeamName). Schema: `Tenant.shortName`, `Team.nameSuffix` (pushed local). Division POST/PATCH compose the name server-side and reject duplicate structure (409); the editor is pickers-only w/ live name preview. Team create/edit forms lost the name input — age group + suffix chips + "Team name (written for you)" preview; APIs compose from club shortName (fallback full name) and 409 on collisions with a suffix hint. Club settings gained Short Name. `scripts/backfill-division-names.ts` recomposes existing division names (ran locally: 8/16 rewritten); team names stay legacy until touched (ruling). NPH seed updated to composed division names.
5. **Fix list** (§5) — venue rows: added "Venue page ↗" link (edit-in-place already existed); capacity math in words at the top of Schedule (`capacity-words.tsx`: "You need N slots … sessions provide M ✓/✗"); Standings/Registration copy now points at Settings › Rules.

**Deviations from the blueprint (deliberate):**
- Checklist step order follows the real state machine: Finalize comes BEFORE "Schedule generated" (§3 listed schedule at 8, finalize at 9 — but commit requires FINALIZED). Blueprint's blockers all shown on the schedule step.
- Roster-change policy stayed with the queue on Teams (§2 listed it in both places; the Teams row won).
- Sessions & venues live on the Schedule tab per the §2 table (the §2 migration line said settings anchors — the table won).
- No hard server-side gate on close-with-pending: UI gate + explicit override, server unchanged (an override-capable gate server-side would be a no-op).

**Verification:** tsc clean · eslint clean · unit suite: no new failures (9 pre-existing, confirmed on clean tree) · integration suite + Playwright walkthrough: see session notes.

## 9. Tune-up round — 2026-07-30 evening (owner walkthrough feedback, all built)
Owner verdict on v1 of the build: Settings page too long/undifferentiated · Schedule tab confusing, no clear "can I generate?" signal, no whole-season-vs-session-by-session choice · sessions not editable and silently absorbing every court · registration = two settings drowning in text · org not navigable.

**Shipped:**
1. **Settings v2** — status strip up top (✓ configured / ! needs attention / ○ optional, chips double as jump links), sections reordered by importance (Basics → Divisions → Registration → Game format → Rules), prose cut to one-line hints.
2. **Registration compact** — "Deposit required" checkbox + %, and a NEW "remaining balance due N days before start" setting (`Season.balanceDueDaysBeforeStart`, default 14; wired into the approval-time obligation dueDate + description).
3. **Sessions editable + per-session courts** — sessions API grew PATCH (label/days/venues replace) and a `venues: [{venueId, courtIds}]` selection; the UI has Edit per session and a court picker where selected courts carry a preferred order (up/down). Sessions list shows "Venue: Court 1 → Court 2" and badges PLAYOFF-phase sessions.
4. **Court-preference scheduling** — `SeasonSessionDayVenueCourt.order` (additive); scheduler sorts slots day-by-day, preferred court's timeline first, so games pack court 1 and overflow down the list (legacy order-0 rows keep the old pure-time sort).
5. **Schedule tab v2** — readiness banner answers "can you generate the season right now?" in words (status + capacity + thin divisions); then THE mode question: "Session by session (most leagues)" vs "Whole season at once". Session mode: session chips (committed count/empty), capacity card scoped to the chosen session, preview/commit scoped via new `sessionIds` on preview/commit APIs — commit only replaces SCHEDULED games in that session, and the generator seeds from committed games elsewhere (matchups rotate, per-team demand = the session's share; verified: 8-team Fall league previews 8 games per session, not 48).
6. **Org navigable** — league owners get their Organization(s) as first-class sidebar/drawer entries (platform layout queries orgs via owned leagues).

**Verified:** tsc/lint clean · scheduler unit 34/34 · int 363/363 · unit: zero new failures · Playwright 13/14 + screenshot proof of the 14th (cold-compile race) — `scripts/demo/verify-league-tuneup.mjs`, shots /tmp/league-tuneup-verify.

## 10. Build log — Phase A (org season defaults) SHIPPED 2026-07-31 (local)
Approved plan (Schedule Studio rebuild) Phase A: the org rulebook, built first.
- Schema: `Organization.seasonDefaults Json` + Season "unset semantics" (gameSlotMinutes/gameLengthMinutes/gamePeriods/idealGamesPerDayPerTeam/defaultVenueOpen-CloseTime/schedulingPhilosophy/allowGuestPlayers now nullable; null = inherit). Season-create API no longer freezes system defaults into new rows.
- `lib/org/season-defaults.ts`: zod shape + `effectiveSeasonConfig` (season → org → system w/ provenance map) + `applyEffectiveConfig`. Consumers: getPublicSeason (console/public/mobile see effective values + `configSources`), scheduler load.ts, approval-time fee obligation (teamFee/depositPct/balanceDueDays all inheritable), guests gate.
- Org settings UI: "Season defaults" editor (cycle dates · games & format · money · rules · registration). League Settings: fully-inherited sections render read-only summaries ("Inherited from NPH · Override for this league"), overridden sections get the gold "Overrides org defaults · Reset to organization" bar; status strip gains the "Inherited ✓" state. Season create form prefills org cycle dates.
- Verified: tsc/lint clean · resolver unit 7/7 · int suite 366/366 (new seed 1137: provenance via season GET, approval obligation from org money defaults, scheduler on effective config) · Playwright 9/9 (verify-org-defaults.mjs; screenshots /tmp/org-defaults-verify) — org save → override bars → Reset→inherited summary → Override reopens form.
- Next per approved plan: P0 studio foundations (conflicts helper, isLocked enforcement, draft/publish layer, swap+validate endpoints, fairness cycle-tiering, division-at-approval fixes).

## 11. Owner feedback round 2026-07-31 evening — all three built (local)
1. **Settings grouped by governance**: org-linked leagues render the rulebook sections FIRST under a "{org} rulebook — inherited; override only where this league differs" header (Registration · Game format · Rules), then a "This season only" divider before Basics · Divisions. Status strip reordered to match.
2. **Structured application questions**: `lib/registration/questions.ts` (zod union: legacy strings OR {label, type: text|long_text|single|multi, options, required} + normalizeQuestions/answerToText/answerMissing) · shared `components/question-builder.tsx` (label input, type select, options chips, required, reorder) used by BOTH the org rulebook editor and league Registration settings · entry form renders by type (input/textarea/radios/checkboxes, required honored) · entries POST accepts string|string[] answers · Clubs-tab viewer normalizes labels + joins multi answers · NPH seed gains a single-choice demo question.
3. **Org → league navigation**: org page league rows now link to the real league hub (/manage/leagues/[id], name + "Open league →"); Customize demoted to a small "Branding" link.
- Bug class closed while testing: TWO more raw applicationQuestions readers (club entry page + entries GET) now resolve season→org→system — an org-defined question set reaches the entry form and the application viewer.
- Verified: tsc/lint clean · int 366/366 · lib unit 251/251 · Playwright 8/8 (scripts/demo/verify-owner-feedback-3.mjs, shots /tmp/feedback3-verify).

## 12. 2026-07-31 late — dates + fee join the rulebook (owner: "why not inherited?")
- Season start/end/registration-deadline are now LIVE-inherited from the org cycle (resolver ORG_KEY maps startDate→cycleStartDate etc.); season PATCH accepts explicit nulls to reset dates to inheritance. Team fee moved OUT of Basics into the Registration section (it was already inheritable — the UI misplaced it; summary line now leads "$3,990 team fee · 50% deposit…").
- Basics = label (always season's own) + season-window summary "Inherited from NPH · Override" (or full date pickers when overridden); saving the label never freezes inherited dates. Status chip: "Basics · Dates inherited from NPH".
- Effective dates wired into every LOGIC/DISPLAY reader found: submit-team deadline gate, approval balance-due (uses effective startDate), getLeaguesDirectory (covers web /leagues + mobile browse leagues), mobile season detail (already via getPublicSeason). Season-create prefill removed (copying would freeze overrides; empty = inherit).
- Seed: Showcase drops its typed dates (equal to the org cycle) → Basics inherits end-to-end. UTC-midnight date display bug fixed (format in UTC).
- Verified: tsc/lint clean · resolver unit 8/8 · int 366/366 · Playwright checks + screenshot (Basics "Season window … Inherited from North Pole Hoops", fee in Registration, chip "Dates inherited").

## 13. 2026-07-31 — scheduling explained + the 10/5/2 norm (commit 20975b3)
- Owner walkthrough of scheduling surfaced three rounds of fixes:
  - Dead `Season.targetGamesPerSession` removed from UI/save; the console now SHOWS the derived math ("≈ 2 · 10 games ÷ 5 sessions") and the real per-session override is `Session.targetGamesPerTeam` (editable in the session form, "auto" placeholder; sessions API GET/POST/PATCH carry it).
  - Engine: the per-session share is a HARD block in all modes — whole-season generation was packing a team's full slate into weekend 1. And `idealGamesPerDayPerTeam` is now a hard cap in the first placement pass (slots are day-major; the old −5 soft penalty could never stop day 1 absorbing everything) with a relaxed second pass so single-day sessions never strand games. Philosophy A/B fixture got ideal=3 headroom (it tests philosophy scoring, not the cap); 2 new pinned cap tests → scheduler suite = 36.
  - Demo world reshaped to the NPH norm (owner ruling): org rulebook `gamesGuaranteed: 10`; Fall = 5 Sat+Sun weekend sessions labeled October–February, snapped to real Saturdays.
- End-to-end receipt on Fall 2026 (whole-season commit): 40 games · 10/team · 2/team/session · 1/team/day · 20 Sat + 20 Sun · 9 a.m. starts · TeamCheck "Every team has 10 games". Scheduler 36/36 · int 366/366.
- NOT yet on the box (deploy needs owner go-ahead; box also needs a reseed for the new world shape).

## 14. 2026-07-31 — draft→publish + preview visibility + capacity refresh (commit c8fe25d)
Owner round: "capacity not calculated correctly / should refresh on save; see the teams' games in preview; save then publish as a new step."
- **Draft→publish layer built (Schedule Studio P0 slice)**: `Game.publishedAt` (null = draft). Commit saves drafts SILENTLY — the old per-commit fanout emailed every family on EVERY commit (session mode = 5 blasts/season). `POST /api/seasons/[id]/schedule/publish` stamps drafts + sends the single club/team-circle fanout. Game reschedule/cancel/forfeit notifications gate on published; playoff-created games auto-publish; NPH seed stamps demo games (scoped to demo owners so a box reseed can't publish a real operator's drafts).
- **16 public surfaces filter drafts** via shared `PUBLISHED_GAME` (lib/games/visibility.ts): scores, public league page, ICS calendar feeds, mobile browse, live ticker, team page + team calendar/practices, dashboard, home cards, feeds/digest, club profile, RSVP sweep, my-calendar, score-console picker. Console schedule GET had NO auth — now league-owner/platform-admin only.
- **UI**: gold draft banner + "Publish schedule · N new" + Draft badges (list + TeamCheck) + commit copy "Saved as a DRAFT" + checklist step 10 "Schedule published" (13 steps).
- **Preview shows team games**: TeamCheck folds previewed proposals into the per-team checkmarks (survivor games + proposals, "Showing the preview — nothing is saved yet"); preview API enriches venue/court names.
- **Capacity staleness**: the card's fetch depended on `sessions.length` — editing courts/hours never refetched (the "3 courts × 12h ≠ 96" bug). Now refetches on every sessions change; the endpoint always computed fresh.
- Verified: int 368/368 (commit int test rewritten: silent commit → one publish fanout) · unit 307/307 · Playwright receipt (preview TeamCheck → 40 drafts, public upcoming 0 → publish → 0 drafts, games live, checklist ✓). Box deploy pending (#50: db push + backfill-publish-games.ts + reseed).

## 15. 2026-07-31 — venue/court/session flow redesign (owner: "think about the entire UX")
Owner round: sessions absorbed every court; venue add needed post-hoc court editing; "why session start/end times?"; "why checkboxes with no defaults?"; "what's added first?"; drift when venues/courts change.
- **Model (now explicit in the UI): venues + courts are the season's SUPPLY, sessions CONSUME it.** Panels reordered: Venues & courts first, Sessions second, Generate third.
- **One-step venue setup**: picking a venue opens a setup card — "Courts you'll use" (missing ones auto-created as Court 1…Court N, renameable later; count stored as SeasonVenue.courtsAvailable = the season's default court set) + "Scheduling hours" (written to SeasonVenueHours all 7 days; drives the session form's date-pick prefill) + "Add these courts to all N existing sessions" (default ON).
- **Propagation**: lib/seasons/venue-propagation.ts — sessions missing the venue get a dayVenue (window = the day's existing window, else venue hours) + default courts in order; sessions already using it are untouched. Venue rows show "used by X of Y sessions" with one-click "Add to the other N" (POST venues/propagate). Removing a venue cascades out of every session (count shown in confirm; games can't exist while unlocked so nothing breaks).
- **New sessions start with every season court ON** (first courtsAvailable per venue, fill order) — trim, don't build. SessionsTab's private venues fetch REMOVED (could fail once on cold compile → form venue-less forever); it now shares the page's venues fetch with VenuesTab (one source).
- **Session hours kept** (the scheduler's per-day window — a permit can be narrower than venue hours) but explained: they prefill from venue scheduling hours on date pick; helper text says adjust only if the booking differs.
- Verified: tsc/lint clean · int 368/368 · API drive (attach w/ courtCount 3 → Court 1-3 auto-created + 7 sessions picked up · session courts "Court 1 → Court 2 → Court 3" · remove → 14 day-rows cascaded, 0 refs left) · screenshots (setup card, coverage lines, form defaults ON — 21 pre-checked).

## 16. 2026-07-31 — realistic league size + slot rotation + repeat variety + repair pass
Owner round: research NPH league sizes; "not everybody gets a 9 am game all the time"; "which teams you play twice shouldn't be constant"; cross-league = restrict per-league venue windows (owner ruling — NOT solved in engine).
- **Research**: NPH Showcase League = grades 7–12, 5 sessions + finals, ~$3,950/team (northpolehoops.com) — matches our demo structure; youth divisions typically run 6–12 teams. Demo Fall league grown 8 → **20 teams (10/division)**: every FALL_READY club fields both grades + four "White" second squads, fresh correctly-aged rosters, fees/obligations included.
- **Time-of-day rotation (deterministic, not random)**: every slot gets a 0..1 position within its day's tip-off list; teams accumulate their games' positions (history via existingGames.scheduledAt + placed games); scoring steers early slots toward late-skewed teams. Receipt: late-team overlap Oct→Nov 0/6, Nov→Dec 0/6, Dec→Jan 1/8, Jan→Feb 2/8 (no rotation = identical set every weekend).
- **Seeded rematch variety**: `varietySeed` (hash of seasonId, load.ts) rotates which rounds the partial last cycle takes — 8 teams × 10 games repeats DIFFERENT 3 opponents per season; preview == commit within a season (no true randomness, per owner's cross-league concern).
- **Repair pass**: pair-pool greedy could strand two under-target teams with no unused pairing (20-team world: sessions placed 20/19/19/18/17 → 93 games, teams at 10/9/8). After the relaxed pass, the engine now synthesizes make-up pairings between under-served teams (fewest prior meetings first, hard constraints kept, strict-then-relaxed day cap). Receipt: 5×20 games, 100 total, every team 10. Whole-season commits also seed existingGames now (played/live survivors count toward guarantees + matchup history — latent gap closed).
- Scheduler suite 38/38 (2 new pinned: seeded variety fairness, morning-goes-to-late-skew) · int 368/368 · unit 309/309.

## 17. 2026-07-31 — Shuffle: operator-facing variations (owner: "give them an option to randomize")
- Regenerating the SAME season reproduces the same plan by design (preview must equal commit; support/debugging; no uncoordinated randomness across leagues). The variation lever is now explicit: **Shuffle** button next to Preview rolls deterministic variation #1, #2, … (`varietyShuffle` param → seed offset); a chip shows the active variation with reset. Commit sends the same number the preview used — the plan shown is the plan saved.
- Receipt (API, Fall 20-team world): standard preview ×2 identical · variation 1 ≠ standard · variation 1 ×2 identical · variation 2 ≠ variation 1.

## 18. 2026-07-31 — shared venues: schedule around other leagues, never double-book
Owner ruling: leagues manage their own windows; when a second league lands on the same courts by mistake → most flexible handling, not a hard stop.
- **Engine**: `busyCourtBookings` on SchedulerInput — other leagues'/seasons' games (any status but CANCELLED, drafts included, plus season-less games) on this season's courts within its date range become hard court bookings the generator schedules AROUND. loadSchedulerInput queries them automatically, so preview/commit/capacity all see the same picture.
- **Awareness, both places**: generator warning "N slots already booked by other leagues at shared venues — scheduled around them"; capacity card excludes them from supply and shows an amber "· N taken by other leagues" so a squeezed operator knows to add hours or courts.
- Receipt (planted a foreign game on Fall's Oct 10 court, 9:00–10:30): warning fired · 0 games placed in the occupied window · October capacity 96→95 with blockedByOthers 1 · all 100 games still placed. Scheduler suite 39/39 (new pinned test), int 368/368.

## 19. 2026-08-01 overnight — Schedule Studio P0 foundations COMPLETE (+2 wishlist defects)
The approved plan's P0 backend layer, unblocking the P1 drag-and-drop board:
- **lib/games/conflicts.ts**: one shared placement-conflict check (game PATCH + swap + validate). Team double-booking now checked across ALL seasons, court double-booking across ALL leagues (was: same-season only — cross-league court clashes slipped through manual moves).
- **isLocked = PINNED**: commit creates games UNLOCKED; the operator's "Pin in place" survives regeneration (deleteMany skips locked; survivors feed the engine as bookings — court time, team time, day caps, session shares all respected). PATCH refuses to move a pinned game (409 GAME_LOCKED) unless the same request unpins; the console offers that inline. ⚠️ Box needs one-time `UPDATE "Game" SET "isLocked"=false WHERE status='SCHEDULED'` (old commits locked everything).
- **POST /api/games/swap**: atomic two-game place-swap, both landing spots validated, locked/played games refused.
- **POST /api/seasons/[id]/schedule/validate**: dry-run a placement → ok/conflicts (the future board's hatching + manual-add check).
- **Hard fairness tier**: "play EVERY team before you play anyone again" is now engine-enforced (per-unit minimum-meetings gate in scoring; rematches hard-blocked while any first meeting waits). Was only a soft −3 penalty that clustering bonuses could outvote.
- **Division guards**: approving a team without a division = 400 (divisionId settable in the same call); deleting a division with teams = 409; finalize preflight blocks "N approved teams have no division" (such teams were silently never scheduled).
- **Wishlist defects**: D-004 referee calendar no longer hidden behind the "No teams yet" gate (empty = no teams AND no items); W-001 box-score leader line DReb/OReb → DREB/OREB (table headers were already CSS-uppercased).
- Verified: scheduler 41/41 (2 new pinned: first-meetings-before-rematches, pinned-survivor avoidance) · int 372/372 (+4: division guards ×3, pinned-game regeneration, locked-move 409) · unit 312/312 · tsc/lint clean.

## 20. 2026-08-01 — hotfix: whole-season 87/13 (owner repro on box)
- The overnight always-hard fairness gate cornered the whole-season endgame: rematches stayed blocked while the leftover first meetings were themselves unplaceable (caps/bookings), stranding 13 of 100 games. Gate is now hard in the STRICT pass only — relaxed/repair passes may book rematches to fill counts (diversity scoring still prefers first meetings). Repro'd 87/13 locally → 100/0 after fix; 10/team · 2/session; matchup quality equal to session-by-session runs (87 unique pairs, 12 rematch pairs). Scheduler 41/41, int 372/372.

## 21. 2026-08-01 — rematch law + spacing (owner ruling on the fairness rule)
Owner: rule NOT removed — clarified. "For sure not the same session; preferably as far apart as possible; even next session is odd."
- **Hard law**: the same matchup never happens twice in one session (2-team divisions exempt — nobody else to play). Enforced in every pass; seeded from existing games so session-by-session runs respect prior weekends.
- **Spacing**: strong soft score pushes the two meetings apart (full penalty inside ~5 weeks, fades beyond). Fall receipt: rematch gaps now 29–126 days (was: could be adjacent or same weekend).
- **Fairness gate corrected**: hard in BOTH main passes (the hotfix's relaxed-pass lift let cycle-2 rematches starve a team's unmet first meetings); the repair pass bypasses it — its own fewest-meetings-first ordering keeps the intent.
- **Repair ladder** (zero-slack seasons like 10 games = 5×2 share are sometimes unsatisfiable for a greedy): strict → relaxed day cap → last resort (same-session rematch and/or third weekend game allowed) → bonus game (a full team plays guarantee+1 so nobody ends short). EVERY concession warns explicitly ("no other room — add a session or court time"). Shuffle variations often avoid the corner entirely. Swap-chain solver (Studio P2) will retire the ladder.
- Fall receipts (both modes): 100 games, 10/team, 1 same-session rematch (warned), gaps 29–126 days. Scheduler 41/41 (fixtures gained sessionCount; zero-slack pins made honest), int 372/372, unit 312/312.

## 22. 2026-08-01 — minimal-disruption recovery: Fill the gaps (owner: dropouts/additions)
Owner: "one team drops out of 10 — minimize the changes so people aren't affected."
- **`fillGapsOnly` mode** (preview + commit): the ENTIRE current schedule is fixed (every game becomes a booking); the generator only ADDS games for teams under their guarantee, into freed/spare capacity, all laws intact (session share, same-session rematch, spacing, day caps). replaceExisting forced off — removed is always 0.
- **UI**: amber callout on the schedule tab whenever approved teams sit under the guarantee ("9 teams are below the 10-game guarantee — usually a dropout, a late-added team, or a new make-up session" + names/counts) with "Preview the fix" (TeamCheck shows the would-be state over ALL existing games) and "Add ONLY the missing games — nobody's existing games move." New games arrive as DRAFTS → one publish notifies.
- **The chain for a dropout**: withdraw (existing G4 cascade cancels future games + notifies opponents) → callout appears → fill → publish. Team added late / make-up session after a snow-out: same mechanism (under-guarantee teams + new capacity).
- Receipts: int test (kept games byte-identical, removed=0) · Fall e2e: 100 games → Burlington Force withdraws (10 cancelled) → fill: **90 untouched, 0 moved, 5 added**, every team back to 10, no new same-session rematches. int 373/373, unit 312/312.
- Open policy decision (owner): a withdrawn team's PLAYED games currently stay in standings; common alternatives = expunge if <half season played, or forfeit-out remaining. Also: refunds/fee handling on dropout unchanged (existing overdue/accounting flows).

## 23. 2026-08-01 — descriptive scheduling failures (owner: "exactly what to fix")
- Every unplaced pairing is now DIAGNOSED: the engine re-scores it against every slot, tallies the hard blockers, and translates the dominant one into an operator action — e.g. "every court is booked at those times — add a court to the sessions or extend their hours", "the teams already play their full share those weekends — raise a session's games-per-team or add a session", "these teams already meet in every session that has room — add a session so the rematch lands elsewhere". 13 mapped reasons; a season-level summary warning leads with the top fixes ("18 games could not be placed: …; also: …").
- Preview UI already renders both (warnings list + per-pairing reasons under "couldn't be placed") — no UI change needed.
- Box reseeded on owner request: canonical 4 demo venues restored; verified ON BOX with default venues — whole-season preview 100 games / 0 unscheduled.
- Suite 41/41 (slot-exhaustion test re-pinned to diagnostic strings), int 373/373, unit 312/312.

## 24. 2026-08-01 — trade-offs are not errors (owner pasted the exact "error": concession warnings)
- Root cause of the confusion: the repair ladder's concession messages ("2 games exceed a session's per-team share — there was no other room…") rendered in the same amber warnings list as real failures — the season had actually placed 100/100. Sweep across 9 variations showed the concession is STRUCTURAL to the 4-venue/8-court layout (identical trade-offs every seed), so "try Shuffle" advice would be false; the honest fixes are the stated ones (court time / a session), or the Studio P2 swap solver.
- **SchedulerResult gains `tradeoffs[]`** — "things the engine did to make everything fit": over-share games, same-weekend rematches, bonus games, scheduled-around-other-leagues. Reworded to lead with success ("To fit every game in, …"). Preview renders them in a neutral ink panel titled "How it fit together — nothing failed", ABOVE the amber warnings which now only carry real problems (unplaced games w/ diagnosis, teams under target).
- Receipt: seeded Fall preview shows "Preview: 100 games" + the info panel + green TeamCheck. Scheduler 41/41 (2 pins moved to tradeoffs), int 373/373, unit 312/312.

## 25. 2026-08-01 — augmenting-chain relocation: the trade-offs were never necessary (owner: "96 slots and no room? investigate")
Owner rejected the "structural" explanation — correctly. Root cause: the greedy fills weekend shares ASYMMETRICALLY (sessions ended 22,19,19,20,20); the repair ladder then conceded (extra weekend game / shared-weekend rematch) because placing the missing games was blocked by SHARE alignment, not by court capacity — 76 slots sat free in the short sessions.
- **Fix: transactional augmenting-chain relocation** (the Studio P2 swap solver's core, arrived early). Runs after the relaxed repair mode, before any concession: session-level search (5 nodes, not 480 slots) finds a chain of between-session game moves that realigns shares — a game is lifted OUT first (its departure frees the room the chain needs downstream), destinations with blocked shares recursively evict their blocker (depth ≤4), every branch is undo-logged and rolls back on failure so a partial chain can never corrupt the board. Slot choice only materializes at the end.
- Journey (all reproduced live): slot-level depth-1 → useless; slot-level recursive → budget explosion (500k calls, nothing); session-level non-recursive-moves → zero branches; remove-first recursive chains → **20,20,20,20,20, zero trade-offs, ~7k budget, clean state audit**.
- Receipts: 9/9 variations on the seeded Fall world = 100 games, perfectly balanced, zero trade-offs (was: identical 2 concessions on every variation). Scheduler 41/41, int 372/373 (one unrelated calendar flake, passes isolated), unit 312/312. SCHED_DEBUG=1 env tracing left in for future investigations.
- The concession ladder + trade-offs panel remain as the genuine last resort for truly capacity-starved seasons.

## 26. 2026-08-01 — two-phase scheduling: "courts are just slots" (owner architecture directive)
Owner explained the human model: count slots per weekend, schedule everybody into TIMES, assign courts at the END with rotation so nobody camps on a favorite court; games same day close but never back-to-back (~2-slot break ideal, no 9:30+7pm splits); same gym preferred not absolute; and a fairness report leagues can see.
- **Phase 1 (time placement)**: slots collapse into (day, start-time) buckets whose capacity = open courts (minus other leagues' bookings and this season's survivors). All laws/preferences run on time only: shares, day caps, rematch laws, rotation, spacing. NEW same-day gap shaping: back-to-back −8 (last resort, never forbidden), ≤2-slot break +4, growing penalty beyond. Court-cluster scoring removed from placement (courts unknown by design).
- **Phase 2 (court & venue assignment)**: per bucket, chronologically: same-gym cohesion (+6 when the family is already at that venue that day) · venue-major fill (session's venue order) · division continuity on a court (+3) · court-spread (−2 × times the teams used that court, history included) · seeded rotation jitter (deterministic — preview still commits identically).
- **Fairness report** (`lib/scheduler/report.ts` + GET /api/seasons/[id]/schedule/report + panel on the schedule tab): per team + totals — back-to-backs, morning+evening splits (big gaps), two-gym days, first-tip-off share, most-used court %. Badges green/amber. Owner intent: shareable with clubs later.
- Receipts (seeded Fall, whole season): 100 games · 0 unscheduled · 0 trade-offs · 20×5 · deterministic ×2 · court concentration worst 30% / avg 24% (8 courts) · report live: b2b 6 team-days + 3 two-gym days SURFACED (relaxed-pass artifacts — the report doing its job; next tightening: relocation for day-caps) · early tip-offs 5–9 per team.
- Answered the owner's "22 games in one weekend" mystery in-thread: the old last-resort retroactively crammed October; already fixed by the relocation round.
- Suites: scheduler 42/42 (report math pinned; philosophy A/B re-pinned directional — owner's explicit day rules now dominate, philosophy is the tie-breaker), int 373/373, unit 313/313.

## 27. 2026-08-01 — back-to-backs eliminated (owner: "two days beat back-to-backs")
Three-layer answer to "can back-to-backs be avoided?" — yes, and now they are:
1. **De-double pass** (post-repair, pre-court-assignment, only when the league's model is one game/day): every doubled team-day tries a direct move to another day, then a recursive Sat↔Sun eviction CHAIN (depth ≤14; branching ~1 since everyone plays once/day; the chain terminates at the parity-complementary double). Strict day-cap at every landing — a fix can never create a new double. Guarded against oscillation (ideal≥2 leagues keep doubles by design).
2. **Parity discovery**: a weekend whose matchup graph contains an ODD CYCLE mathematically cannot split one-game-per-day — no amount of within-weekend movement helps (proven on the demo world: the last two doubles sat on separate odd cycles).
3. **Auto-retry wrapper**: when the one-game-per-day model still yields doubles, generateSchedule deterministically tries up to 4 sibling variations (seed+7919k) and returns the first with zero unscheduled/doubles/trade-offs (else lexicographic best). Same input → same output, so preview == commit holds.
- Fall receipt: fairness report ALL ZEROS — b2b 0, big gaps 0, two-gym days 0, worst court concentration 30%; 100 games, 0 unscheduled, 0 trade-offs, ~2s. (Was: 6 b2b + 3 two-gym.) Suites: scheduler 42/42, int 373/373, unit 313/313.

## 28. 2026-08-01 — SCHEDULE QUALITY v2: per-team weekend preferences, the day-anchor pre-plan, honest edge fairness (approved plan: declarative-gliding-wren)
Owner rulings consolidated after the "questions are not build orders" correction: weekend shape is a PER-TEAM preference (team's choice overrides the league default, which inherits the org rulebook; system fallback SAME_DAY); same-day games beat next-day beats back-to-back, with a 2-slot break the ideal gap; first AND last tip-offs rotate; league de-doubles to the NEXT day was backwards and is gone.
- **Schema (additive)**: `TeamSubmission.weekendStyle` (SAME_DAY/SPLIT_DAYS/NO_PREFERENCE) + `Season.defaultWeekendStyle` + org-rulebook `defaultWeekendStyle`; local pushed, box/Neon pending (#56). UI: team page selector ("One trip / Split days / League default"), Settings › Game format league default, org rulebook default. Seed: NPH org default SAME_DAY, the 4 "White" teams SPLIT_DAYS.
- **Day-anchor pre-plan — the structural core.** The greedy chose every FIRST game's day style-blind, so a weekend's fate was sealed before the second game existed; every repair fought the placement instead of the plan (receipts: 32–52 violated team-weekends, 18–40s runtimes across five failed tuning rounds — hard blocks, urgency bonuses, mixed-pair softening all documented dead ends). The fix plans days BEFORE placement: each weekend takes the next `cap` games per team from the pairing pool's own round order (exactly what play-everyone-first admits), then 2-colors that weekend's games by day under parity constraints (one-trip team → same color, split team → opposite colors), balancing components across days and rotating the lead day. Anchors are HARD in strict passes (placement ended at ZERO violations); pair-level day/session plans steer softly.
- **Anchor-aware repair**: movers are first-fit and blind to scoring penalties, so chains scattered 14–47 team-games off-plan while placing the last 2–5 games. Fixes: anchor law hard for all strict-day-cap callers; two-tier slot scans (anchor-safe first — also refuses fresh back-to-backs and split-team doubles); best-fit (not first-fit) endgame placement. Receipt collapsed from 46 violations/21s to 8/2s, then 2/2.4s.
- **Venue-cohesion repair** (chronological court assignment can't know where a team's SECOND game wants to be): post-phase-2 sweep moves the odd game to a free same-time court at the family's gym or swaps courts with a same-time game, accepting only net split-day reductions, biased to least-camped courts. Two-gym team-days 31 → 14–18.
- **Edge fairness made honest**: at 8 courts, 16 of 20 teams sit in the day's first wave — the global "first tip" is not scarce and can't rotate. Edges are now per DIVISION-day (the block's opening/closing game), compared as a RATE of each team's playing days (split teams play ~2× the days of one-trip teams), and the trade-off note only fires when the edge is actually scarce (<40% of the block's slots). Engine rebalance, retry criterion, report, and preview all use the same definition (`unitByTeam` threaded through report API + schedule tab).
- **Seed mixing** (`mixSeed`): raw variety seeds reached every consumer through tiny moduli (%7 round offset, %2 rotations) — two seasons could collide into identical schedules. Hashed first; Shuffle now provably varies.
- **Receipts (Fall 20-team, 4 venues/8 courts, mixed styles)**: whole-season 100/100, 0 b2b, preference 98/100 (SAME 79/80, SPLIT 19/20), one honest trade-off note, ~2.4s. Session-by-session: 100 games, 0 b2b, SAME 80/80 (100%), SPLIT 18/20. Shuffle differs; determinism holds. Suites: scheduler 45/45, unit 316/316, int (run in session log).
- Deviation from the plan bar, documented: "first/last tips within 1" was defined pre-mixed-styles; replaced by the rate + scarcity definition above (raw within-1 is mathematically impossible across mixed exposures, and non-scarce edges are density noise). Court concentration worst-team 40% on the seeded world (was ≤30% before venue cohesion) — same-gym one-trip days narrow each team's court pool; acceptable trade, flagged for the owner.
