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

## ✅ FEASIBILITY CONFIRMED 2026-07-21 (owner asked "do we have enough?")
YES — the data + helpers already exist; this is a REPORTING VIEW on top, not new
data collection:
- `PaymentObligation` (amount, status PENDING/PARTIALLY_PAID/PAID/WAIVED,
  payeeTenantId | payeeLeagueId, referenceType = program type, payments[]) +
  `Payment` (amount, SUCCEEDED/REFUNDED, refundAmount).
- `lib/payments/queries.ts`: `merchantObligations({tenantId|leagueId})` fetches
  all obligations for a club OR league; `summarize()` already computes
  **collected** (money claimed), **outstanding** (pending amounts), **waived**,
  AND **byType** (revenue per program type: camps/house leagues/tryouts/season
  offers/tournaments).
- The club `payments/page.tsx` + league `payments/page.tsx` ALREADY render
  Collected/Outstanding/Waived tiles + ObligationsTable. That's the foundation.
**So the "Accounting/Reports tab" incremental build =** (1) per-program revenue
breakdown (surface `byType` with friendly labels); (2) a transactions report
(list payments: date/payer/program/gross/fee/net/method/status); (3) CSV/Excel
export (QuickBooks-friendly columns); (4) installment roll-up (paid/upcoming/
overdue). Phase-2: scheduled email exports. Works for BOTH clubs and leagues
(same helpers, keyed by tenantId vs leagueId). Ready to build on owner's go.

## ✅ SHIPPED phase 1 (prod `9de3977`, 2026-07-21) + additions (LOCAL, 2026-07-21 evening)
Prod: Accounting tab for clubs (`/clubs/[id]/accounting`) + leagues
(`/manage/leagues/[id]/accounting`) — revenue by program, transactions table,
generic QuickBooks-friendly CSV (`lib/payments/reports.ts` + `AccountingReportView`).

LOCAL additions (awaiting deploy approval, same batch as trainer role):
- **Per-tool export formats**: dropdown with *CSV (full detail)* ·
  *QuickBooks CSV* (3-column bank import: Date, Description, Amount — QBO
  "Upload from file" accepts without a mapping step) · *Xero CSV* (their bank
  statement template: *Date, *Amount, Payee, Description, Reference). All net
  of refunds; program + date filters apply to the export.
- **Date-range filter** on the transactions table + filtered net total.
- Trainer program labels (Training Sessions, 1-on-1 Training).
- **Overdue visibility** (owner ask): Overdue tile + 1-30/31-60/60+ aging strip
  on club AND league Payments tabs; "Overdue Xd" row badges; club Overview
  "Needs attention" row; `dueDate` now flows through ObligationRow.
- **Overdue reminders**: `sendOverdueReminders()` in the payment-reminders cron —
  first notice the day after due, then every 4 days (OVERDUE_NAG_DAYS), stops
  at 90 days; bell + email; respects club reminderEmail opt-out. ⚠️ The cron
  itself is STILL NOT SCHEDULED on the box (owner call — real emails).
- **Declined-card notice**: `payment_intent.payment_failed` now bells + emails
  the payer (installment `invoice.payment_failed` already did, with Stripe
  Smart Retries driving recovery).

## Integration options (assessed 2026-07-21, in order of effort)
1. **CSV templates (SHIPPED above)** — covers QuickBooks, Xero, Wave, Excel,
   Google Sheets. Zero ongoing cost; treasurer does a monthly 2-click import.
2. **Scheduled email export** (S effort) — weekly/monthly CSV attached to an
   email to the treasurer (club setting: address + cadence). Reuses OCI email
   + the existing cron seam. Recommended NEXT — makes it passive.
3. **Zapier/Make webhook feed** (M) — signed webhook per settled payment →
   clubs self-serve into 6000+ apps incl. QBO/Xero/Sheets. One generic
   endpoint, no per-vendor API work. Good marketing checkbox ("Zapier").
4. **QuickBooks Online API sync** (L) — OAuth app, push SalesReceipts nightly,
   map programs → Items. Real "connected" experience but: Intuit app review,
   token upkeep, refund/void edge-cases, support burden. Only if clubs ask.
5. **Xero API sync** (L) — same shape as #4, smaller Canadian youth-sports
   footprint. Defer behind demand.
Recommendation: ship #2 next sprint; offer #3 when marketing wants the
integrations page; hold #4/#5 until ≥3 paying clubs request direct sync.
