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

### C2 — Family accept-payment UI — ✅ BUILT + VERIFIED 2026-07-07
`offer-response-form.tsx` now runs the full payment step: Full-vs-Plan choice
(shows deposit + dated installment schedule), and — the owner's refinement —
**a card already on file is used one-click** (no re-entry); only a family with
no card sees the Stripe Elements field; offline clubs accept with no card.
New `GET /api/offers/[id]/payment-info` (online?, currency, per-option terms,
saved cards — context-aware: platform customer for destination, connected-
account customer for direct). `pay-intent` gained saved-card server-confirm.
**Server now ENFORCES payment** — online club + a fee → accepting without a
confirmed deposit returns PAYMENT_REQUIRED (can't bypass from the client).
Live QA caught + fixed 2 real bugs (saved-card PI needed `payment_method_types`;
the missing server-side enforcement). Int test covers enforcement + accept.
Every case covered: saved card / new card / different card / offline / free.

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

### H1 — Direct-charge unattended auto-charge QA — ✅ VERIFIED 2026-07-07
Proven end-to-end in Stripe test mode against a fully-activated test
connected account (`scripts/qa-payments-setup.ts`): accept an INSTALLMENTS
offer → deposit charged on the connected account → schedule + draft invoices
created → finalize each invoice (what the cron does) → **the saved card was
auto-charged, both installments settled to SUCCEEDED via the invoice.paid
webhook, receipts sent.** This QA CAUGHT + FIXED a real bug (Stripe rejects
`due_date` on `charge_automatically` invoices). Residual: nothing blocking —
the same code serves destination charges (verified by int test + the finalize
mechanism is identical).

### H2 — Stripe stage-5 QA with test clocks — 🟢 CORE VERIFIED, timing pass optional
Done live in test mode: real deposit charge, real installment auto-charge via
invoice finalize → invoice.paid webhook → SUCCEEDED + receipt; failure branch
(invoice.payment_failed → stays PENDING for Smart Retries + failure notice)
locked by int test (invoice-webhooks.int.test.ts). STILL NICE-TO-HAVE before
prod: a **test-clock** run that advances real calendar months so the Vercel
cron actually fires on schedule end-to-end (vs. us finalizing manually), and
a real Stripe decline → Smart Retries observation. Not a hard gate now that
the mechanism is proven. Me.

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
- **M5 — Onboarding/help/videos** + **homepage-IA cleanup** (homepage promo-for-signed-in REMOVED 2026-07-07; menu-IA + getting-started nudge remain) — adoption/GTM
  polish, not a hard gate (docs/onboarding-tutorials-plan.md, home-redesign-
  plan.md, site-ia-plan.md).

---

## 👤 Owner action queue (things only you can do — start in parallel)

Roughly in lead-time order. I can't do any of these; they need your
business identity, bank, domain/DNS, vendor accounts, or a lawyer.

1. **Legal (start FIRST — longest lead time)** [C4]: get Terms of Service,
   Privacy Policy, and a refund/cancellation policy drafted, plus a COPPA
   review (minors' data). A service like Termly/iubenda gives templates;
   given youth + payments, have a lawyer review. This takes calendar time —
   kick it off now.
2. **Stripe account** [C3/H1]: finish activating your Stripe account
   (business details + bank). Then in the Dashboard: (a) get the **live**
   API keys, (b) in Billing → turn ON **Smart Retries** + **customer
   failed-payment emails** (this IS our recovery engine — it's a dashboard
   toggle), (c) decide your **platform fee %**. The prod webhook endpoint we
   create together once there's a live URL.
3. **Email provider** [C1]: sign up for Resend (easiest) or Postmark. Verify
   your **sending domain** by adding the DNS records they give you
   (SPF/DKIM/DMARC) so mail lands, not spams. Give me the SMTP creds to set
   on Vercel. Nothing emails in prod until this is done.
4. **Domain & DNS** [C1/C5]: confirm you control the production domain and
   its DNS (needed for email auth + the live site).
5. **Product decisions I need from you** (quick, but they gate config):
   default **platform fee %**, default **reminder lead days** (we default 3),
   **refund policy** wording, and **which clubs launch first**.
6. **Do the owner click-through** [H3]: run the demo end-to-end yourself
   (create club → team → tryout → offer → accept) and tell me what feels
   wrong. You've flagged this hasn't been done — your eyes catch things tests
   don't.

Give me your answers to #5 (and the creds from #2/#3) and I wire them; the
rest are yours to drive.

## How this list is used
I append here as I build. Nothing here blocks *local* development — these are
the gates between "works on the demo" and "safe with real families and real
money." Cross-refs: docs/pending-deploy-actions.md (the runbook),
docs/payments-plan-v2.md, docs/outstanding-items.md (master ledger).
