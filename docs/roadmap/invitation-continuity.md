---
updated: 2026-07-08
status: planned
tier: 1
area: onboarding
effort: L
source: owner
tags: [theme/onboarding, type/plan, status/planned]
---

# ✉️ Invitation → register → accept → onboarding (all types) + manual add

**Tier 1 · effort L · from owner. 🟡 Increment 1 SHIPPED 2026-07-08 (LOCAL/UNPUSHED); Increments 2–3 remain.**

## ✅ Increment 1 shipped (no schema change)
- **Player-invitation accept UI** (the biggest hole): new public page
  `/player-invitations/[id]/accept` + `player-invite-actions.tsx` with a player picker (accept mints
  the Offer). Mirrors the staff accept page; handles responded/expired, not-signed-in
  (sign-in/-up with callbackUrl), wrong-account, and add-player fallback.
- **Player-invite email now carries continuity**: link → the accept page; a brand-new recipient goes
  `/sign-up?callbackUrl=/player-invitations/[id]/accept`, so signup → onboarding threads them back.
- **Team-creation staff invite now emails** (`sendStaffInviteEmail`, was silent) for every invite,
  with a working `/invitations/[id]/accept` link — delivered after the tx commits.
- **Bell links are actionable**: signup auto-attach + existing-user notifications now link straight
  to the relevant accept page (were `/notifications` self-loops).
- **Middleware**: `/player-invitations` added to the public allowlist (fresh invitees can reach it).
- Verified: accept page renders for a pending invite; teams-route unit test asserts the email + link.

## ⏭️ Remaining
- **Increment 2 (schema):** league-staff/LeagueManager invite-by-email + referee invite-by-email +
  extend signup auto-attach. Needs a schema change (e.g. `leagueId` on StaffInvitation) → **local-only
  until owner approves a Neon push**, so deferred.
- **Increment 3:** manual bypass-add UIs — admin add-role UI, operator create-family/invite-parent.

Original scope below.

OWNER PRIORITY. With low early adoption, operators must add people directly and every invite must carry a brand-new user through registration into acceptance + onboarding. Only the club-staff-page invite works end-to-end today.

## Problem
Team-creation staff invite sends no email; player invitations have no accept UI and drop callbackUrl; league-staff & referee email invites don't exist; manual add-role/create-family have API but no UI.

## Scope
- Increment 1 (no schema): player-invitation accept page; fix player-invite email callbackUrl; send email on team-creation staff invite; preserve callbackUrl through onboarding
- Increment 2 (schema): league-staff/LeagueManager invite + referee invite-by-email; extend signup auto-attach
- Increment 3: manual bypass-add UIs — admin add-role, operator create-family/invite-parent
- Generalize a unified /invite/[id] resolver + callbackUrl continuity

## Acceptance
- Any invite type → new user → email → register → auto-return to accept → continue onboarding, unbroken
- Operators can add a player/staff/manager/referee directly and the person is emailed a working link

## Dependencies
none

## Refs
[[coverage-audit]] · [[onboarding-tutorials-plan]] · [[requirements-map]] · [[_moc-onboarding]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-onboarding]]
