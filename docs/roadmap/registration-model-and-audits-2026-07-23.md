# Registration Model Rework + Two System Audits (2026-07-23)

Status: **SHIPPED 2026-07-24** (owner: "go ahead and implement it") — §4 registration rework + §3.1-.3 payment gaps + §2.1/.2/.4 consolidations all live; box `7c40120`+. Build log: shared ProgramSignupForm (multi-kid, per-kid weeks, eligibility chips, payment-aware copy), agePolicy enforced (tryouts STRICT), ACTIVE_SIGNUPS capacity rule, computeCampFee, coppa consolidation, tournament-fee obligations, club overdue nags, reviveObligation. e2e 14/14 · int 347/347. Deferred: §2.3 tournament-page badge cosmetics, §2.5 program-shaping modules, camp create/edit savings%% display dedup.

## 1. Shipped: training program detail error (app)

Root cause: `/api/mobile/browse/programs/[type]/[id]` handled tryout/camp/house-league/tournament but not `training`, while `getAllPrograms()` lists training programs — the app pushed `/browse/program/training/[id]` and got 400 "Unknown program type" → "Couldn't load this program". Fixed with a `training` branch (reuses `lib/training` schedule helpers, registration endpoint `/api/training-sessions/[id]/signup`) + Training filter chip in the app list (chip arrives with next app update; the error fix is server-side and live now). Web `/training/[id]` was never broken (verified signed-in as parent@).

## 2. Audit A — duplicated sources of truth (cover-image bug pattern)

Ranked by drift risk:

1. **Age calculation forked outside `lib/coppa.ts`** — COPPA-relevant. Player PATCH (`api/players/[id]/route.ts:100,113`) uses the old 365.25-float formula while POST uses canonical `calculateAge`/`isCoppaMinor`; editing near a 13th birthday can flip `isMinor`/`canLogin` vs creation. Also forked in `players/add/page.tsx`, `players/page.tsx:102`, mobile `kids/[playerId].tsx:116`, `api/tryouts/[id]/signup/route.ts:68`. Fix: import from `lib/coppa.ts` everywhere, delete locals.
2. **Capacity/"is full" logic: THREE different definitions of "counts as signed up"** across ~15 sites — tryout excludes CANCELLED, camp + house league count EVERYTHING (cancelled signups permanently inflate counts → can falsely mark Full and block registration — live bug), training counts CONFIRMED only. Fix: one shared count/isFull helper (extend `lib/lifecycle.ts`), used by signup APIs + public pages + `getAllPrograms` + club dashboards.
3. **Program status badges: 5 independent renderings** — only camps/house-leagues club pages use `programLifecycle()`; tournaments/training/tryouts club pages + public pages hand-roll (training shows "Published" even when full/ended; tryouts never show Full).
4. **Camp full-camp discount math duplicated 6×** — create form, edit form, public page, signup form, signup API (authoritative), mobile. Mobile's copy is WRONG: shows "Full camp" price without the is-it-actually-cheaper guard. Fix: `computeCampFee(camp, weeks)` pure fn; server authoritative; clients read API result.
5. **Program shaping bypasses shared modules** — mobile detail route hand-rolls per-type shaping (incl. today's training branch — consolidate when this lands); tryout + training have no `getPublicX` query module like camp/house-league.

**Key correction to our shared belief: there is NO strict tryout age enforcement in code today.** `playerAge` is stored for staff to eyeball on the signups page; nothing rejects an out-of-age signup anywhere. §4 below adds real enforcement.

## 3. Audit B — dual-role payment routing

**Core is correct-by-construction:**
- All obligations flow through `ensureObligation()`; payer is set at call sites, never inferred from role. Team→league fee = `payerTenantId` (club); every kid-program signup = `payerUserId` after a `parentId` ownership check. No path where Staff/ClubManager role changes the payer on a personal registration.
- Saved cards are strictly per-User (`lib/payments/customer.ts`); there is NO club card vault, and the club-side checkout creates a raw PaymentIntent with no customer attached — a club card can't leak into a personal charge or vice versa.
- Coach/Staff cannot pay or see club money (`lib/payments/authz.ts`, 07-20 fix); coaches request team registration, club admin approves, and only ClubOwner/ClubManager can pay the club-side obligation.

**Gaps found:**
1. **Tournament entry fees are NEVER charged** — no `ensureObligation` anywhere in the tournament path; no paymentStatus on TournamentTeam; club payments page copy promises tournament fees it doesn't show. Fix: mirror the league team-fee wiring on tournament approval (`payerTenantId` = club, referenceType `TournamentEntry` — enum already exists).
2. **Club-owed obligations get no overdue reminders** — `sendOverdueReminders` filters `payerUserId != null`, so club→league fees are never nagged.
3. **"The club will follow up" copy is unconditional** on camp/house-league/tryout/training forms — never checks `ResolvedPaymentConfig` the way the Offer flow does (`payment-info` endpoint + real payment step). This is the owner's "Register — pay via the club" confusion.
4. Cosmetic: `TYPE_LABEL` missing TrainingSessionSignup/OneOnOneBooking/TournamentEntry.

## 4. Proposed registration model (multi-kid · multi-week · age policy)

One shared registration panel across camp/house-league/tryout/training (web + app):

- **Multi-kid**: kid checkboxes instead of single-select. One submit → one signup row per kid (existing schema unchanged) → one PaymentObligation per kid (clean refunds/withdrawals). Confirmation lists per-kid totals.
- **Multi-week camps**: per-kid week checkboxes (schema already has `weeksSelected`; server already prices weekly vs full-camp). Selecting all weeks shows the full-camp price via `computeCampFee()` (§2.4).
- **Age policy**: `agePolicy STRICT|PREFERRED|OPEN` on Tryout/Camp/HouseLeague/TrainingSession + normalized `birthYearMin/birthYearMax` derived at save (Canada = single birth year rule). Defaults: tryout STRICT (and now actually enforced server-side), camp/training PREFERRED, house league creator's choice. UI: STRICT greys out ineligible kids with the reason; PREFERRED shows a warning chip but allows; server re-validates STRICT.
- **Already-registered pre-check**: detail pages return the viewer's existing registrations; registered kids render as "✓ Already registered" (disabled) instead of erroring after submit.
- **Payment-config-aware copy** (fixes §3.3): online rail active → "Register · CA$500 due" + real payment step (or payments-page link); offline-only → "Register — pay the club directly (e-transfer/cash)"; free → "Register".

## Suggested build order
1. Registration panel rework (§4) — owner's active pain, absorbs copy fix + pre-check.
2. Tournament fee wiring + club overdue reminders (§3.1–.2).
3. Consolidations: coppa age calc → capacity/isFull helper → computeCampFee → status badges → program shaping (§2, in that order).
