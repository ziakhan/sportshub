---
theme: [payments]
type: ledger
status: living
updated: 2026-07-04
tags: [theme/payments, type/ledger, status/living]
---

# Payments — open items (as of 2026-07-04)

State: stages 1–4 SHIPPED and verified (obligation engine → all products mint
obligations → Stripe Connect/checkout/webhooks/refunds → configurable policy +
instant-settlement PLATFORM_COLLECT + posture UI). Suites: unit 125/125,
integration 103/103, live HTTP smoke 3/3, tsc/lint/build clean.
Design: `docs/payments-design.md`. Deploy runbook: `docs/pending-deploy-actions.md`.

## Blocked on the owner (minutes each)

1. ✅ **DONE 2026-07-04 — Stripe Connect enabled** (owner completed the
   platform profile: "you collect payments and pay the recipient" → Start
   testing). **LIVE DESTINATION-CHARGE VERIFICATION PASSED** same day:
   `verify-stripe-live.ts` → account acct_1TpYv4EXS5HHuobj auto-created +
   activated, $25 destination charge with $0.93 fee exact, webhook →
   obligation PAID, refund with transfer reversal trr_… — stage 4 fully
   proven. Re-run anytime: `npx tsx scripts/verify-stripe-live.ts`.
2. **Owner demo click-through** — /clubs/[id]/payments (club books), /payments
   (payer view), /dashboard/admin/payments (posture console). Local dev only;
   test accounts in seed docs (password TestPass123!).

## Deploy (deliberately ON HOLD per owner 2026-07-04)

- 42 local commits unpushed. Before ANY master push: run Neon runbook entries
  **#4, #5, #6, #7** in `docs/pending-deploy-actions.md` (push triggers Vercel
  auto-deploy; code would hit a DB missing those schema changes).
- Vercel env additions needed at deploy time: `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET` (from a real dashboard webhook endpoint, NOT the CLI
  one), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (NEXT_PUBLIC ⇒ needs redeploy).
  Create the production webhook endpoint in the Stripe dashboard pointing at
  `<prod-url>/api/webhooks/stripe` (events: payment_intent.succeeded,
  payment_intent.payment_failed, charge.refunded, account.updated).

## Stage 5 — payments QA (next build phase, deferred by design)

- **Installment auto-charge**: saved payment methods + schedules (today
  installments = manual partial checkout amounts). Use Stripe test clocks.
- **State-spread simulator mode**: worlds with paid/failed/refunded/partial/
  installment obligations for QA browsing (`scripts/simulate.ts` extension).
- **Invariant sweep** (`scripts/check-invariants.ts`): ~15 always-true rules;
  the payment ones matter most (every PAID online payment has a PaymentIntent;
  no roster spot from an unpaid required fee; refunded ⇒ obligation reopened…).
- Chaos-season random-walk (layer 3) after that — multi-day, optional.

## Smaller loose ends (post-stage-5 or opportunistic)

- **League merchants have no Connect onboarding route** — clubs have
  `/api/clubs/[id]/payment-config/connect`; leagues have PaymentConfig rows
  but no way to connect a Stripe account yet. Needed before league fees go
  online (fine while leagues collect offline).
- **Payer receipts** — no email on successful payment yet.
- **Reporting** — per-team revenue breakdown was explicitly deferred;
  currently 3 tiles + by-type on the club payments page.
- **Posture console polish** — when switching a club's posture the UI warns
  about unonboarded clubs, but there's no "N clubs currently on own-Stripe
  will be moved" impact preview when changing the PLATFORM posture.
- **PaymentConfig rows in local dev** carry pre-policy explicit values;
  entry #7 step 2 has the null-out SQL (already written for Neon; run the
  same locally if inheritance testing looks off).
- **Review-before-trust**: stage 3+4 backend was built while the owner was
  away; a human pass over `lib/payments/*` + the checkout/refund routes is
  prudent before real money.

## Environment gotchas (local)

- `stripe listen` must run for webhooks:
  `<scratchpad e50fff6b>/stripe listen --api-key <sk_test> --forward-to
  localhost:3000/api/webhooks/stripe`. whsec in apps/web/.env.local matches
  the current CLI session; re-sync + restart dev server if it changes.
- NEVER `next build` while the dev server is running — production artifacts
  in `.next` break dev asset serving (this was the "styles broken" incident).
- `prisma generate` is flaky under Rosetta (unkillable hangs) — retry loop
  with `CHECKPOINT_DISABLE=1`, see MEMORY.md gotcha.
