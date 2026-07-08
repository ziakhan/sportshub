---
updated: 2026-07-08
status: planned
tier: 1
area: offers
effort: M
source: layer2
tags: [theme/offers, type/plan, status/planned]
---

# ⏳ Program waitlists + promotion

**Tier 1 · effort M · from layer2.** A full camp/league/tryout HARD-REJECTS signups today (lost revenue + bad UX); the WAITLISTED enum exists but is never used.

## Problem
Capacity checks reject when full; no queue, promotion, or notification.

## Scope
- When at capacity, offer 'join waitlist' instead of rejecting (set WAITLISTED)
- Ordered queue; promote on a spot opening; notify promoted family with a claim window
- Operator view of the waitlist

## Acceptance
- A family can join a waitlist for a full program
- Freeing a spot promotes + notifies the next in line

## Dependencies
none

## Refs
[[camp-houseleague-registration]] · [[requirements-map]] · [[coverage-audit]] · [[_moc-offers-engagement]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-offers-engagement]]
