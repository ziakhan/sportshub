---
updated: 2026-07-08
tags: [theme/ledgers, type/ledger, status/living]
---

# Outstanding items — master ledger

> **💡 FEATURE BACKLOG: docs/feature-backlog.md** — the wishlist of
> requested-but-unbuilt features (RSVP/attendance, playoffs, quizzes,
> creator roles…). Add ideas there the moment they come up.
>
> **🚦 LAUNCH BLOCKERS: docs/launch-blockers.md** — the must-fix-before-live
> list (prod email, family accept-payment UI, Stripe live setup, legal/
> compliance, deploy train). Living doc; check it before any go-live. (2026-07-04, end of scoring session)

State at close: payments stages 1–4 shipped + live-verified; session capacity
planner shipped; live scoring v1 shipped + 8 rounds of owner field-testing
fixes; all suites green (unit 143, integration 112, phase runners 105 from
last rehearsal). ~57 local commits UNPUSHED — deploy on hold by owner.

## 0. Club GTM feature build — COMMITTED (owner, 2026-07-06) — "build all four soon"
Grounds the club/parent demos in real product. Audit + storyboards:
`docs/outreach/club-parent-demos.md`. The club pipeline (tryout → offer w/
packages+sizes+jersey prefs+installments → accept → auto-roster → one-click
league submit → lock) is ALREADY SHIPPED. These four gaps make it complete:
1. **Inventory / order roll-up** — ✅ SHIPPED 2026-07-06. The old
   /clubs/[id]/offers/summary page (club-wide sizes only, dropped items with
   missing sizes) is now the Order Sheet: per-team roll-ups w/ size
   breakdowns, missing-size "Size TBD" buckets + warning, ?team= filter,
   assigned jersey # column, CSV export. Pure agg lib
   lib/offers/order-rollup.ts (9 unit tests). Entry points: team dashboard
   quick action + offers-card link, offers page button.
