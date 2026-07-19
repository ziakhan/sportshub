# Demo pages build (2026-07-19)

Built to [[demo-brief]] (owner's verbatim instructions). Local only, not deployed.

## What shipped

Four public pages host a click-through walkthrough of a whole season, every screen
drawn from the real product:

- `/how-it-works`: the full end-to-end flow, 63 steps (58 screens + 5 chapter
  dividers), in season order with persona switches: league setup → club claims its
  page → tryouts and offers (both sides) → league entry → live season → playoffs →
  championship recap.
- `/for-leagues` (25 steps), `/for-clubs` (37 steps), `/for-parents` (18 steps):
  persona slices assembled from the same scene library, each in season order.

## How it meets the brief

- **Fidelity**: every screen was transcribed from its real product screen first.
  The verbatim inventories live in `docs/demo-inventory/` (league.md, club.md,
  parent.md, season.md): every label, placeholder, select option, button string,
  badge and empty state quoted from source. Scenes reuse the real UI kit
  (`components/ui`: Button, Card, Badge, StandingsTable, PanelHeader, StatTile).
  Nothing invented; two brief items were adjusted to product truth: tryout signup
  shows the real fee-pending notice (the fee is then paid through the real
  obligations flow on /payments, which is wired), and offer templates carry
  fee/installments/practices/included kit (no season dates exist on templates).
  No public playoff bracket page exists in the product, so playoffs are shown via
  the real operator wizard + bracket panel and the championship recap.
- **Framing**: operator screens render in a desktop browser frame at 1160px
  logical width; parent screens in a proportioned iPhone frame (390x844). Live
  scoring is a duo: console and public game page visible together (side by side
  on desktop, stacked with pan mode on phones).
- **Playback**: manual by default; the glowing control on each screen advances,
  with green-tick confirmations (real success copy where the product has it).
  Autoplay is opt-in, dwell scales with how much text is on the screen, clicking
  the demo pauses/resumes. Back link and chapter pills included. Instruction
  line always visible.
- **Data**: one consistent story from the seeded demo world: NPH Summer League
  Summer 2026 ($3,990 team fee, 4 divisions, 5 weekend sessions, 4 real venues,
  4 referees), Burlington Force Grade 10 (full 12-player roster, born 2010,
  single birth years), Maria and Jayden Thompson, $3,000/$2,700 packages with
  25% deposit + 3 monthly installments. Box score sums to the final (62-58),
  linescores and standings are internally consistent.

## Code map

- Engine: `apps/web/src/components/flow-demo/` (player.tsx, frames.tsx,
  advance.tsx, types.ts, data.ts, flows.tsx) + demo CSS at the end of
  `apps/web/src/app/globals.css`.
- Scenes: `flow-demo/scenes/` (league-setup, club-setup, tryouts, offers,
  league-entry, season, shared).
- Pages: `(public)/how-it-works`, `(public)/for-clubs`, `(public)/for-leagues`,
  `(public)/for-parents`.
- Dead code from the earlier voided approach (`components/demo/*`) deleted.

## Verification (2026-07-19, local dev server)

- All four pages load 200; all four flows walked end to end by Playwright with
  zero page errors (`scripts/demo/walk-flow-demo.mjs <route> <outDir> [--mobile]`).
- Every one of the 63 full-flow screens + end screen screenshotted and reviewed
  by eye; mobile (390px) walk of /for-parents reviewed including the duo scene.
- Autoplay verified: self-advances, click-to-pause works.
- ESLint clean; tsc clean (the only errors are stale `.next/types` refs to the
  deleted `(public)/demo` page, gone on next .next rebuild).
- Copy sweep: no em-dashes in authored copy (verbatim product strings keep
  theirs), single birth years only.

## Status

Committed locally on `wip/2026-07-09-design-demos-elevation`. NOT deployed:
production push needs the owner's explicit go (standing rule). Note the live-site
check in the brief can only happen after that deploy.

## Addition (same day): the animated end-to-end demo at /demo

Owner follow-up: keep the walkthrough pages as they are, and add a fully
interactive end-to-end demo of the club-to-team journey. Built at `/demo`
(added to lib/public-paths.ts):

- Six acts, 21 scenes: club claims its page → creates the team and assigns
  staff (head coach, assistant, team manager by email) → hands off to the head
  coach → coach creates the tryout with full details and publishes it → parent
  browses, searches, signs up and pays → club watches signups, runs check-in,
  bulk-sends offers → parent accepts (package, uniform size, jersey numbers,
  payment plan) → club sees acceptances land and finalizes the roster.
- Every scene acts itself out in real time: a pointer moves and clicks with
  ripples, dropdowns open and pick, fields type with a caret, checkmarks pop,
  the camera zooms in on what is being touched and back out, confirmations
  appear. Each scene then holds on the glowing decisive button for the user;
  autoplay presses it on its own. Click the demo to pause.
- Engine: `flow-demo/live/engine.tsx` (timeline runner, virtual cursor, camera,
  holds) + `anim.tsx` primitives + `act1..act5` scene files. Same verbatim
  strings and story data as the walkthrough pages.
- Verified: full run walked headlessly (`scripts/demo/walk-live-demo.mjs`),
  zero page errors, every scene screenshotted at animation-start and hold and
  reviewed by eye; autoplay tested hands-free; lint/tsc clean. Local only, not
  deployed.

## Addition 3 (same day): the league arc in the live demo

Owner follow-up: extend /demo with the whole league story. Five new acts,
16 new scenes (37 total, 11 acts):

- **The league opens**: create league → create season (dates, May 15
  registration deadline, $3,990 team fee, 10 guaranteed games) → sessions with
  dates/times → venues → Open Registration (real notification headline).
- **Teams enter**: the Force registers via /browse-leagues (team + division
  pickers, the 12/12 league-roster-version checklist, "Submit Team") →
  submissions land on the league's Teams tab like tryout signups, Approve →
  deadline passes, preflight green, Finalize Season.
- **Schedule & refs**: preview → commit (real "Season Schedule Published"
  bell) → referee day-offer broadcast (real copy) → persona switch to Mike
  Ferreira's /referee/requests inbox, Accept → real toast "You're booked —
  assigned to 6 games that day." → Maria's notifications (verbatim
  schedule-published bell) → My Calendar with RSVP Going + the real "Add to
  phone" Apple/Google subscribe panel.
