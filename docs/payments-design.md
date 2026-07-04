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
| `PLATFORM_COLLECT` | charges on the platform account + Connect **separate charges & transfers** for payout | platform Stripe, then transfer to club | withheld from the transfer | platform holds funds — offer selectively; do payouts INSIDE Connect (never ad-hoc bank e-transfers — money-transmitter risk in CA) |

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

## Sequencing note

Start with OFFLINE + CONNECT_DIRECT (zero-custody pair — covers "flexible" and
"own gateway" asks). PLATFORM_COLLECT last: it's the only mode with custody,
compliance surface, and refund-liability questions.

After Stripe ships: extend the WS2 QA layers with payment states —
state-spread worlds get paid/failed/refunded/installment offers, and the
invariant sweep gains payment rules (e.g. every PAID online Payment has a
PaymentIntent; no roster spot from an unpaid required fee). Stripe test mode +
test clocks drive simulated payments.
