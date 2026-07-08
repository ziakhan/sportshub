---
updated: 2026-07-08
status: planned
tier: 1
area: offers
effort: M
source: layer1
tags: [theme/offers, type/plan, status/planned]
---

# 🏕️ Camp & house-league registration UI

**Tier 1 · effort M · from layer1.** Disconnected: the signup APIs work but the public pages bounce families to /dashboard — parents literally can't register.

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