- **Game day, live**: game-day checklist (clock choice) → attendance roll-call
  (tap absent) → starting fives → live duo in the real rows-layout console:
  +2 → player → "Assist by?" chain, score flashes on the public page instantly;
  then a missed 2 → rebound picker → play-by-play writes itself. No refresh,
  stressed in captions.
- **Final & the sheet**: referee PIN sign-off (Mike, PIN-verified) → Mark
  final → the one-page official scoresheet (marks legend, signature row,
  Download PDF) → distribution scene showing the REAL finalize templates: the
  scoresheet email to both clubs' managers + the league office, and the
  "Final Score" bell to every family.

Fidelity notes verified in source before building: schedule commit really
bells+emails the whole team circle (lib copy quoted verbatim); game finalize
really emails the scoresheet link to managers/league and bells families
("no family email" is a deliberate volume decision in the route). New verbatim
inventory: docs/demo-inventory/league-entry-live.md (browse-leagues register,
referee requests, scoresheet, calendar, notifications).

Verified: all 37 scenes walked headlessly, zero page errors, every scene
eyeballed at start + hold; two zoom-clipping defects found by eye and fixed.
Local only, not deployed.

## Addition 4 (same day): owner punch list round 2

- Em-dash purge is now TOTAL in the demo (his ruling overrides product-verbatim):
  zero em/en dashes in any demo display string, product-derived or authored;
  reworded to read human. Product's own em-dash purge remains on the polish
  backlog.