2. **Tryout mobile check-in** — ✅ SHIPPED 2026-07-06. TryoutSignup.checkedInAt
   (runbook #10) + POST check-in API (club roles, cancelled rejected) + phone
   roll-call page /clubs/[id]/tryouts/[tryoutId]/check-in (progress bar,
   search, optimistic tap-to-toggle) + signups-page button/badges. 7 int
   tests, world seed 1117.
3. **Team ↔ family chat** — ✅ SHIPPED 2026-07-06. TeamMessage model (soft
   delete; runbook #10) + GET/POST/DELETE APIs (membership: club owners/
   managers + team Staff/TeamManager + parents of ACTIVE rostered players;
   staff moderate any message) + /teams/[teamId]/chat page (5s polling,
   bubbles, day separators, STAFF badge, load-earlier, take-back/moderate).
   Entry points: team dashboard quick action, parent dashboard per-team
   Chat links, member-gated pill on public /team/[id]. 9 int tests, seed
   1118. V2 later: unread badges, per-message notifications, attachments.
4. **Sponsored/featured listings + parent discovery** — ✅ SHIPPED 2026-07-06.
   Tenant.isFeatured (runbook #10) + admin Feature/Unfeature toggle (audited
   CLUB_FEATURE/UNFEATURE); /club browse rebuilt: featured spotlight (gold),
   star ratings on cards (rated-first sort), city pills + ?city= filter
   (near-me v1 — no geocoords on Tenant). Review system UNHIDDEN on
   /club/[slug]: reviews list + avg stars + write-review form (POST
   /api/reviews already existed); At-a-Glance rating. StarRating added to
   the design system.
**ALL FOUR SHIPPED 2026-07-06** (order 1, 2, 4, 3; commits local, unpushed).
Both demo storyboards are now 100% real product — see
docs/outreach/club-parent-demos.md.

**FOLLOW-ONS SHIPPED 2026-07-07 (owner-directed):**
- **Chat v1.5** (8fe2951): members panel (coaches = chat admins by default),
  unread badges (parent dash / team hub / team dash), debounced team_chat
  bell, TeamChatRead read cursors (runbook #10). Owner next: "decide how to
  improve chat + make it scalable" — realtime service, web push, email are
  the candidate directions (docs/nph-demo-seed-plan.md §5).
- **NPH demo world seeder** (6b8e538): scripts/seed-nph-demo.ts — plan +
  cheat sheet in docs/nph-demo-seed-plan.md. Local DB scrubbed (1,668 test
  users + sim tenants + old showcase REMOVED — old logins are GONE locally;
  @sportshub.demo replaces them) and reseeded; login audit green. PROD RUN
  BLOCKED on deploy train: push + runbook #10, then --report → --scrub-noise
  → seed --yes-prod.
- **Demo-readiness round 2 (2026-07-07, af9d87e/ed4c374/79d0165/d6b709d):**
  Summer/Fall league rename + REAL scheduler substrate in the seed (venues/
  courts/sessions tabs populated, 10 games/team = 2/weekend, league fees
  show $127,680 collected); viewer-aware box-score names + C.K. fix;
  leaders UI tightened; My Hub parent door (public header + user menu);
  forfeit relabels w/ confirms; locked-season guards on Divisions/Sessions
  tabs; floating chat dock on public pages (desktop popup / mobile sheet);
  scheduler buildPairings fairness fix (circle-method — was 7-11 game
  spread for same guarantee). **NEXT FEATURE (owner): playoff generation**
  (top-N per division from standings → bracket into PLAYOFF sessions —
  settings + schema exist, no generator yet).
- **Referee session booking (2026-07-07, 02b9199):** Uber-style — league
  referee pools (LeagueReferee), self-service availability
  (RefereeAvailability), session-day shift offers (RefereeSessionRequest:
  targeted or broadcast, first-accept-wins, accept auto-assigns the day's
  games in the window, audited). League Referees tab in season manage +
  /referee/requests inbox w/ availability editor. Int seed 1121. Demo:
  live broadcast offer pending for the 4-ref Summer pool.
- **Manual override kit (2026-07-07, fd9cf09):** coaches/team managers get
  full roster authority (add club-linked players w/ jersey, invite-by-email
  UI for the G3 API, per-row jersey edit + release/reactivate, finalize);
  commissioner roster override past lock (audited, club notified) + manual
  single-game add in Schedule tab; game-day referee search/assign/unassign
  on /score rows (busy-slot flags, referee notified); admin Audit Trail
  page (/dashboard/admin/audit) — 8 new AuditAction types. Int seed 1120.
  STILL MANUAL-GAP candidates (owner review): free-form game date picker
  (suggestions-only today), player merge/dedupe, score correction UI beyond
  re-finalize.
- **Roster versions + change requests (2026-07-07, 086c670/47e3572):**
  team→league submission finally discoverable (league chips + W-L + coach
  on team cards, Leagues panel + Add-to-league buttons on team dashboard,
  ?team= deep-link); submit picks a per-league roster VERSION (subset of
  club roster, cross-club conflicts blocked); club-side
  /clubs/[id]/teams/[teamId]/league-rosters shows each version + lock;
  Season.rosterChangePolicy (OPEN_UNTIL_DEADLINE/REQUEST_ONLY/CLOSED) +
  deadline; club requests change → commissioner queue in Teams tab
  (approve = one-shot unlock, next save re-locks; deny w/ note) — both
  sides notified. Demo: Burloak request pending for owner-nph. Runbook #10
  extended. Int seed 1119.

## 1. Deploy train (biggest risk, fully scripted, owner gate)
- Run Neon runbook entries **#4 #5 #6 #7 #8** (`docs/pending-deploy-actions.md`)
- Push master → Vercel auto-deploy
- Vercel env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (dashboard
  endpoint, NOT the CLI one), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Create prod Stripe webhook endpoint (payment_intent.succeeded/failed,
  charge.refunded, account.updated)

## 2. Payments (see docs/payments-open-items.md for detail)
- Owner demo click-through (still never done)
- **Stage 5 QA**: installment auto-charge (saved cards + test clocks),
  state-spread simulator worlds, invariant sweep (~15 rules, payment rules
  most valuable)
- League merchants have NO Connect onboarding route (league fees can't go
  online yet; clubs-only today)
- Payer receipt emails; reporting (per-team revenue); admin posture-change
  impact preview ("N clubs will move")
- Human review of the payments backend (stage 3+4 built while owner away)

## 3. Live scoring
- SHIPPED at close (2026-07-05): public printable scoresheet
  (/scoresheet/[gameId], signature lines, foul boxes), league-configurable
  referee sign-off at finalize, finalize emails scoresheet to both clubs'
  managers + league owner, in-game BOX overlay (live fouls/PTS without
  leaving the console)
- Owner layout proposals → add as entries in the console layout registry
  (Rows/Tiles exist; per-device localStorage choice)
- Referee sign-off COMPLETE (2026-07-05 overnight): signature pad (canvas →
  PNG, on sheet + PDF) AND account PIN verified server-side against the
  ASSIGNED referee (UserRole role=Referee gameId) → refereeVerified badge;
  typed name + finalize-without-approval escape hatch retained; referees set
  their PIN on /referee/profile. STILL OPEN: referee-assignment UI (rows are
  API/seed-only today); email recipients could extend to team Staff/coaches
- Scoresheet uses scorebook notation (digit marks + FT circles), prints
  LANDSCAPE (Chrome auto; Safari = manual orientation), lists the FULL
  roster w/ DNP/ABSENT rows. Pre-game ATTENDANCE step shipped (roll call →
  starters; ATTENDANCE events) — season stats must use it for games-played
  denominators when built. Public game page = sports-app style (leaders +
  box/PBP tabs). Server-side PDF: GET /api/scoresheet/[gameId] (pdfkit,
  landscape, vector marks) — Download button on the sheet page; sheet page
  is chrome-free in a bare (sheet) layout.
- Season stat lines + box-score archive on public league/team pages —
  ✅ SHIPPED 2026-07-05 with content P1 (lib/stats/season.ts, league
  leaders page, team/player public pages)
- Deferred by owner: scorekeeper assignment (Game.scorekeepers reserved),
  referee assignment + sign-off, timeouts, possession arrow, flagrant
  grades, shot locations (→ shot charts, phase-2 AI alignment)
- Hands-on iPad (tablet three-column) pass not yet done — phone had 8 rounds
- Phase 2: AI video scoring (docs/live-scoring-plan.md)

## 4. Leagues / scheduling (owner discussion topics from 2026-07-04)
- **Leagues**: league-v2 plan (docs/league-v2-plan.md) was fully drafted in
  April, never approved — needs a refresh discussion against what's shipped
- **Court assignments**: courts exist under venues + day-venues; owner topic
  not yet designed
- **Referee/selection assignment + schedule creation**: deferred by owner
- Capacity planner: eyeball a realistic schedule (seed-7777 world has
  leagues) — clustering asserted in tests, not yet human-reviewed

## 4b. Public site & content ecosystem — PLAN APPROVED, **P1 SHIPPED 2026-07-05**
Strategy discussion held 2026-07-05; plan approved with amendments (§0) and
monetization model (§12) — docs/public-site-content-plan.md.
- ✅ **P1 SHIPPED**: schema (Post/PostTag/Follow/Player.mediaConsent/
  Announcement.isPublic); season stats lib + league leaders page; AI recaps
  auto-publish on finalize (Claude via ANTHROPIC_API_KEY, deterministic
  template fallback — scripts/backfill-recaps.ts for old games); public
  /team/[id] + /player/[id] pages w/ consent-gated naming; /news feed +
  post pages; homepage v1 (scoreboard strip, Your-teams rail, news+leaders,
  density-graceful); Follow model + buttons; /for-clubs + /for-leagues;
  hasFamilyPass() entitlement stub. Neon runbook entry #9 before deploy.
- **Showcase demo world** (2026-07-05, post-P1): `scripts/seed-showcase.ts`
  builds a living league on 12 REAL Ontario clubs — 60 scored games, 2 LIVE,
  recaps w/ photo covers, YouTube highlight posts (MediaAsset pulled forward
  from P2: IMAGE + VIDEO_EMBED), announcements. Homepage now has the §3.5
  highlights reel. Demo logins: showcase-parent@sportshub.test (Your-teams
  rail) + commissioner@showcase.demo, both TestPass123!. Seeder is
  idempotent and scrubs test-world name noise. NOTE: local int-test runs
  re-create bracket-named worlds; re-run the seeder to re-scrub before demos.
- **Public/dashboard IA separation — STARTED 2026-07-05** (owner direction:
  two worlds, two menus, NBA/ESPN-style public browsing). Done: league
  management /leagues → /manage/leagues; public /leagues browse index;
  /league/[seasonId] rebuilt as spectator hub (scores + standings +
  news + teams + leaders); nav Leagues→/leagues + News added; club pages
  link team hubs. **REMAINING IA WORK (needs owner discussion):** move the
  rest of dashboard management under /manage/* (or /dashboard/*) — /teams,
  /clubs, /players, /tryouts etc. still squat on pretty URLs; decide
  public-league canonical URL (league-id hub w/ season picker vs current
  season-id pages); dashboard sidebar "View public site" cross-links;
  eventual subdomain split (owner: "maybe we will separate them in the
  future").
- **Owner testing backlog** (`docs/owner-testing-backlog.md`) — discussion-first
  gaps the owner finds while test-driving; OB-001 club-page visibility
  controls, OB-002 claim-flow trust model. Add new finds there.
- P1 leftovers: announcement form has no "public" checkbox yet (flag exists);
  RECAP_AI posts orphan if their game is deleted (tags cascade, post stays);
  /api/live box scores still show full names (authed surfaces do — decide
  whether the public live page should abbreviate too)
- P2 next: creator content (org-vetted creators per §0.4 — no open
  independent signup; photo upload via Vercel Blob + YouTube embeds,
  approval queues, report/takedown)
- OWNER VISION: central content hub w/ social syndication (post once →
  YouTube/Instagram/TikTok/Snapchat) — P4 is now the PAID syndication hub;
  reviews slid to P5; platform API app-reviews must start early
- MONETIZATION (§12): record free / relationship premium; Family Pass
  launches P3 (~$10/mo anchor); club-bundled pass via obligation engine;
  season keepsakes as one-time purchases; syndication hub = paid club add-on

## 5. Platform / carried over
- Post-auth deep-link redirect SHIPPED (2026-07-05): middleware keeps query,
  sign-in/sign-up/onboarding thread callbackUrl, public header AuthLinks.
  NOT yet covered: in-content sign-in links on product pages (tryout/camp
  registration CTAs) — audit those to use components/auth-link.tsx
- Player invitations UI (API shipped G3; no UI)
- Review system — UNHIDDEN 2026-07-06 with club GTM feature 4 (§0 directive
  superseded the "end of season" plan); moderation queue UI still unbuilt
  (flag/status fields exist)
- UI redesign D2 (public pages) / D5 (nav) / D6 (content) —
  docs/design-strategy.md. D3 (/team/[id] hub) ✅ shipped with content P1.
- Club/venue architecture: 5 owner forks undecided (docs/club-venue-architecture.md)
- Nightly Playwright job C (optional hardening)
- Seeder unification fork — largely superseded by scripts/simulate.ts; ASK
  before building

## 6. Engagement features (polls → quizzes → carpool) — SLICE 1 SHIPPED 2026-07-06
Owner vision + roadmap: **docs/engagement-features-plan.md** (scoped
team/club/league engagement by authorized creators, public-page surfacing
later; carpool researched-not-built with V1 sketch + liability notes).
**Team polls & surveys SHIPPED**: Poll/PollQuestion/PollOption/PollVote
(runbook #12), chat-membership authz (staff create/close/delete; families
vote), single/multi choice, re-vote replaces, live result bars, staff-only
voter names, team_poll bell, /teams/[teamId]/polls + entry points (team
dashboard, chat header, parent dashboard). 11 int tests (seed 1122). NPH
demo world seeds a Lords G9 tournament poll (demo parent votes live).
**1b SHIPPED 2026-07-07: quick polls in the chat stream** (owner's original
vision) — 📊 composer button (staff), single-question poll as a chat
bubble w/ tappable live result bars, votes flow to open chats within 5s
(pollUpdates on every messages GET), take-back deletes the poll,
TeamMessage.pollId = runbook #12 amendment, 3 int tests (chat suite),
demo pizza poll in Lords chat.
NEXT candidates (owner picks): club/league-scoped polls, public read-only
results, quizzes, carpool v1.

## 6c. Practice scheduling — SHIPPED 2026-07-06 (owner: "finish the team practice stuff")
Recurring practice days per team (set at creation or TBD later), announce
flow (expands to dated occurrences for 10 weeks + bell/EMAIL to every
family), live team calendar (/teams/[teamId]/calendar, 45s polling, staff
move/cancel/restore inline — every change notifies), personal iCal feed
(/api/calendar/[token], webcal for iPhone + Google Calendar URL for
Android; practices + games for ALL the user's teams; cancellations ship
STATUS:CANCELLED). Public team page shows practice days once announced.
Schema: PracticeSlot + Practice.location/slotId + User.calendarToken +
Team.practiceScheduleAnnouncedAt = **runbook #13**. TZ: slot wall-times
expand via APP_TIMEZONE (default America/Toronto) — lib/calendar/timezone.ts
(Vercel is UTC; naive Date would shift 4-5h). 12 int tests (seed 1123).
FOLLOW-ONS not built: per-user email notification preferences (v1 emails
everyone — owner said "people who enabled notifications or emails", prefs
need a settings surface); venue picker on slots (free-text location v1);
league-level view of club practice load.

## 7. Owner asks parked 2026-07-06 (do NOT lose these)
- **PAYMENTS v2 — FULL SPEC WRITTEN (2026-07-07), owner-committed, NOT built**:
  docs/payments-plan-v2.md. Club configures payment terms at OFFER time
  (full-pay OR deposit + N installments w/ per-installment due dates; default
  25%+3 monthly); family accepts one option and CANNOT accept without paying
  the deposit; auto-charge on schedule; club-configurable reminders (email +
  push); success/failure emails + retry. Big gaps confirmed by audit: NO
  card-on-file (no Stripe Customer/SetupIntent/saved-card UI), NO schedule
  generation, NO auto-charge, NO reminders, NO scheduled-job infra at all.
  6-stage build order in the doc; 4 open decisions (deposit-on-accept for
  offline clubs, push v1-vs-fastfollow, CONNECT_DIRECT auto-charge). Demo
  data already simplified to New $3,000 / Returning $2,700 + deposit $750 +
  3 monthly (offer-package-options-design.md §Follow-up). Payments-sensitive
  — build behind explicit go, stage by stage. **Stripe architecture decided
  (docs/payments-stripe-architecture.md): HYBRID recommended** — Stripe as
  vault + charging + Smart Retries + dunning (auto-collect Invoices), our
  schedule + accept UX + pre-due reminders (NOT pure in-house, NOT pure
  Subscriptions). Research fact: Stripe native invoice payment-plans do NOT
  auto-charge; auto-charge + AI retries + dunning need Stripe Billing. 2
  arch decisions pending (approve Hybrid; posture split = auto-charge
  PLATFORM_COLLECT v1, CONNECT_DIRECT fast-follow). **UPDATE 2026-07-07:
  owner locked HYBRID + both modes v1 (no phasing) + leagues same pass.
  STAGES A–H BUILT (local): card-on-file, offer terms + composer, deposit-
  gated accept, installment schedule (auto-collect invoices), auto-charge +
  reminders crons, invoice webhooks (receipts/failures), parent timeline,
  league Connect parity. Destination live-verified test mode; direct auto-
  charge needs connected-account QA. Runbook #16/#17 + CRON_SECRET env.
  Suites 233u/213i.**
- **Competitor tracker (parked, docs/research/competitor-tracker.md)**: full competitive positioning pass later (PlayMetrics, LeagueApps, JerseyWatch, SportsEngine, TeamSnap, GameChanger, MaxPreps, Exposure Events…) by feature area + business model; list + comparison frame captured.
- **Logged-in home/landing redesign (2026-07-07, owner ask, SEPARATE
  project, scoped not started)**: drop promo/marketing for signed-in
  members, content-first, maximize real estate; fold in the Site IA
  menu decisions. Plan: docs/home-redesign-plan.md (+ site-ia-plan.md).
- **Onboarding + tutorials + videos (2026-07-07, PLAN v2 — league-first
  catalog per owner; demo-readiness gaps BUILT)**:
  docs/onboarding-tutorials-plan.md. Owner's league storyline (create
  league → season → sessions/dates → venues+times → referees → schedule
  one session → EVERYONE notified + calendar) audited end-to-end; 2 gaps
  found + built same day: (1) schedule commit now bells club managers AND
  bell+emails every team's staff + rostered families w/ team-calendar
  link (was club-managers-only; int seed 1125, no double-bell), (2)
  TeamManager can post tryouts (int seed 1126). Club sequence C1-C12 per
  owner's corrected list (templates→options wording). Both storylines now
  recordable start-to-finish on the NPH demo world. **+ Team events
  (2026-07-07): ONE calendar rule** — TeamEvent/TeamEventTeam (runbook
  #15), events editable by coach/TM/club managers/league owner, multi-team
  push (club + league scopes), deduped bell+email, same calendar endpoint
  + phone iCal. Int seed 1127; demo: Lords photo day + NPH Media Day. Investigated the
  "missing 'I am a parent' selection" — NOT a bug: role cards still render
  on /onboarding for fresh signups (verified live); demo accounts are
  pre-onboarded so they 307 past it, and /settings/roles was removed by
  design (action-driven roles, 2026-06-08). Plan = 3 layers: getting-
  started checklists (real-data progress) + teaching empty states; 16
  short task videos (parents 4, clubs 8, refs 2, league sizzle + long
  chaptered tour); /help center w/ YouTube embeds (infra exists). Owner
  decisions in doc §7: voice, who records, T1 build go, priority order.
- **Offer package options + BULK SEND — SHIPPED 2026-07-07** (owner
  approved "do what you just suggested" + asked for bulk structure): one
  offer carries 1-4 packages (OfferOption, runbook #14) composed from the
  template library; family picks at accept (sizes adapt to the chosen
  package); chosen option fills the snapshot columns so Order Sheet/
  payments/roster untouched. BULK: "Send Offers (N)" on tryout signups —
  compose once, tick players, per-row skip reasons (offered/cancelled/no
  profile). POST /api/offers/bulk. 8 int tests (seed 1124). Demo: parent@'s
  open Lords offer now has Returning (-20%, no kit) vs New Player packages.
- **Returning players at offer time — DEFERRED (owner 2026-07-07: "deal
  with this later")**: auto-detect from prior rosters -> "Returning" badge
  on signups, optional returning-only package guard, jersey-number
  prefill. Design ready in docs/offer-package-options-design.md.
- **Homepage cleanup / IA revisit**: owner doesn't understand programs vs
  marketplace split (overlap!); menu order unclear; "should the Scores
  dropdown be Leagues?" → fold into the N2/N3 IA work
  (docs/site-ia-plan.md) as an explicit homepage-content + nav-labels pass.
  Owner: "we really need to clean up the home page and revisit what's
  lying there."
- **Marketing messaging refresh**: copy says "parents" — should say
  parents OR PLAYERS (and other audiences); now that the feature set is
  deep (scoring, recaps, chat, polls, practices, calendar sync, payments),
  refresh the landing/for-clubs/for-leagues value props — "spice up why
  the platform is, what it does, who it is for."
- **New roles (later)**: videographers, photographers, influencers,
  content creators (ties into content P2 org-vetted creators), third-party
  coaches (skills trainers), universities/recruiters (recruitment flows).
  Owner wants them on the roadmap, not built yet.

## 6b. Performance — AUDITED + QUICK WINS SHIPPED 2026-07-06
Owner asked "audit the DB indices, app is slow." **Full record:
`docs/perf-audit-2026-07-06.md` — read it before touching perf again.**
Verdict: indexes were fine (DB tiny, warm renders 80–200ms); local slowness
= dev-mode compiles, Vercel slowness = query count × Neon round-trips (+
suspected Neon free-tier autosuspend, unconfirmed — owner to check console).
Shipped + verified: incremental live polling w/ void reconciliation (52KB →
621B per 10s poll per viewer), can-score probe (58KB → 17B), getCurrentUser
request-memoized, layout tenant counts batched (3/tenant → 2 fixed),
getYourTeams batched (~18 → 6 queries), 3 composite indexes (local only —
Neon = runbook #11). Deferred: chat-polling architecture (fold into the
queued chat-scalability discussion), getSessionUserId admin lookup → JWT,
standings/leaders JS aggregation (fine at current season size).

## Environment notes (local)
- Demo scoring world seed 9414 in DB (`npx tsx scripts/demo-scoring-game.ts`
  re-seeds; --wipe removes). Stripe verify world 9412 also present.
- Demo league "[wc7p692] Summit Titans League" set to FULL stat depth.
- `stripe listen` must run for webhook flows (binary in e50fff6b scratchpad).
- prisma generate is flaky under Rosetta — retry loop w/ CHECKPOINT_DISABLE=1
  (see MEMORY.md gotcha). Never `next build` over a running dev server.
