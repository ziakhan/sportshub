---
updated: 2026-07-04
tags: [theme/payments, type/design, status/shipped]
---

# Payments — Design Requirements & Architecture

> Founding requirements stated by the owner 2026-07-03, before any Stripe code.
> These override any payment assumptions in docs/platform-specification.md.

## Owner requirements (verbatim intent)

1. **The platform must NOT dictate online payment.** In this industry many
   people prefer direct payments (cash, Interac e-transfer, "pay at the door")
   to avoid fees. Proceeding without paying online must be possible — e.g. a
   tryout signup with "pay at the door".
2. **Offline payment must be a configurable option** — enable/disable through
   an admin console, per club / per vendor.
3. **Clubs may bring their own Stripe account**: money goes directly to them,
   the platform takes only a clearing/application fee. The platform must NOT
   have to hold everyone's money and settle it later.
4. **But clubs without a Stripe account must still work** — either through
   platform-managed onboarding or by collecting into the platform account and
   settling later.
5. **Full flexibility, configured per club**: offline allowed or not, own
   Stripe vs platform collection, and what fee the platform takes — all
   per-club decisions ("whatever we decide, per club per vendor").

## The three payment modes

| Mode | Rail | Money lands | Platform cut | Custody |
|---|---|---|---|---|
| `OFFLINE` | cash / e-transfer / cheque, recorded in-app | club directly, off-platform | none (plan revenue instead) | none |
| `CONNECT_DIRECT` | Stripe Connect **direct charges** on the club's connected account (Standard via OAuth for existing accounts, Express for new) | club's Stripe → club's bank; club pays Stripe processing fees | `application_fee_amount` per charge, configurable per club | none — platform never holds funds |
| `PLATFORM_COLLECT` | Stripe Connect **destination charges** on the platform account (`transfer_data.destination` + `on_behalf_of`) | club's share transfers to their connected account AT CHARGE TIME — no deferred settlement, no held balances | `application_fee_amount` withheld from the transfer | effectively none — Stripe moves the club's share instantly; refunds use `reverse_transfer` + `refund_application_fee` so the reversal is symmetric. Payouts stay INSIDE Connect (never ad-hoc bank e-transfers — money-transmitter risk in CA). Club must complete Express onboarding to RECEIVE transfers, same as CONNECT_DIRECT |

Verified against Stripe docs 2026-07: direct charges + application fees are the
exact "own gateway, platform takes a fee" model
(docs.stripe.com/connect/direct-charges, /connect/saas/tasks/app-fees,
/connect/platform-pricing-tools for per-account pricing).

## Configuration model (sketch)

- **Platform admin console** (per tenant): which modes this club MAY use
  (allowlist), platform fee (bps + flat) for this club, PLATFORM_COLLECT
  approval flag.
- **Club settings** (within its allowlist): active mode, offline methods
  offered (cash / e-transfer / at-the-door), per-offering overrides
  (e.g. tryouts allow offline, season fees online-only).
- **Uniform Payment record** regardless of rail: every obligation (tryout fee,
  offer season fee/installment, camp, house league, team submission fee) creates
  a Payment row: `status` (PENDING/PAID/PARTIAL/REFUNDED/WAIVED/FAILED),
  `method` (STRIPE/CASH/ETRANSFER/CHEQUE/OTHER), `markedPaidBy` + `markedPaidAt`
  for manual confirmation, `stripePaymentIntentId`/`applicationFeeAmount` for
  online. Cash and card revenue must look identical in reporting.
- Offline flow: obligation created → participant proceeds (config permitting)
  → club marks paid manually → same downstream state as an online payment.
- Existing schema hooks: `Payment` model (currency CAD default),
  `RefereeProfile.stripeAccountId` (future referee payouts), `TenantFeatures`.

## The complete payment graph (mapped 2026-07-03)

Parties: **Families** (parents; 13+ players), **Clubs** (tenants), **Leagues**
(league owners — a distinct merchant, often not a club), **Tournament
organizers** (a club or league), **Referees**, **Platform**, and future:
**Venue providers**, **Influencers/trainers**. Coaches/staff are explicitly
OUT OF SCOPE forever (volunteers / club payroll — not marketplace payments).

