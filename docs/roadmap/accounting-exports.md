---
updated: 2026-07-20
status: planned
tier: 0
area: payments
effort: M
source: owner
tags: [theme/payments, type/plan, status/planned]
---

# 📒 Accounting reports & exports — FAST-TRACKED

> **OWNER PRIORITY 2026-07-20**: "Maybe I want to show accounting much faster so that way
> I can sell it to the clubs right away." Surfaced from the LeagueApps teardown — their
> reporting/accounting depth is a top gap of ours, and it's the feature a club treasurer
> lives in. This is a **sales asset for the club-owner demos**, not just plumbing.

## Problem
We have Stripe transactions in the DB but no treasurer-facing views: no transaction
reports, no exports, no per-program financial breakdowns. Clubs re-type revenue into
QuickBooks by hand; nonprofit treasurers need clean books for AGMs and audits.

## Scope (phase 1 — the demo-able 80%)
- **Transactions report** (club workspace): every payment, refund, credit; filter by
  program/season/team/date; totals. `force-dynamic`, Decimal→Number rule applies.
- **Per-program revenue summary**: income per camp/house-league/season program (and
  subprogram/team where applicable) — the "Transaction Summary" LeagueApps equivalent.
- **CSV + Excel export** of both, QuickBooks-import-friendly column layout
  (date, payer, program, gross, fee, net, method, status, reference).
- Installment/payment-plan status roll-up (paid / upcoming / overdue per family).

## Phase 2
- Scheduled email exports (weekly revenue sheet to treasurer) — reuse OCI email.
- Discount/offer redemption report · e-transfer reconciliation feed ([[etransfer-reconciliation]]).
- QuickBooks Online API sync (only if demanded; exports cover most clubs).

## Acceptance
- A club admin can answer "how much did Spring House League make, net of fees?" in two
  clicks and hand their treasurer a CSV that imports into QuickBooks without editing.

## Refs
[[leagueapps-comparison]] §Deep dive · [[etransfer-reconciliation]] · [[_moc-payments]]
