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
| B2 | Tournament entry fee (per team) | `Tournament.teamFee` | organizer may be club or league |
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

## Sequencing note

Start with OFFLINE + CONNECT_DIRECT (zero-custody pair — covers "flexible" and
"own gateway" asks). PLATFORM_COLLECT last: it's the only mode with custody,
compliance surface, and refund-liability questions.

After Stripe ships: extend the WS2 QA layers with payment states —
state-spread worlds get paid/failed/refunded/installment offers, and the
invariant sweep gains payment rules (e.g. every PAID online Payment has a
PaymentIntent; no roster spot from an unpaid required fee). Stripe test mode +
test clocks drive simulated payments.