### A. Family → Club (phase 1 — the volume)
| # | Flow | Fee source in schema | Notes |
|---|---|---|---|
| A1 | Tryout signup fee | `Tryout.fee` | "pay at the door" is the canonical offline case |
| A2 | Rep season fee (accepted offer) | `Offer.seasonFee` + `installments` | the flagship flow; installment schedule |
| A3 | Camp registration | `Camp.weeklyFee` / `fullCampFee` | multi-week selection |
| A4 | House league registration | HL `fee` | |
| A5 | Gear/jersey deposit (refundable) | — | future/optional |
| A6 | Donations / fundraising | — | future; common in youth sports |
| A-R | **Refund** Club → Family | | cancellation, withdrawal, pro-rata; must exist for OFFLINE too (bookkeeping) |

### B. Club → League / Tournament organizer (phase 2)
| # | Flow | Fee source | Notes |
|---|---|---|---|
| B1 | Season team-submission fee (per team) | `Season.teamFee` | league owners become the SECOND merchant type — validates polymorphic payee immediately |
| B2 | Tournament entry fee (per team) | `Tournament.teamFee` | organizer may be a club or a league — so **club → club** payments are a first-class phase-2 flow (a club hosting a tournament collects entry fees from other clubs). Any club is both payer and payee. |
| B-R | Refund organizer → Club | | rejected/withdrawn before finalize |

### C. Club/League → Platform (phase 2 — our revenue)
| # | Flow | Mechanism |
|---|---|---|
| C1 | Subscription plan | `TenantPlan` tiers → Stripe Billing, card on file |
| C2 | Application fee on online charges | automatic skim (Connect) — never invoiced |
| C3 | Fee on OFFLINE registrations | **DECISION NEEDED**: can't skim cash — either included in plan price, or per-registration billing (LeagueApps model) |
| C4 | League-owner plans | **DECISION NEEDED**: do leagues subscribe separately from clubs? |

### D. League/Club → Referee (phase 3 — schema already anticipates it)
| # | Flow | Notes |
|---|---|---|
| D1 | Per-game officiating fee | `RefereeProfile.standardFee`, `gamesRefereed`, `stripeAccountId` already exist; referee = payee with own connected account. Owner: not a priority now |

### E. Future marketplace flows (phase 4)
| # | Flow | Notes |
|---|---|---|
| E1 | Club → Venue provider (practice slots) | pairs with the venue-provider marketplace backlog (G6 descope) |
| E2 | League → Venue provider (game slots / season blocks) | |
| E3 | Venue → Platform | skim on bookings or listing plan |
| E4 | Influencer flows | **DECISION NEEDED — definition**: Family → Influencer (clinics/sessions)? Club → Influencer (appearances)? Platform skims either way |

### Structural conclusions the graph forces

1. **Payee must be polymorphic (a "merchant"), not a club.** Families pay
   clubs; clubs pay leagues; later anyone pays venues/influencers/referees.
   PaymentConfig + connected-account live on the MERCHANT (club tenant, league,
   venue, referee, platform) — `Payment.payeeId`/`tenantId` already gestures
   at this; leagues force it as early as phase 2.
