# Launch blockers — must-fix before going live

Living list. I add to it whenever I build something that isn't launch-safe on
its own, or spot a gap. **CRITICAL** = cannot launch without. **HIGH** =
launch-day risk, fix before or immediately at go-live. **MEDIUM** = quality/
scale, not a hard gate. Owner = who acts (me = buildable in-code; owner =
account/legal/vendor; legal = needs a lawyer).

Last updated 2026-07-07.

---

## 🔴 CRITICAL

### C1 — Production email provider (nothing emails without it)
Email is nodemailer → `SMTP_HOST` defaulting to `localhost:1025` (Mailpit).
`.env.example` ships `SMTP_HOST="localhost"`, no user. **In production, with
no real SMTP provider, ZERO emails send** — offers, payment receipts, payment
reminders, schedule-published, practice announcements, staff invites, all
silently fail. Pick a provider (Resend/Postmark/SendGrid), set
`SMTP_HOST/PORT/USER/PASS/FROM` on Vercel, and set up domain auth
(SPF/DKIM/DMARC) so mail lands. Owner + me (wiring).

### C2 — Family accept-payment UI is not wired (payments feature unreachable)
The payments v2 backend is done (pay-intent, deposit-gated accept, schedule),
but `offer-response-form.tsx` (the screen a PARENT uses to accept) still just
POSTs `{action:"accept"}` — it does NOT show the Full-vs-Plan choice, call
`/api/offers/[id]/pay-intent`, render Stripe Elements for the deposit, or send
`depositPaymentIntentId`. So a family literally can't pay a deposit or pick a
plan through the UI, and the "can't accept without the deposit" rule isn't
enforced from the client. **This is the completion of Stage C/H** — buildable
now. Me.

### C3 — Stripe production setup
Live keys (`sk_live`/`pk_live`), a prod webhook endpoint subscribed to
`payment_intent.succeeded/failed`, `charge.refunded`, `account.updated`, AND
the new `invoice.paid`/`invoice.payment_failed`; and `CRON_SECRET` on Vercel
(the two `/api/cron/*` jobs fail closed without it). Partly in deploy runbook
§1 — extend with the invoice.* events + CRON_SECRET. Owner (dashboard) + me
(verify).

### C4 — Legal / compliance (youth + money)
A platform handling minors' data and taking payments can't go live without:
Terms of Service, Privacy Policy, refund/cancellation policy surfaced to
families, and a COPPA review of data handling (the model already avoids
under-13 accounts — good — but consent flows + privacy policy need sign-off).
PCI posture is sound (Stripe Elements only, we never store PANs) but confirm
no card data is logged. Legal + owner.

### C5 — The deploy train itself
~40+ unpushed local commits; Neon runbook entries **#4–#17** NOT applied
(schema for every feature this session); Vercel env vars (Stripe, CRON_SECRET,
SMTP_*, optional ANTHROPIC_API_KEY). Must run the runbook in order, then push.
Owner-gated (production). Owner + me.

---

## 🟠 HIGH

### H1 — Direct-charge unattended auto-charge QA
Installment auto-charge for CONNECT_DIRECT clubs (card saved on the club's
connected account via `ConnectedCustomer`) is implemented but NOT live-tested
— it needs a fully-onboarded test connected account with charges enabled.
Either QA it end-to-end (test clocks) or **disable direct-charge auto-charge
at launch** and let those clubs use reminder-to-pay until verified. Me + owner.

### H2 — Stripe stage-5 QA with test clocks
Fast-forward simulated months to watch a deposit + 3 installments charge,
a card decline trigger Smart Retries + dunning, and receipts/failure emails
fire. Automated tests can't simulate time; this is a manual pass. Me.

### H3 — Payments backend human review
Stages 3–4 (obligations/postures) and now B–H were built largely unattended.
A careful human/second-model review of the money paths (fees, refunds,
idempotency, no double-charge) before real money moves. Owner + me.

### H4 — Review moderation
Reviews are writable by any signed-in user and shown on public `/club/[slug]`
pages, with the moderation-queue UI unbuilt. Spam/abuse/defamation risk on a
public youth-sports site. Build a moderation queue or gate review publishing
before launch. Me.

---

## 🟡 MEDIUM (quality / scale — not hard gates)

- **M1 — Chat polling scalability**: dock summary (30s) + open chats (5s) per
  signed-in user. Fine at demo scale; the dominant Vercel-invocation cost at
  real volume. Owner's queued "chat scalability" discussion → realtime/push.
- **M2 — Web push**: payment reminders + notifications are email/bell only;
  push is a fast-follow (`reminderPush` flag exists, no delivery yet).
- **M3 — ANTHROPIC_API_KEY** for AI recaps — deterministic template fallback
  works, so soft; set the key for real recaps.
- **M4 — Neon autosuspend** (perf): free-tier pause = slow first prod load;
  confirm/upgrade compute. (docs/perf-audit-2026-07-06.md)
- **M5 — Onboarding/help/videos** + **homepage-IA cleanup** — adoption/GTM
  polish, not a hard gate (docs/onboarding-tutorials-plan.md, home-redesign-
  plan.md, site-ia-plan.md).

---

## How this list is used
I append here as I build. Nothing here blocks *local* development — these are
the gates between "works on the demo" and "safe with real families and real
money." Cross-refs: docs/pending-deploy-actions.md (the runbook),
docs/payments-plan-v2.md, docs/outstanding-items.md (master ledger).
