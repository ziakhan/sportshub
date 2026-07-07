# Offer package options — design (2026-07-07) — ✅ SHIPPED same day (+ bulk send)

Owner: clubs need to give families **multiple package options in one
offer** — canonically "Returning player" (no uniform/bag/ball — gear
doesn't change) vs "New player" (full kit, higher fee). Open fork posed:
*two templates attached to one offer, or one template with multiple
options inside?*

## Current state (facts)

- `OfferTemplate` = club-scoped named package ("Standard", "Premium"):
  seasonFee, installments, practiceSessions, 5 include-booleans.
- `Offer` **copies the template's fields at send time** (snapshot,
  tweakable per offer) and holds ONE `templateId`. Family accepts or
  declines — no package choice. Accept collects sizes + jersey prefs.
- Everything downstream — Order Sheet roll-up, PaymentObligation,
  auto-roster — reads the **offer's snapshot columns**, never the
  template. (This is the architectural gift: change what fills the
  snapshot, and nothing downstream moves.)
- A club can already fake it today: create "Returning 2026" and "New
  2026" templates and hand-pick per player — but the club must remember
  who's returning, the family gets no say, and twin templates drift.

## Recommendation: one offer, multiple PACKAGES; templates stay simple

Neither of the two posed options exactly — a composition of both:

- **Templates stay what they are** — single, named packages. No
  sub-options inside the template editor, no migration of existing
  templates.
- **The OFFER gains options**: new table `OfferOption` (offerId FK,
  label, sourceTemplateId, seasonFee, installments, include-booleans,
  sortOrder, optional `audience` tag — see below). The send form's
  template dropdown becomes a multi-select: attach 1..N templates as
  choices, tweak each inline (exactly like today's single-template
  tweak).
- **The family picks the package at accept time**: accept screen shows
  the options side by side (fee + what's included), radio-select, then
  the sizes form adapts — returning package with no uniform asks no
  uniform size.
- **On accept, the chosen option's fields copy into the offer's existing
  snapshot columns.** Order Sheet, payments, roster: zero changes.
  Single-option offers behave exactly as today (auto-chosen).

### Why not the two posed alternatives

- **Two OFFERS attached per player**: two PENDING rows, double expiry,
  double emails, "accept one auto-declines the other" status gymnastics,
  Order Sheet double-counting risk. Lifecycle mess for no gain.
- **Options INSIDE OfferTemplate**: forces every simple club through a
  more complex template editor; couples package variants to one template
  object when clubs may want to mix existing templates ("Standard" +
  "Premium" as an upsell choice — same machinery, free feature); bigger
  migration. The offer is where a choice belongs — it's the thing the
  family responds to.

### The creative piece: returning-player intelligence

The platform already knows who's returning — prior season rosters
(TeamPlayer / SeasonRoster history) are in the DB:

1. **"Returning" badge** on tryout signup rows (played for this club
   before — show which team/season). Costs one query; helps check-in and
   offer decisions even before this feature ships.
2. **Audience guard (optional per option)**: mark an option "returning
   players only" — the accept screen only unlocks it when the platform
   (or the club, via override) flags the player as returning. Prevents a
   new family self-selecting the discounted package. Default = open
   choice; the guard is opt-in per option.
3. **Jersey continuity**: returning players usually keep their number —
   prefill jersey pref 1 from last season's assignment.

### Send-time walkthrough (owner clarification 2026-07-07)

The club's template LIBRARY is untouched — 20 templates is fine; nothing
attaches automatically. At send time, today's single-select template
dropdown becomes "[+ Add option]" over the same list: each added template
stamps a tweakable option card onto THIS offer (typically 1-2 of the 20).
One option = today's behavior exactly.

```
Make Offer — Mateo R. → Lords Grade 9      [Returning: Lords G8 '25-26 ✓]
┌──────────────────────────────┐ ┌──────────────────────────────┐
│ ① Returning Player  ($950)   │ │ ② New Player  ($1,250)       │
│   seeded from "Returning     │ │   seeded from "Standard      │
│   2026-27"; items+fee        │ │   2026-27"; items+fee        │
│   tweakable        [remove]  │ │   tweakable        [remove]  │
└──────────────────────────────┘ └──────────────────────────────┘
[+ Add option ▾]   Message ____  Expires 7d   [Send Offer]
```

Family view — one offer, one expiry, one decision:

```
Choose your package:
( ) Returning Player — $950 · no new kit needed
(•) New Player — $1,250 · includes uniform, bag, ball
[uniform size ▾] [jersey pref] ...  ← asks only what the chosen package includes
```

Structure in one sentence: Templates = reusable library (any size);
Offer = one per player; OfferOption = the 1-3 packages the club chose to
present on that offer, each a COPY seeded from a template (later template
edits never disturb sent offers — same rule as today).

### Scope sketch (when green-lit)

- Schema: `OfferOption` table + `Offer.chosenOptionId` (nullable; null on
  single-option/legacy offers) — additive, one runbook entry.
- Send form: template multi-select + per-option tweak panel (reuse the
  existing tweak UI). Offer emails list the choices.
- Accept form: package radio + conditional sizes (skip sizes for items
  the chosen package doesn't include).
- Public/parent offer view + offers dashboards: show "2 options" until
  responded, then the chosen label.
- Order Sheet: unchanged (reads snapshot); optional per-package column
  later.
- Tests: int suite on offers (multi-option accept fills snapshot;
  audience guard; single-option unchanged).

Rough size: comparable to the tryout check-in feature — a focused day.

## Status (post-ship)

Owner approved the recommended shape + asked for bulk structure — both
shipped 2026-07-07 (runbook #14, int seed 1124). Bulk: "Send Offers (N)"
on the tryout signups page — compose packages once, tick players, per-row
skip reasons. **Returning-player intelligence (badge / guard / jersey
prefill) DEFERRED by owner ("deal with this later")** — design below
stands ready.

## Original decision points (resolved)

1. Approve the "one offer, N packages from simple templates" shape (vs
   options-inside-template)?
2. Is the returning-only **audience guard** wanted at v1, or is open
   family choice fine to start?