2. **Obligation vs Payment.** Every product signup creates an OBLIGATION
   (what's owed, to whom, why); Payments (1..n — installments) reference it
   polymorphically (`referenceType`/`referenceId`, like Notification). Cash
   and Stripe payments are rows of the same shape — uniform reporting.
3. **Two platform-revenue rails**: skim (automatic, per charge) and invoice
   (subscription/per-registration via Stripe Billing). Both required; they
   never mix in one flow.
4. **Refunds are first-class from day one** — even OFFLINE mode needs recorded
   refunds (it's bookkeeping), so the state machine includes them regardless
   of Stripe.
5. **Installments** exist only for offers (A2) in v1 — already modeled on
   Payment (`dueDate`, `installmentNumber`, `relatedOfferId`); generalize later
   only if other products need schedules.

### Open decisions for the owner
1. C3 — how do we monetize OFFLINE registrations (plan-only vs per-registration fee)?
2. C4 — do league owners pay their own subscription?
3. E4 — what exactly is the influencer product?
4. Refund policy: platform-mandated defaults or fully club-defined?

## Stage 3 backend — BUILT 2026-07-04 (Stripe SDK mocked; live test-mode verification pending owner keys)

- `lib/payments/stripe.ts` — the single SDK boundary, env-gated: without
  `STRIPE_SECRET_KEY` every online route answers 503 STRIPE_NOT_CONFIGURED and
  offline mode is unaffected. Tests mock THIS module.
- **Connect onboarding**: `POST /api/clubs/[id]/payment-config/connect` →
  Express account + Stripe-hosted onboarding link; `account.updated` webhook
  flips `stripeAccountStatus` to active when charges are enabled.
- **Checkout**: `POST /api/obligations/[id]/checkout { amount? }` — payer-side;
  partial amounts = manual installments. CONNECT_DIRECT → PaymentIntent ON the
  connected account with `application_fee_amount` from the club's config;
  PLATFORM_COLLECT → platform-account intent, fee recorded for settlement.
  Reuses a still-confirmable intent; supersedes stale ones.
- **Webhooks**: `POST /api/webhooks/stripe` (signature-verified, session-exempt;
  `stripe listen --forward-to localhost:3000/api/webhooks/stripe`). Idempotent
  handlers: `payment_intent.succeeded/failed`, `charge.refunded`,
  `account.updated` — all drive the SAME obligation engine as cash.
- **Online refunds**: `PATCH /api/payments/[id] {action:"refund"}` routes
  Stripe payments through `refunds.create` on the right account; refunds
  REOPEN the obligation (debt still owed unless waived/cancelled).
- **Env**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (from `stripe listen`
  locally; dashboard endpoint secret in prod).
- Deferred to stage 5: auto-charging installment schedules (saved payment
  methods + test clocks); today installments are paid manually via partial
  checkout amounts.

## Stage 4 — configurable policy + PLATFORM_COLLECT — BUILT 2026-07-04

Owner directive: the whole system must be configurable — system-wide default
plus per-club/per-merchant override; a club may be FORCED through the
platform, FORCED onto its own Stripe account, or given the choice; offline
(cash / pay-later) may be banned platform-wide or per club so every payment
goes online.

- **Two-layer config**: `PlatformSettings.pay*` (singleton policy: which modes
  exist, default mode, default fee bps+flat) → `PaymentConfig` per-merchant
  overrides where every policy field is NULLABLE (null = inherit).
  `lib/payments/config.ts` resolves the layers; `onlineMode` in the resolved
  config is the EFFECTIVE mode — a merchant choice the allowlist has since
  revoked clamps to the other allowed mode (or NONE), so a banned mode can
  never keep charging.
- **Forcing semantics**: allow only PLATFORM_COLLECT → forced through us;
  allow only CONNECT_DIRECT → must bring their own account; allow both → club
  picks; `payOfflineAllowed=false` (or per-club `offlineAllowed=false`) →
  online-only, record-offline API rejects with OFFLINE_NOT_AVAILABLE.
- **PLATFORM_COLLECT = instant settlement** (supersedes the separate
  charges & transfers sketch): destination charges with
  `transfer_data.destination` + `on_behalf_of` + `application_fee_amount`.
  No settlement engine, no held balances, nothing to batch. Refunds send
  `reverse_transfer: true, refund_application_fee: true` so club share and
  platform fee both come back proportionally. `Payment.stripeDestinationAccountId`
  marks these (charge lives on the platform account, so refunds do NOT use a
  stripeAccount request option).
- **Connect onboarding is required in BOTH online modes** (destination
  charges need a transfer target); the connect route now gates on
  `connectAllowed || platformCollectAllowed`.
- **Admin console**: `/dashboard/admin/payments` — platform defaults form +
  per-club override editor (tri-state inherit/yes/no per flag, fee override,
  effective-mode display). Admin fields on the club config API accept null =
  return to inheritance.
- **Tests**: `platform-policy.int.test.ts` (seed 1113) — inheritance,
  destination-charge params, reverse-transfer refunds, offline bans,
  tri-state admin API. Neon runbook entry #7.

## Sequencing note

Start with OFFLINE + CONNECT_DIRECT (zero-custody pair — covers "flexible" and
"own gateway" asks). PLATFORM_COLLECT last: it's the only mode with custody,
compliance surface, and refund-liability questions.

After Stripe ships: extend the WS2 QA layers with payment states —
state-spread worlds get paid/failed/refunded/installment offers, and the
invariant sweep gains payment rules (e.g. every PAID online Payment has a
PaymentIntent; no roster spot from an unpaid required fee). Stripe test mode +
test clocks drive simulated payments.
