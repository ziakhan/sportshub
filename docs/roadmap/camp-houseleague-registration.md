---
updated: 2026-07-08
status: shipped
tier: 1
area: offers
effort: M
source: layer1
tags: [theme/offers, type/plan, status/shipped]
---

# 🏕️ Camp & house-league registration UI

**Tier 1 · effort M · from layer1 · ✅ SHIPPED 2026-07-08 (LOCAL/UNPUSHED).**

## ✅ What shipped
- Embedded a registration form directly in the **public** camp + house-league page sidebars
  (cleaner than the tryout two-page split): `camp-signup-form.tsx` (player + weeks selector, reads
  `{success,id,totalFee}`) and `house-league-signup-form.tsx` (player + notes). Both load the
  signed-in parent's players + existing signups, have an add-player fallback, and post to the
  already-complete `/api/camps|house-leagues/[id]/signup` (obligation created).
- Repointed the public bounce links: `session ? render form : /sign-in?callbackUrl=/camp|house-league/[id]`.
- **Surfaced registrations in the family's programs**: parent dashboard "Registrations" card now
  lists camp + house-league signups (`get-dashboard-data.ts` + `parent-section.tsx`).
- Verified end-to-end: authenticated parent → form renders → POST 201 (camp returned the discounted
  full-camp `totalFee`) → both appear in the dashboard.

Original scope below.

Disconnected: the signup APIs work but the public pages bounce families to /dashboard — parents literally can't register.

## Problem
api/camps/[id]/signup and api/house-leagues/[id]/signup have zero UI callers.

## Scope
- Public registration form on camp + house-league pages (mirror the tryout signup flow)
- Wire to the existing signup APIs incl. obligation/payment
- Confirmation + appears in the family's programs

## Acceptance
- A parent can complete a camp signup and a house-league signup end-to-end
- Payment/obligation created like tryouts

## Dependencies
none (APIs exist)

## Refs
[[coverage-audit]] · [[requirements-map]] · [[_moc-offers-engagement]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-offers-engagement]]
