---
updated: 2026-07-18
tags: [type/plan, status/in-progress]
---

# Overnight run 2026-07-18 — owner-approved scope + rulings

> **STATUS (morning): ALL FOUR PHASES BUILT, TESTED, COMMITTED LOCALLY — NOTHING DEPLOYED.**
> A `3fe13f3` reviews · B `db610c4` playoffs · C `04680a1` withdrawals · D `2f88c78` claiming v2.
> Integration suite 309/309 (+20 new tests) + 13 playoff unit tests. Schema pushed to LOCAL db only
> (ReviewInvite/ReviewStatus.PENDING · Game.playoffRound/Slot + SeasonSession.playoffPlan ·
> WithdrawalRequest · ClubClaim v2 fields) — Neon untouched, deploy train pending.
> NOTE: C's list items (offer rescind, correct-result, division rename, etc.) were found ALREADY
> SHIPPED 2026-07-09 (editability-audit §5) — C therefore = the withdrawal-approval redesign only.

ALL LOCAL. No deploys, no Neon, schema via local `prisma db push` only.
Commit + test per item. Morning report with verification evidence.

## A. ✅ SHIPPED `3fe13f3` — Review lifecycle + moderation (owner rulings tonight)
1. Only season participants may review (already gated) — reviews OPEN only
   in a post-season window: when a Season concludes, invite every
   participating parent; window closes after 30 days.
2. Invitation trigger = PLATFORM-CONFIGURABLE: PlatformSettings default
   (AUTO on conclude) + per-club override field; admin can set universal
   policy, clubs may be granted overrides by admin. Clubs get a heads-up
   notification either way.
3. Admin moderation queue (/dashboard/admin/reviews exists — extend):
   pending→approve/reject states, report-review flow.

## B. ✅ SHIPPED `db610c4` — Playoff generation (owner design session tonight)
- GUIDED FLOW: input = teams qualifying (+ division size) → system offers
  only sensible formats w/ previews:
  - single-elim bracket (byes; optional 3rd-place game)
  - play-in games (8th vs 9th style) feeding the bracket
  - round-robin playoff pool (everyone plays everyone; standings crown)
  - pool play → top-N advance → crossover/bracket (tournament style, for
    10-16+ team divisions)
  - consolation/placement bracket (5th-8th etc.)
- SINGLE GAMES ONLY (no best-of series — owner: doesn't exist in youth).
- Seeds from regular-season standings; generates PLAYOFF-type sessions/
  games; next-round games auto-linked (winner-of slots).

## C. ✅ SHIPPED `04680a1` (withdrawal redesign; rest was already live since 07-09) — Editability waves 2-4 (audit doc = spec) with ONE redesign
- Self-withdraw (club-from-league AND any player-from-team leave) becomes
  WithdrawalRequest: reason + pending + other-party approval + notify both
  sides (owner: installment commitments make unilateral exit wrong).
- Rest as spec'd: offer rescind + expiry cron · game "Correct result" UI ·
  division rename · staff-invite cancel/expiry · mediaConsent editor ·
  player remove (now via request where rostered) · designation promote ·
  email/password self-service · edit round-trips (recap/review/poll/
  announcement/chat) · notification dismiss.

## D. ✅ SHIPPED `2f88c78` — STRETCH: Club claiming v2 (email path live; SMS seam dark until Twilio creds)
Per feature-backlog §Club claiming v2 (settled flow): claim models +
verification via census contacts (email path first; Twilio SMS = needs
owner creds, build the seam + email path, SMS behind env flag) +
paper-proof upload → admin queue → claim-completion token → user-bound
ownership + claim-time corrections + search-before-create in onboarding.

## Order: A → B → C → D-stretch (features while fresh, independent items after).
