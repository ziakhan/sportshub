---
updated: 2026-07-20
status: committed
tier: 0
area: payments
effort: L
source: owner
tags: [theme/payments, type/plan, status/committed]
---

# 💸 Interac e-Transfer reconciliation ("no more midnight e-transfers")

> **OWNER COMMITTED 2026-07-20**: "definitely added to the plan, and we will implement
> them." Pricing ruling in the same message: parents choose their rail — **credit cards
> stay an option, offline stays an option, e-transfer becomes an option** — and our
> platform take targets **~1–2% (or flat equivalent) instead of the ~3%+ clubs pay
> elsewhere**, with the credit-card processing cost shown for what it is (the card
> networks' fee, not ours).

> **OWNER 2026-07-20**, from a real club-owner conversation: clubs resist card fees
> ("3–4%") and tracking parent e-transfers manually "is a pain in the butt." Solving
> reconciliation is a wedge feature — it also reframes our payments business model
> (flat fees instead of %). Our own ad creative already targets this pain
> ("midnight e-transfers" clubs spot).

## Fee facts (researched 2026-07-20)

- **Stripe Canada cards: 2.9% + C$0.30** domestic. On a $400 registration ≈ $11.90 (~3.0%).
  The club owner's "3–4%" is right *for cards* — and LeagueApps stacks up to ~5.9%
  platform fee ON TOP of processing (≈9% all-in).
- **Stripe ACSS pre-authorized debit (PAD): 0.8% capped at C$5** (cap from $625). On a
  $400 registration = $3.20; $1,000 = $5. Cards are the expensive rail, not Stripe itself.
- **Interac e-Transfer**: what parents already use; costs the club ~$0–1.50 per transfer
  depending on bank account. Reconciliation is the pain, not the price.
- **Interac e-Transfer for Business "Request Money"** (via API providers VoPay, Zūm Rails,
  Kapcharge, or bank commercial APIs): structured remittance (invoice number field, not
  memo free-text), real-time webhooks, limits to $25k, built exactly for auto-matching.
  Pricing is sales-quoted, flat per transaction (low single dollars, not %).

## Product: three tiers, ship in order

**Tier 1 — reference-code matching (no partner, ~free, ships fastest):**
- Every unpaid registration/invoice gets a short reference code (e.g. `SH-4F7K`) shown on
  the payment page + reminder emails: "e-Transfer to club@… and put SH-4F7K in the message."
- Club connects an ingest path for their bank's e-transfer notification emails
  (auto-forward rule → our ingest address via Cloudflare Email Routing → webhook parser).
- Parser extracts sender/amount/memo → auto-match on code (fallback amount+name fuzzy) →
  invoice marked paid; unmatched land in a one-click review queue (match/ignore).
- Club sees one screen: matched automatically vs needs-a-look. Kills the spreadsheet.

**Tier 2 — bank-feed matching (Flinks/Plaid):** read the club account's deposit feed
directly; no email fragility; same matching engine.

**Tier 3 — Interac Request Money (VoPay/Zūm Rails):** registration creates a Money
Request with the invoice number embedded; parent taps Accept in their banking app;
webhook marks paid instantly. Zero manual anything, flat fee per payment. This is also
the monetizable rail: a flat platform fee per e-transfer (e.g. $1–2, still ~10× cheaper
than 3% on typical amounts) replaces %-based revenue the clubs refuse.

## Business-model implication (feeds the pricing discussion — NOT FINAL)
Offer clubs the fee menu instead of forcing cards: cards 2.9%+30¢ (parent convenience),
PAD 0.8% cap $5 (installments), e-transfer + auto-reconciliation (flat). We monetize per
registration / SaaS / flat per-transaction, not by skimming %, which is exactly the
LeagueApps resentment we heard live from a club owner.

## Acceptance (tier 1)
- A parent pays by e-transfer with the code; within minutes the registration shows paid
  with zero admin touches; unmatched transfers appear in the review queue.

## Refs
[[accounting-exports]] · [[leagueapps-comparison]] · [[_moc-payments]] · Stripe pricing:
stripe.com/pricing + stripe.com/payments/canada-pads-debit · interac.ca Business Request
Money · vopay.com/etransfer · docs.zumrails.com Interac e-Transfer
