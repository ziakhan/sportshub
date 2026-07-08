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

## Onboarding — what a club (and league) actually does

**Not part of signup.** A club owner signs up → creates the club → and only
*later*, deliberately, goes to **`/clubs/[id]/payments`** (the
`PaymentSettingsCard`) and clicks **"Connect with Stripe."** That's the right
call — we never block account creation on someone having their bank details
handy. (Recommendation: surface "Set up payments" as a step in the
getting-started checklist from the onboarding plan, not in the signup wizard.)

**The flow (already built for clubs):**
1. Club owner opens Payments settings, picks/confirms the posture (offline
   methods + online mode), clicks **Connect with Stripe**.
2. We create a Stripe **Express** connected account (country, club name,
   contact email, `tenantId` metadata) and redirect to **Stripe's hosted
   onboarding** — we don't build or see any of those forms.
3. Stripe collects, from the club owner, the KYC a payout account requires:
   business type (individual / company / non-profit), the representative's
   name + DOB + address + ID (last-4 SSN/SIN, sometimes a document), business
   name/category/description, and a **bank account** for payouts. Stripe runs
   verification.
4. They return to `/clubs/[id]/payments`; the `account.updated` webhook flips
   `stripeAccountStatus` → **active**, and the club can now take online
   payments. Until active, only offline methods show.

**Same onboarding serves both charge modes** — the connected account is
needed either way. What differs is the *weight*:
- **Direct charges (CONNECT_DIRECT):** the club is the merchant of record →
  needs full `card_payments` + `transfers` capabilities → Stripe requires the
  complete onboarding, and the club then owns its statement descriptor,
  disputes, refunds and tax reporting (e.g. 1099-K). More setup, more
  responsibility on the club. Button copy: *"so card payments land directly
  in your bank."*
- **Destination charges (PLATFORM_COLLECT):** the platform is merchant of
  record → the account mainly needs the `transfers` capability to *receive*
  funds → onboarding is lighter, and we own the merchant side (disputes,
  refunds, descriptor). Button copy: *"so the platform can transfer your
  share of each payment to your bank."* **This is the lower-friction default
  and what we recommend clubs start on.**

Either way the **parent/family does zero onboarding** — they just enter a
card at accept time.

**Leagues: full parity, built alongside clubs (owner decision 2026-07-07).**
Leagues get the *same two modes* (direct + destination) and the same
onboarding as clubs. This is a **small increment, not a parallel build** —
the data layer already supports leagues:
- `getPaymentConfig(merchant)` already takes `{ tenantId } | { leagueId }`.
- `PaymentConfig.leagueId` (unique) already exists.
- Obligations already carry `payeeLeagueId` / `payerTenantId`; the seeder
  already writes club→league entry-fee obligations.

What's missing is only: (1) a league Connect route
(`/api/leagues/[id]/payment-config/connect` — the club route parameterized by
`leagueId`), (2) the `PaymentSettingsCard` mounted on
`manage/leagues/[id]/payments`, (3) the checkout route branching to
`getPaymentConfig({ leagueId })` when an obligation's payee is a league.
Build it in the same pass as club payments. Unlocks clubs paying their league
entry fee online (today offline-only).

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

## Decisions
**Owner decided 2026-07-07:** both charge modes (direct + destination)
supported for **clubs AND leagues**, built in the same pass; **default =
destination charge (PLATFORM_COLLECT)** — lighter onboarding, platform owns
the merchant side.

**ALL LOCKED 2026-07-07:**
1. **Hybrid (C) — APPROVED.** Stripe vault + auto-collect invoices + Smart
   Retries + dunning; our schedule + accept UX + pre-due reminders.
2. **Auto-charge on BOTH modes in v1 — APPROVED, no phasing.** Installments
   auto-charge on destination AND direct-charge accounts from v1 (direct
   needs the card saved on the connected account — build it in v1).
3. **Leagues in the same pass — APPROVED.** League Connect onboarding +
   online checkout parity built alongside clubs (data layer already ready).

Local tooling confirmed ready: real `sk_test_`/`pk_test_`/`whsec_` in
apps/web/.env.local + Stripe CLI in scratchpad → full test-mode build + verify.

## v1 build stages (consolidated, all decisions folded in)
- **A — Card-on-file** *(league-agnostic; building first)*: `User.stripeCustomerId`,
  SetupIntent + Payment-methods API (list/add/default/detach), saved-card UI
  (Stripe Elements). Cards on Stripe's vault, never us.
- **B — Offer payment terms**: OfferOption gains full-pay/plan + deposit +
  `OfferInstallmentTerm` rows; composer UI.
- **C — Deposit-gated accept**: family picks one option, pays deposit/full
  (on-session PaymentIntent, saves card) → only then ACCEPTED + rostered.
- **D — Schedule generation**: on accept, pre-create auto-collect invoices
  per installment (both modes).
- **E — Auto-charge (both modes)**: cron finalizes each invoice on its due
  date; Stripe charges + Smart Retries + dunning. Direct-charge = customer/
  card on the connected account.
- **F — Reminders**: our branded pre-due (email + push) via PaymentConfig
  lead-days; cron.
- **G — Statuses**: receipt on `invoice.paid`, failure handling on
  `invoice.payment_failed`, retries via Stripe dunning.
- **H — Parent forward-schedule view** + **League Connect parity**
  (connect route + settings card + checkout branch).

On "yes", I revise payments-plan-v2 stages E/F/G to the hybrid and start
Stage A (card-on-file), which is identical under any option.
