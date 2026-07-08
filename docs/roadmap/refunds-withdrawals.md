---
updated: 2026-07-08
status: planned
tier: 1
area: payments
effort: M
source: layer2
tags: [theme/payments, type/plan, status/planned]
---

# ↩️ Refund policy + prorated mid-season withdrawal

**Tier 1 · effort M · from layer2.** The Refund button exists, but there's no cancellation policy, no proration, and no flow that cancels the product AND settles the refund together.

## Problem
Refund amount is manual; paid registrations hard-block self-serve cancellation.

## Scope
- Per-program cancellation policy + refund windows
- Prorated refund calc (by weeks/games remaining)
- Withdrawal flow: cancel product row + settle refund in one action
- charge.dispute.created webhook handler (enum exists, no handler)

## Acceptance
- A mid-season withdrawal cancels the roster spot and issues the correct prorated refund
- Disputes are reconciled and surfaced to the merchant

## Dependencies
none (refund button exists)

## Refs
[[payments-plan-v2]] · [[payments-design]] · [[requirements-map]] · [[coverage-audit]] · [[_moc-payments]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-payments]]
