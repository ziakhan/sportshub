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

**Tier 1 · effort L · from owner.** OWNER PRIORITY. With low early adoption, operators must add people directly and every invite must carry a brand-new user through registration into acceptance + onboarding. Only the club-staff-page invite works end-to-end today.

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
