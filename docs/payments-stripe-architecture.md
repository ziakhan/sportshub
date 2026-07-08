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

## Decision needed from owner
1. Approve **Hybrid (C)** as the architecture? (vs pure in-house A / pure
   Billing B)
2. Approve the **posture split** (auto-charge for PLATFORM_COLLECT in v1;
   CONNECT_DIRECT auto-charge as fast-follow)?

On "yes", I revise payments-plan-v2 stages E/F/G to the hybrid and start
Stage A (card-on-file), which is identical under any option.
