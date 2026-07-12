---
updated: 2026-07-12
status: draft
tier: 1
area: gtm
effort: M
source: owner
tags: [theme/gtm, type/research, status/draft]
---

# 📈 Business-model scenarios — 4-year projections

Companion to [[business-model]]. Deterministic model at
`scripts/research/revenue-model.py` (re-run any time; every assumption is a
named constant at the top). All CAD. **These are planning models, not
forecasts** — GMV assumptions dominate everything.

## The four variants tested

| | Club software | Take-rate (free/paid) | Family Pass | League fee |
|---|---|---|---|---|
| **A — Rails-led** | free, unlimited | 2.5% / 1.0% | $79 @ 4% attach | $29/team/season |
| **B — SaaS-led** | free capped at 3 teams → Plus $399 / Pro $999 | 0.75% flat | $79 @ 4% | $29 |
| **C — Consumer-led** (GameChanger clone) | 100% free, no subs | 1.0% flat | $99 @ 8% (hard gating) | $19 |
| **D — Hybrid rails+relationship** | free unlimited + one "Pro Ops" tier $599 @ 20% attach | 2.0% / 1.0% | $79 @ 6% | $39 media |

Shared assumptions (base): active clubs 25 → 70 → 160 → 340 (Ontario
basketball → +volleyball → +national; Y4 = 36% of expanded TAM); 8 teams &
88 families per club; $1,400 avg annual fees; 70% of clubs run payments
through us × 80% wallet share; leagues 2→4→8→14 at 180 teams × 2 seasons;
AI-stream engine from Y2 (600 → 3,000 → 9,000 covered games at ~$14 net
per game after QA labor + infra, camera capex expensed); lean cost base
(contract support from Y2, founders excluded). Variant B pays an adoption
haircut (-20%) because team caps throttle the viral loop — the owner's
"easy to jump in" instinct, made numeric.

## Results (base adoption)

**4-year cumulative profit:**

| Variant | Y1 revenue | Y4 revenue | 4-yr cumulative profit |
|---|---|---|---|
| A — Rails-led | $69K | $920K | **$1.17M** |
| B — SaaS-led | $43K | $578K | $0.58M |
| C — Consumer-led | $48K | $693K | $0.76M |
| **D — Hybrid** | **$73K** | **$927K** | **$1.19M** |

**Year-4 revenue by adoption scenario (low / base / high):**

| Variant | Low | Base | High |
|---|---|---|---|
| A | $596K | $920K | $1.26M |
| B | $425K | $578K | $740K |
| C | $458K | $693K | $943K |
| D | $625K | $927K | $1.25M |

**Year-4 revenue mix in D:** payments take $422K (46%) · leagues $197K ·
Family Pass $142K · AI-stream $126K · club subs $41K.

## What the model says, plainly

1. **Gating the front door is the one clearly losing move.** Variant B —
   classic SaaS tiers with free-tier caps — finishes ~50% behind on
   cumulative profit. The caps tax adoption, and adoption is the input every
   other engine multiplies. The owner's instinct is arithmetically right.
2. **The rails are the business.** In every winning variant the payments
   take is the largest line (~46% of Y4 revenue). Every 50bps on the
   free tier ≈ ±$44K/yr at Y3 scale — the single most powerful lever we
   control. This engine is already built (`platformFeeBps`).
3. **Family monetization is a Y3+ compounder, not a Y1 driver.** Attach
   moving 2%→10% shifts Y3 by only ±$45K — but by Y4 (30K families on
   platform) each point of attach ≈ $24K/yr. Grow the base free; tighten
   gates later. Price moves ($59→$119) matter less than attach.
4. **Pure GameChanger cloning (C) leaves club money on the table.** Their
   model works at US national scale; at our beachhead scale the club rails
   out-earn families 2:1.
5. **AI-stream is a real third leg by Y4** ($126K net at conservative
   coverage) and it strengthens Family Pass attach — they compound.

## Recommendation: run D, with A's front door

- **Free = unlimited teams, unlimited rosters, live scoring, chat, RSVP,
  calendar, public pages.** No caps anywhere a parent or coach can feel
  them. Every coach invitation imports 11 families — the viral loop is the
  acquisition budget.
- **Take 2.0% + $0.30 on registrations from day one** (half of Spond
  Canada's 5%; below SportsEngine's 3.75%). Revenue scales with usage, not
  sales calls. Paid club tier buys it down to 1.0%.
- **One club tier, not three:** "Pro Ops" $599/yr (or $349/season) —
  marketing/comms center, analytics, tournaments module, priority support,
  fee buydown. One decision for a volunteer board, not a matrix.
- **Family Pass $79/yr household** launches once 3+ leagues are
  live-scoring weekly; gates = kid-specific real-time alerts, full game
  logs, downloadable highlights, keepsakes. Club-bundled wholesale at $49
  via the obligation engine (the SportsRecruits channel lesson).
- **Leagues $39/team/season media tier** (NPH design-partner season free —
  owner to confirm), core ops $19.
- **AI-stream (Y2 pilot):** one venue cluster, cameras + human QA
  overseer, PPV $8 / bundled into a $19.99 Family Pass+ tier. BallerTV
  paywalls *everything* — our free live box scores + paid video line is
  the sharper wedge.

### The hook → dependency → upsell funnel (why "hard to leave" is real)

1. **Hook** (free, no caps): coach adopts for scheduling+RSVP+chat → invites
   every parent → league sees clubs already on-platform.
2. **Dependency** (data gravity): payment history, rosters, stats history,
   AI recaps, player pages, league schedules, media library — none of it
   portable to TeamSnap/Spond/Exposure, all of it compounding weekly.
3. **Upsell moments** (in-product, not sales calls): club hits its first
   200-family season → Pro Ops analytics prompt; parent's kid scores in a
   live game → "get every moment" Family Pass prompt on the live page;
   league finishes season 1 → media-tier recap reel of what families saw.

## What would change the answer
- If payments attach lands < 40% (clubs keep e-transfer habits), take
  revenue halves → push Pro Ops attach + Family Pass earlier.
- If a US-style national player (TeamSnap/SE) launches aggressive Canadian
  pricing, the take-rate umbrella shrinks → lean harder on the media/content
  moat (recaps, streams) they can't replicate quickly.
- Volleyball expansion slipping moves Y3/Y4 to the "low" column — still
  profitable in D, but Y4 ≈ $625K.

⬅ [[business-model]] · [[club-segmentation-taxonomy]] · `scripts/research/revenue-model.py`