- Scoresheet rebuilt as a real scorebook: both full rosters, foul boxes, marks
  for all four quarters, REB/AST/PTS, TOTALS rows, team extras lines, a DNP row
  (Theo Martinez) and an Absent row (Xavier Reid, matching the attendance
  scene), wider layout.
- Read-first cards: longer content-scaled dwell (4.2-9.5s), no repeated hint
  line; on dismiss the card shrinks and slides up INTO the pinned bar (the
  pinned copy is hidden while the card is up, never two at once).
- Repeated bottom instruction line removed (autoplay pause hint only).
- Camera zoom now width-capped: a zoom can never push form columns off either
  edge while typing (verified mid-typing on the season form).
- Color pass on the demo chrome: persona-colored accent bar + wash on the
  sticky bar and intro cards, fiery play-hoop-gold gradient progress bar,
  green checkmarked completed act pills, hoop-orange "Click to continue" tag,
  navy-gradient start gate with gradient strip, gradient done-screen medal.
  Product screens themselves stay product-plain.
- Phone-frame logo fixed: now the real BrandWordmark component (the raw SVG
  had the ONE box detached).
- New scenes (act 9, now 45 steps total): league reschedules a game via the
  real Find alternates / Move here flow and cancels another; families get the
  REAL "Game Rescheduled" / "Game Cancelled" bells (templates from
  api/games/[id]/route.ts); the calendar shows the moved game at its new time
  and the cancelled game struck through with the Cancelled pill, still visible.
- Product gap flagged for owner: game cancellation has NO reason field in the
  product (plain confirm); the notification says "cancelled by the league"
  with no reason. If he wants a reason captured + included in the bell/email,
  that's a product change.
- Verified: full 45-step walk headless, zero page errors; new/changed scenes
  eyeballed (gate, intro merge, sticky color bar, logo, scoresheet, changes,
  bells, calendar strikethrough, mid-typing zoom cap).

## DEPLOYED (2026-07-19, owner-approved "push it to prod" in session)
Cherry-picked the five demo commits onto the box lineage (no schema changes,
clean picks) and deployed: box master d3027da → 21d5db1, deploy.sh green
(build 1m43s, services restarted, health checks OK). Live-verified: /demo,
/how-it-works, /for-clubs, /for-leagues, /for-parents all 200 on
ysportshub.com (+ sportshubone.com /demo), start gate + read-first card
eyeballed live, zero page errors. Homepage does NOT link /demo yet; owner is
deciding placement (recommendation delivered: demo CTA on homepage + on
for-clubs and for-leagues with act deep-links; parent cut later).

## Addition 5: parent cut + homepage signposting + mobile pass

- /demo/parents: the parent edition of the live demo, 12 steps, 4 acts (Find
  the tryout / The offer / Your calendar / Game day). No league office, no
  scoring console. Reuses the parent scenes + calendar/RSVP/add-to-phone +
  reschedule/cancel alerts + calendar strikethrough, plus two new scenes: a
  live team-chat scene (message arrives, Maria votes in the poll) and a
  game-day scene that is JUST the public game page with the box score built to
  the real /live/[gameId] structure (Stats tab, linescore, Game leaders, full
  MIN/PTS/REB/AST/STL/BLK/TO/PF columns, Starters/Bench, TOP badge, red PF
  warning, Team totals) updating itself with the product's green flash: the
  three, the assist, the rebound, then Final.
- Homepage: gradient "Watch the demo" CTA above the three persona buttons with
  the line "A whole season, played out click by click on the real product.
  Parents: watch your side." → /demo and /demo/parents. Audience pages got
  matching CTAs (for-clubs + for-leagues → /demo; for-parents → /demo/parents).
