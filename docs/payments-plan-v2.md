# Payments v2 — offer terms, card-on-file, installments, reminders, statuses

Owner spec (2026-07-07). The culminating payments build: a club configures
payment terms **on the offer**, the family accepts one option and **pays the
deposit to accept**, the rest auto-charges on a schedule, everyone gets
reminders and status notifications. This doc is the full spec — build behind
an explicit go, in the stages below.

## 1. What EXISTS today (audit, 2026-07-07)

- **Stripe Connect** live: `CONNECT_DIRECT` (charge on club's account) and
  `PLATFORM_COLLECT` (destination charge), 7 admin postures, per-club
  `PaymentConfig` (`stripeAccountId`, fee overrides, offline methods).
- **PaymentObligation** = the debt; **Payment** = individual payments.
  Payment ALREADY has `dueDate`, `installmentNumber`, `relatedOfferId`,
  `stripePaymentIntentId` — the columns for installments exist.
- **Checkout** (`/api/obligations/[id]/checkout`) creates a **one-time,
  on-session** PaymentIntent per open amount. `automatic_payment_methods`,
  no saved card.
- **Webhooks**: `payment_intent.succeeded` / `payment_failed`,
  `charge.refunded`, `account.updated`. They flip Payment status; they do
  NOT notify the payer or drive retries.
- **Parent `/payments`**: "My payments" — obligations table + history, pay
  online when the org allows, else shows offline methods.
- **PaymentStatus**: PENDING · PROCESSING · SUCCEEDED · FAILED · REFUNDED ·
  DISPUTED.

## 2. What's MISSING (the whole gap)

1. **Card-on-file** — no Stripe Customer per user, no SetupIntent, no
   saved-card UI, no off-session charging. (Owner: "nowhere to add/store
   credit card info.")
2. **Offer payment terms** — `installments` is only a COUNT; no deposit,
   no per-installment amounts/dates, no full-vs-plan choice on the package.
3. **Deposit-gated accept** — accept takes no payment; you can accept
   owing everything.
4. **Schedule generation** — accept doesn't create the dated installment
   rows (fields exist, nothing fills them).
5. **Auto-charge** — nothing charges a saved card when an installment comes
   due. **No scheduled-job infrastructure exists at all.**
6. **Reminders** — none. No "due in 3 days" email/push; not configurable.
7. **Status notifications + retry** — webhook updates status silently; no
   success/failure email, no retry policy.
8. **Parent forward schedule** — /payments shows what's owed, not the
   upcoming installment timeline with per-installment status.
9. **Push notifications** — only in-app bells + email exist; no web push.

## 3. Model — owner decisions (LOCKED 2026-07-07)

- **Club configures everything at OFFER time**, per package (OfferOption).
  Fully open: one-time full payment, OR an installment plan = deposit +
  N installments with per-installment amount + due date. Parents never
  configure terms.
- **Family accepts ONE option and CANNOT accept without paying the
  deposit** (or full amount if that option is full-pay). No deposit → no
  roster spot.
- **Default plan** (editable): deposit = 25% due on accept, then 3 equal
  installments on the 1st of the next 3 months. Demo: $3,000 → $750 + 3×$750.
- **Reminders**: club-configurable lead time (e.g. 3 days), email + push,
  before each due date.
- **Statuses**: success → receipt email; failure → alert email + retry per
  Stripe; ongoing failure → club notified.

## 4. Feature areas / build stages

### A. Card-on-file (foundation — build first)
- Stripe **Customer** per User (store `stripeCustomerId` on User).
- **SetupIntent** flow + a "Payment methods" page (`/settings/payments` or
  under /payments): add card (Stripe Elements), list saved cards, set
  default, remove. New model `SavedPaymentMethod` (or read live from
  Stripe) — brand/last4/exp for display only; never store PAN.
- Card is attached to the platform Customer; for CONNECT_DIRECT clubs,
  cards may need to live on the connected account (Stripe caveat — see §7).

### B. Offer payment terms (club, at offer time)
- Extend **OfferOption**: `allowFullPay Boolean`, `allowInstallments
  Boolean`, `depositAmount Decimal?`; installment rows in a child
  `OfferInstallmentTerm { optionId, sequence, label, amount, dueDate |
  dueOffsetDays }`. Snapshot onto the accepted Offer (like sizes).
- **Composer UI** (offer-composer.tsx): per package, pick Full / Plan;
  Plan → deposit field + "Add installment" rows (amount + date), a
  generator button ("25% + 3 monthly"), live "sums to fee" validation.

### C. Accept-time, deposit-gated (family)
- Accept screen (offer-response-form): choose package → choose Full or Plan
  (only options the club allowed) → **pay deposit/full now**: enter/select
  card (Stripe Elements) → confirm PaymentIntent → only on success does the
  offer flip ACCEPTED + roster the kid.
- **Offline clubs**: deposit recorded by the club (accept can be "pending
  deposit" until the club marks it received) — confirm this path (§8 Q2).

### D. Schedule generation (on accept)
- Create the obligation for the full fee, then generate Payment rows: the
  deposit (SUCCEEDED once paid) + each future installment (PENDING with its
  `dueDate`, `installmentNumber`). Full-pay = one SUCCEEDED row.

### E. Auto-charge on schedule (needs A + a job runner)
- **New: scheduled-job infra** — Vercel Cron → a secured endpoint
  (`/api/cron/charge-due`) that runs daily: find installments due today
  with a saved default card, charge **off-session**
  (`off_session:true, confirm:true`) via the club's posture, update status
  from the webhook.
- No saved card (offline / card removed) → skip auto-charge, fall to
  reminder-to-pay.

### F. Reminders (club-configurable)
- `PaymentConfig` gains `reminderLeadDays Int @default(3)`,
  `reminderEmail Boolean`, `reminderPush Boolean`.
- **New cron** `/api/cron/payment-reminders` (daily): installments due in
  `leadDays` → email + (push) via existing `notifyMany` + `sendEmail`.
  Reuse the practice/schedule notify pattern (lib/teams/practices notifyTeam
  is the template).

### G. Statuses + notifications + retry
- Webhook success → **receipt email** to payer + mark Payment SUCCEEDED +
  advance obligation.
- Webhook failure → **failure email** ("card declined, we'll retry on X") +
  Payment FAILED + schedule retry (Stripe Smart Retries if using
  Invoices/Subscriptions, else our cron retries at +3d/+5d, then flags the
  club). Cap retries; after final failure notify club + payer.
- Surface DISPUTED/REFUNDED already handled — add payer emails.

### H. Parent forward-schedule view
- /payments upgrade: per obligation, show the **installment timeline** —
  each with amount, due date, status (paid ✓ / upcoming / failed-retrying),
  the card that will be charged, and "pay now" / "update card" actions.

## 5. Cross-cutting NEW infrastructure

- **Scheduled jobs** — none today. Vercel Cron entries in `vercel.json`
  (`crons: [{path, schedule}]`) hitting secured `/api/cron/*` (guard with a
  `CRON_SECRET` header). Two jobs: charge-due, payment-reminders. (Also
  unlocks future scheduled work — offer expiry sweeps, etc.)
- **Web push** — new capability (service worker + `PushSubscription` +
  VAPID keys). Larger; recommend **email-first v1, push as a fast-follow**
  so payments don't block on push plumbing (§8 Q3).

## 6. Schema additions (all additive — one runbook entry)
- `User.stripeCustomerId String?`
- `SavedPaymentMethod` (optional cache) or read live from Stripe.
- `OfferOption`: `allowFullPay`, `allowInstallments`, `depositAmount`.
- `OfferInstallmentTerm` (child of OfferOption) + snapshot fields on Offer.
- `PaymentConfig`: `reminderLeadDays`, `reminderEmail`, `reminderPush`.
- `Payment`: add `retryCount Int @default(0)`, `nextRetryAt DateTime?`
  (columns for dueDate/installmentNumber already exist).

## 7. Stripe specifics / compliance
- **Off-session charges** require the card saved WITH future-usage intent
  (SetupIntent `usage: off_session`) and SCA/`off_session` handling; some
  cards will still require authentication → those become a "needs action"
  reminder to the payer.
- **Connect nuance**: saved cards on the PLATFORM customer work for
  destination charges (PLATFORM_COLLECT). For CONNECT_DIRECT, the
  PaymentMethod must be on (or cloned to) the connected account — decide
  per posture; simplest v1: **installment auto-charge only for
  PLATFORM_COLLECT**, CONNECT_DIRECT clubs get reminder-to-pay. (§8 Q4)
- Idempotency keys on all off-session charges; never double-charge an
  installment (guard on `installmentNumber` + obligation).
- PCI: card data only via Stripe Elements/Customer — we store brand/last4
  for display, never the PAN.

## 8. Open decisions before building
1. **Deposit on accept**: online clubs charge the card at accept (blocks
   acceptance until paid) — confirmed. OK to require a card even when the
   plan is "full pay later"? (Recommend: deposit/full charged at accept
   always for online; offline = club records it.)
2. **Offline clubs**: accept flips to a "deposit pending" state the club
   confirms, or accept is blocked until the club records the deposit?
   (Recommend: pending-deposit state so the family isn't stuck.)
3. **Push**: email-first v1 with web push as fast-follow (recommended), or
   push in v1?
4. **CONNECT_DIRECT auto-charge**: reminder-to-pay v1 (recommended) or
   full off-session on connected accounts in v1?

## 9. Suggested build order (each a stage, tested, behind the go)
1. **A** card-on-file (Customer + SetupIntent + methods UI) — foundation.
2. **B + C + D** offer terms → deposit-gated accept → schedule rows
   (the visible flagship; makes the demo real end-to-end).
3. **H** parent forward-schedule view.
4. **F + G(reminders/receipts)** cron infra + reminders + status emails.
5. **E** auto-charge off-session (+ retry).
6. **Push** fast-follow.

Cross-refs: docs/payments-open-items.md (stage-5 QA notes),
docs/offer-package-options-design.md (§Follow-up — terms model),
docs/payments-design.md (original A2 flow).
