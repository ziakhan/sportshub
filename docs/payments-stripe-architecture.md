# Stripe architecture — build in-house vs lean on Stripe Billing (2026-07-07)

Owner question before building payments v2: do we build the
installment/retry/reminder engine **in-house** (Stripe only charges cards),
or **lean on Stripe's infrastructure** (Billing: stored cards, recurring
charges, Smart Retries, dunning emails)? Research + recommendation below.

## The decisive finding

**Stripe's native "invoice payment plans" (split one invoice into a deposit +
installments) do NOT auto-charge a saved card** — even if the deposit was
paid by card, Stripe won't run the next installment automatically
([Stripe invoicing/payment-plans](https://docs.stripe.com/invoicing/payment-plans),
[PayRequest](https://payrequest.io/blog/stripe-partial-payments-installments-2026)).
Auto-charging + AI retries + dunning only come from the **Billing** products
(Subscriptions / auto-collect Invoices):
- **Smart Retries** — AI-timed retries, recover **10–15% more** than fixed
  schedules; only via Billing
  ([Stripe Smart Retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries)).
- **Dunning** — Stripe auto-emails on failure/expiry with a hosted
  card-update page; failure emails alone recover **20–30% more**; full suite
  25–35% for B2C
  ([Stripe revenue recovery](https://docs.stripe.com/billing/revenue-recovery)).
- Custom retry policy caps at **3 retries**; Smart Retries is the better default.

So "Stripe does it all" is only true if we adopt **Billing**, not raw
PaymentIntents. And Billing is built for *recurring* billing — our plan is a
*fixed, small count with custom due dates + a different-sized deposit*, which
fits Subscriptions awkwardly.

## Stripe building blocks (what's real)

- **SetupIntent (`usage: off_session`)** stores the card in Stripe's vault
  and authorizes future merchant-initiated charges — cards live on Stripe,
  never us (the security win the owner noted)
  ([SetupIntents](https://docs.stripe.com/payments/setup-intents)).
- **Off-session PaymentIntent (`off_session:true, confirm:true`)** — WE fire
  a charge on a due date against the stored card. Full date/amount control;
  WE own retries + reminders.
- **Auto-collect Invoice (`collection_method: charge_automatically`)** on a
  Customer w/ default card — Stripe charges when the invoice is finalized,
  then **Smart Retries + dunning** take over. One invoice per installment
  gives us custom dates while Stripe owns recovery.
- **Subscription Schedules** — Stripe drives the whole calendar + charges +
  retries + dunning, zero cron, but assumes even intervals; arbitrary due
  dates + a distinct deposit are an awkward fit
  ([subscription schedules](https://stripe.com/docs/billing/subscriptions/subscription-schedules)).
- **Billing + Connect** — works with **destination charges**: define Customer
  + price on the platform, add `application_fee_percent`, platform is
  merchant of record ([Connect subscriptions](https://docs.stripe.com/connect/subscriptions)).
  For **direct charges** (CONNECT_DIRECT, club is merchant) the Customer +
  card + invoice must live **on the connected account** — more complex, and
  cards don't transfer between accounts.

## Three architectures

### A. In-house orchestration (Stripe = vault + charger)
SetupIntent saves card; our cron fires off_session PaymentIntents on each due
date; we build reminders, retry cadence, failure emails ourselves.
- **Pros:** total control of dates/amounts/retry; uniform across all Connect
  postures; no Billing coupling; fully our-branded comms.
- **Cons:** we rebuild — and forever maintain — what Billing gives free:
  AI Smart Retries (−10–15% recovery), hosted card-update pages, dunning,
  card-expiry handling, SCA/3DS re-auth edge cases. Most code, most risk.

### B. Billing-native (Subscription Schedules)
Stripe owns the calendar, charging, retries, dunning; we create the schedule
+ handle webhooks.
- **Pros:** least billing code; best recovery; Stripe-hosted dunning + card
  update; SCA + card expiry handled.
- **Cons:** recurring model fights our custom due dates + variable deposit;
  Connect direct-charge clubs need Customer/subscription on their account
  (real complexity); Stripe-branded emails unless customized; least control
  of exact timing.

### C. Hybrid — Stripe vault + auto-collect Invoices, our schedule (RECOMMENDED)
Stripe **Customer + saved card** (vault). On accept we charge the deposit
(normal PaymentIntent, save card). For each installment we **pre-create a
`charge_automatically` Invoice**; a thin cron **finalizes each invoice on its
due date**; from there **Stripe charges it, runs Smart Retries, and sends
dunning + a hosted card-update page**. Our own *pre-due* reminders stay
branded; Stripe's recovery kicks in *after* a failure.
- **Pros:** keeps Stripe's security + AI retries + dunning + card-expiry
  (the owner's stated advantages) WHILE preserving custom deposit + arbitrary
  due dates (WE choose finalize timing); degrades cleanly across postures
  (destination = platform Customer; direct = connected-account Customer);
  our brand pre-due, Stripe's engine post-due.
- **Cons:** a cron still finalizes invoices on their dates (small); two
  comms sources (our reminders + Stripe dunning) to keep coherent;
  per-posture Customer placement to implement.

## Recommendation: **C (Hybrid)**

Use Stripe as **vault + charging + recovery engine**, keep **schedule
definition + the offer/accept UX + pre-due reminders** as ours. Stripe
Connect stays exactly as-is for payouts/settlement. This captures the
security and the 25–35% recovery uplift the owner is right to want, without
forcing our custom deposit-plus-installment plan into the recurring
subscription mold, and without rebuilding dunning ourselves.

Posture split for v1 (keeps scope sane):
- **PLATFORM_COLLECT (destination charges):** full hybrid — platform
  Customer, auto-collect invoices, Smart Retries, dunning. **Auto-charge ON.**
- **CONNECT_DIRECT:** Customer/card on the connected account is heavier;
  **v1 = save card + our reminder-to-pay (hosted invoice), auto-charge as a
  fast-follow** once the connected-account customer flow is built.
- **OFFLINE clubs:** no card; deposit + installments are reminder-driven,
  club records payments manually (already supported).

## How this changes the v2 build stages (docs/payments-plan-v2.md)

- Stage A "card-on-file" = **Stripe Customer + SetupIntent + Elements
  saved-card UI** (unchanged, foundational).
- Stage E "auto-charge" = **pre-create auto-collect Invoices + cron finalize
  on due date + let Stripe retry** (was: our own off_session + retry loop).
- Stage F/G "reminders/statuses" = **our branded pre-due reminders +
  subscribe to Stripe's dunning webhooks for post-failure**, receipts from
  `invoice.paid`, failure handling from `invoice.payment_failed`.
- The cron infra (still new) shrinks to: finalize-due-invoices +
  pre-due-reminders (Stripe owns the retry cadence).

## Account model — our account vs the club's (how money actually flows)

There is **one platform Stripe account (ours)** — the `STRIPE_SECRET_KEY`.
Each **club is an Express connected account** under our platform via Stripe
Connect, created through Stripe-hosted onboarding
(`clubs/[id]/payment-config/connect` → `accounts.create type:"express"` →
account link). A club can't take online money until it finishes that
onboarding (`stripeAccountStatus === "active"`). The parent NEVER creates a
Stripe account — they just enter a card.

When a parent pays, the money routes one of two ways (already built,
`obligations/[id]/checkout`):

| | **PLATFORM_COLLECT** (destination charge) | **CONNECT_DIRECT** (direct charge) |
|---|---|---|
| PaymentIntent lives on | **our** platform account (`transfer_data.destination` = club, `on_behalf_of` club) | the **club's** connected account (`{stripeAccount}` request option) |
| Merchant of record | **us** (platform) | the **club** |
| Where funds land | our account → Stripe transfers the club's share to them at charge time (instant settlement) | the club's balance directly |
| Our cut | `application_fee_amount` withheld | `application_fee_amount` withheld |
| Refunds / disputes | come to **us** | the **club's** to handle |
| Best for | control, unified support, simplest family UX | clubs who want to be their own merchant |

Both withhold Stripe's processing fee + our platform fee automatically; the
club only ever nets their share. `PaymentConfig` per club stores the
`stripeAccountId` + mode; platform-admin postures gate which modes a club may
use. **The hybrid installment plan rides on top of whichever mode a club is
in** — for v1 auto-charge we start with PLATFORM_COLLECT (our-account
customer/invoices are simplest), CONNECT_DIRECT auto-charge follows.

## Testing — yes, entirely with dummy data, no real cards ever

Stripe **test mode is the default here** — `.env.example` ships
`pk_test_/sk_test_/whsec_` keys; production is the *only* place live keys go.
Nothing charges a real card or moves real money until we deliberately flip to
live keys in prod.

- **Test cards** — no real card needed: `4242 4242 4242 4242` succeeds,
  `4000 0000 0000 0002` declines, `4000 0025 0000 3155` forces 3-D Secure,
  `4000 0000 0000 9995` = insufficient funds, etc. Any future expiry + any CVC.
- **Test connected accounts** — create Express test accounts for demo clubs
  and complete onboarding with Stripe's prefilled test identity/bank data
  (test SSN, routing/account numbers). Simulate payouts without real banks.
- **Test clocks** — simulate time passing so a "deposit + 3 monthly" plan and
  its retries play out in **seconds, not months**. This is how we validate
  the whole installment schedule, reminders, auto-charge, Smart Retries, and
  failure/retry paths deterministically (already earmarked in
  docs/payments-open-items.md for stage-5 QA).
- **Stripe CLI** — `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
  forwards webhooks to local dev; `stripe trigger payment_intent.succeeded`
  (etc.) fires events on demand. Binary lives in a scratchpad (see
  payments-design.md). Webhook secret comes from `stripe listen`.
- **Offline path needs no Stripe at all** — the demo seeder records
  CASH/ETRANSFER/CHEQUE payments directly, so most demos never touch Stripe.
  Online test flows are opt-in (test keys + `stripe listen` running).
- **Integration tests** — the accept→deposit→schedule logic is unit/int
  testable with the Stripe client mocked; the true end-to-end (real test-mode
  charges + webhooks + test clocks) is the manual stage-5 QA pass.

**Prod flip = swap test keys for live keys + create the prod webhook
endpoint.** The code path is identical; only the keys differ. So we build and
validate everything in test mode first, with confidence it behaves the same
live.

## Decision needed from owner
1. Approve **Hybrid (C)** as the architecture? (vs pure in-house A / pure
   Billing B)
2. Approve the **posture split** (auto-charge for PLATFORM_COLLECT in v1;
   CONNECT_DIRECT auto-charge as fast-follow)?

On "yes", I revise payments-plan-v2 stages E/F/G to the hybrid and start
Stage A (card-on-file), which is identical under any option.
