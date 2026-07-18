---
updated: 2026-07-18
tags: [type/plan, status/in-progress]
---

# Overnight run 2026-07-18 — owner-approved scope + rulings

ALL LOCAL. No deploys, no Neon, schema via local `prisma db push` only.
Commit + test per item. Morning report with verification evidence.

## A. Review lifecycle + moderation (owner rulings tonight)
1. Only season participants may review (already gated) — reviews OPEN only
   in a post-season window: when a Season concludes, invite every
   participating parent; window closes after 30 days.
2. Invitation trigger = PLATFORM-CONFIGURABLE: PlatformSettings default
   (AUTO on conclude) + per-club override field; admin can set universal
   policy, clubs may be granted overrides by admin. Clubs get a heads-up
   notification either way.
3. Admin moderation queue (/dashboard/admin/reviews exists — extend):
   pending→approve/reject states, report-review flow.

## B. Playoff generation (owner design session tonight)
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

## C. Editability waves 2-4 (audit doc = spec) with ONE redesign
- Self-withdraw (club-from-league AND any player-from-team leave) becomes
  WithdrawalRequest: reason + pending + other-party approval + notify both
  sides (owner: installment commitments make unilateral exit wrong).
- Rest as spec'd: offer rescind + expiry cron · game "Correct result" UI ·
  division rename · staff-invite cancel/expiry · mediaConsent editor ·
  player remove (now via request where rostered) · designation promote ·
  email/password self-service · edit round-trips (recap/review/poll/
  announcement/chat) · notification dismiss.

## Order: A → B → C (features while fresh, independent items after).
