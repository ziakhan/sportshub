# Outstanding items — master ledger (2026-07-04, end of scoring session)

State at close: payments stages 1–4 shipped + live-verified; session capacity
planner shipped; live scoring v1 shipped + 8 rounds of owner field-testing
fixes; all suites green (unit 143, integration 112, phase runners 105 from
last rehearsal). ~57 local commits UNPUSHED — deploy on hold by owner.

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
- Referee sign-off is a TYPED name v1; "finalize without approval" escape
  hatch stamps the sheet. OWNER-SPECED upgrades when referee assignment
  ships: (a) signature-pad drawing on the console, (b) referee sets a
  personal PIN/password in their account, enters it in a popup at finalize,
  verified server-side against the ASSIGNED referee. Email recipients could
  extend to team Staff/coaches (currently ClubOwner/ClubManager + league owner)
- Scoresheet uses scorebook notation (digit marks + FT circles), prints
  LANDSCAPE (Chrome auto; Safari = manual orientation), lists the FULL
  roster w/ DNP/ABSENT rows. Pre-game ATTENDANCE step shipped (roll call →
  starters; ATTENDANCE events) — season stats must use it for games-played
  denominators when built. Public game page = sports-app style (leaders +
  box/PBP tabs). Server-side PDF: GET /api/scoresheet/[gameId] (pdfkit,
  landscape, vector marks) — Download button on the sheet page; sheet page
  is chrome-free in a bare (sheet) layout.
- Season stat lines + box-score archive on public league/team pages
  (per-game live page + box exist; season AGGREGATES not built)
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

## 5. Platform / carried over
- Post-auth deep-link redirect SHIPPED (2026-07-05): middleware keeps query,
  sign-in/sign-up/onboarding thread callbackUrl, public header AuthLinks.
  NOT yet covered: in-content sign-in links on product pages (tryout/camp
  registration CTAs) — audit those to use components/auth-link.tsx
- Player invitations UI (API shipped G3; no UI)
- Review system built but hidden (`{false && ...}`) — enable end of season
- UI redesign D2 (public pages) / D3 (/team/[id] hub) / D5 (nav) / D6
  (content) — docs/design-strategy.md
- Club/venue architecture: 5 owner forks undecided (docs/club-venue-architecture.md)
- Nightly Playwright job C (optional hardening)
- Seeder unification fork — largely superseded by scripts/simulate.ts; ASK
  before building

## Environment notes (local)
- Demo scoring world seed 9414 in DB (`npx tsx scripts/demo-scoring-game.ts`
  re-seeds; --wipe removes). Stripe verify world 9412 also present.
- Demo league "[wc7p692] Summit Titans League" set to FULL stat depth.
- `stripe listen` must run for webhook flows (binary in e50fff6b scratchpad).
- prisma generate is flaky under Rosetta — retry loop w/ CHECKPOINT_DISABLE=1
  (see MEMORY.md gotcha). Never `next build` over a running dev server.