- Mobile: sticky bar offset responsive (58px phone / 76px desktop), a
  phone-only tip on the start gate ("plays best on a desktop screen, works
  here too"), desktop scenes run in the frames' pan mode with auto-scroll to
  the glowing control. Verified at 390px.
- Verified: parent cut walked end to end headlessly, zero page errors; new
  scenes + homepage + mobile eyeballed; lint/tsc clean.

## Addition 6: hero ONE pill, persona descriptions, real scores/news fidelity

- Homepage headline now mirrors the logo lockup: "All of it." in play blue,
  "One" as the brand's orange ONE box (hoop-500 pill, uppercase), "app." in
  ink. Gradient text removed.
- The three persona buttons became descriptive cards: title + one line on
  what's inside + arrow (clubs: tryouts/offers/payments/rosters; leagues:
  registration/scheduling/referees/live scores/standings; parents: sign up,
  pay, follow every game live).
- Walkthrough fidelity: SceneScores now renders the product's REAL ScoreCard
  component (monogram crests, winner arrow, dimmed loser, venue footer, real
  status badges); new SceneNewsBrowse uses the REAL NewsCard component
  (gradient cover placeholder, date + author, clamped excerpt) and clicks
  through to the recap; the recap article gained its cover block matching
  /news/[slug]. /how-it-works is now 64 steps; news-browse inserted into all
  slices that carry the recap.
- Verified: 64-step walk clean, zero page errors; scores/news-browse/recap and
  the new hero eyeballed; lint/tsc clean. LOCAL, awaiting push word.

## Deploy record: full-lineage push (2026-07-19)

- Owner ended cherry-picking: "I personally don't care. You can deploy
  everything to prod." Full wip branch merged into the box lineage as
  `9a2e0a6` (merge of box `502ec8c` + wip `8465304`; 4 conflicts, all
  cherry-pick duplicates, resolved to the wip side; merged tree byte-identical
  to wip). Local wip fast-forwarded to `9a2e0a6`, so box and local histories
  are now converged.
- Schema push to the box DB required `--accept-data-loss` for the unique
  `completionToken` constraint on ClubClaim; table verified EMPTY (0 rows)
  before accepting. New live tables/fields: ReviewInvite, playoff fields,
  WithdrawalRequest, ClubClaim v2.
- This shipped the previously-held overnight work to prod: season reviews,
  playoff generation, withdrawal approvals, club claiming v2 (live at
  /claim/[tenantId] -- the demo's Act 1 now matches prod), lib/sms.ts Twilio
  seam (dark until creds).
- Live-verified: box HEAD `9a2e0a6`, web+sidecar active, all demo pages 200
  (/, /demo, /demo/parents, /how-it-works, /for-*), hero ONE pill markup in
  prod HTML, homepage + demo gate screenshots eyeballed.
- Still NOT touched by this push: Vercel (origin master, needs env vars) and
  Neon (schema backlog #24-30 plus these new models). Both are separate calls.

## Addition 7: game-page fidelity, real news covers, rated tryout browse

- The parent game-day scene and the walkthrough's live/box-score scenes now
  render through shared building blocks transcribed class-for-class from the
  real /live/[gameId] page (scenes/game-page.tsx): broadcast-dark hero with
  team-color washes, crests and records, Game/Stats/Plays pills, linescore
  with color chips, two-sided game leaders with jersey squares, team-stats
  comparison bars, and the box score with starters/bench, TOP badge and team
  totals. The parent scene presses the Stats tab mid-script and the winner
  reads in the highlight color at the final.
- News scenes stopped faking covers: the browse cards and both recap articles
  now render buildMatchupCover() output, the same generated SVG matchup art
  the recap service publishes.
- The parent journey opens on a real tryouts-near-me browse: taps the Tryouts
  filter and sees three clubs' tryouts with their review star ratings before
  choosing the Force. PRODUCT CHANGE to match: /events cards now show each
  club's published-review rating via the shared getClubRatings groupBy
  (lib/queries/programs.ts + events-browser.tsx) so demo and product agree.
- Homepage persona cards got explicit walkthrough chips ("See how it works" /
  "See your side of it").
- Verified: tsc + lint clean, /demo/parents 12-step and /how-it-works 64-step
  walks with zero page errors, every changed screen eyeballed (box fits at
  phone width after dropping the untracked-minutes column, which the real
  page also omits when minutes are not tracked).
