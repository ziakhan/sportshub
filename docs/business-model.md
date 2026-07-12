---
updated: 2026-07-12
status: draft
tier: 1
area: gtm
effort: L
source: owner
tags: [theme/gtm, type/plan, status/draft]
---

# 💰 Business model — pricing & packaging v2

**Owner brief (2026-07-12):** three-plus audiences (clubs primary, leagues,
families; creators later), freemium entry that hooks, then upsell hard.
Built on the July-6 GTM census (183 clubs / 824 teams, [[club-segmentation-taxonomy]])
and a fresh 106-claim competitor pricing sweep (sources at bottom;
✓ = adversarially verified, ○ = official pricing page, △ = third-party reported).

---

## 1. What the market actually charges (July 2026)

### Management platforms (club/league ops)

| Competitor | Model | Numbers |
|---|---|---|
| **SportsEngine HQ** | SaaS + take-rate | ✓ $58/mo annual ($69 monthly) **+ 3.75% + $1.75 per transaction**; bigger orgs quote-only. Families pay the fee on top. |
| **LeagueApps** | Pure take-rate | ✓ $0 subscription; % of every online registration (rate quote-only; △ industry norm 3–5%) + one-time onboarding fee. Offline payments free. |
| **TeamSnap (consumer)** | Freemium team app | ○ Free = 15-player cap + ads, **no availability/RSVP**; Premium $15.99/mo / $120/yr; Ultra $21.99/mo / $150/yr; payments 3.25% + $1.50 (≈ +0.35% + $1.20 over Stripe). |
| **TeamSnap Clubs & Leagues** | Quote-only | ✓ no published prices; registration-volume-linked. |
| **PlayMetrics** | Quote-only SaaS | ✓ no public prices, no free tier; club is the buyer. |
| **Spond / Spond Club** | Free app + take-rate | ○ app 100% free; all-in payment fee **CANADA: 5% + $0.50 CAD** (vs 2.5% + €0.20 EU, 3.29% + $1.00 US). Club absorbs by default, can pass through. |
| **Heja** | Freemium + ads | ○ free tier is ad-supported; Team Pro $8.33 (team-level); **Team Pro Max exists mainly to remove ads for families**; club pricing quote-only. |
| △ Industry norms | — | take-rates 3–5% of registration revenue; per-player $0.50–$5/season; SaaS $20–$500+/mo; enterprise $5K–$50K/yr. |

### Scoring / stats / streaming

| Competitor | Model | Numbers |
|---|---|---|
| **GameChanger** (DICK'S) | Free for teams, families pay | ○ scoring/streaming/team mgmt **100% free for staff**; families: Plus $9.99/mo / $39.99/yr, Premium $14.99/mo / $99.99/yr, **Family Plan $179.99/yr (4 seats)**; one-time Team Pass unlocks a whole team. |
| **Hudl (club basketball)** | Per-team SaaS | ○ Bronze **$400/team/yr**, Silver $1,000, Gold $1,600; Assist extra; club-wide quote-only. |
| **Hudl Fan** | Family PPV/sub | ○ $8/game, $15/mo, $75/yr (varies by org). |
| **BallerTV** | Family subscription | ○ Bronze/Silver/Gold ≈ $7.95–$39.95/mo depending on term; **no free viewing at all**. |

### Events / exposure (what NPH pays today)

| Competitor | Model | Numbers |
|---|---|---|
| **Exposure Events** | Per-credit micro-pricing | ○ **$2.00 per scheduled team per event** (100-team event = $200); registration take = $0 (processor fees only); EventStore +1%; marketing $30/event; branded app $299 one-time. |
| **SportsEngine Tourney** (ex-Tourney Machine, now Versant/SportsEngine, not Stack) | Quote-only | ○ no public pricing, no free trial. |

### Recruiting profiles (future layer)

| Competitor | Model | Numbers |
|---|---|---|
| **NCSA** | Family, quote-only | ○ free profile; paid tiers (Champion→MVP+) undisclosed; △ **$1,500–$6,000+** reported, cancellation complaints. |
| **SportsRecruits** | Family freemium | ○ free profile + unlimited video; **Pro $399/yr or $99/mo**; △ often **club-bundled below retail** — the channel that works. |

### The four strategic reads

1. **The market's real engine is the payments take, not the subscription.**
   LeagueApps charges no SaaS at all; SportsEngine stacks 3.75% + $1.75 on top
   of $58/mo; Spond charges Canadians **5% + $0.50 all-in** — double its EU
   rate. Our per-club `platformFeeBps` on Stripe destination charges is this
   exact machine, already built.
2. **GameChanger proved the family model we planned:** free scoring builds the
   audience, families pay ~$100–180/yr to *follow*. Our planned ~$10/mo Family
   Pass sits exactly on the validated point.
3. **Leagues don't feel software pain in dollars — Exposure costs NPH a few
   hundred a season** while NPH *collects* ~$3,990/team × 230 teams ≈ $918K.
   Selling leagues "cheaper software" is selling into a rounding error. Sell
   the outcomes Exposure doesn't have (live content, recaps, app, engaged
   families, sponsor surface) priced per-team-per-season — invisible inside
   their team fee.
4. **Hudl proves clubs pay real per-team money ($400–$1,600/team/yr) for
   video/stats.** Our club tiers bundle the ops suite *plus* the
   scoring/recap/content layer at a fraction of one Hudl team.

---

## 2. The SportsHub model — four revenue engines

**Positioning: "Free to play, fair to pay."** Every audience gets a genuinely
useful free layer (the hook + network effect); money comes from ops depth
(clubs), per-team platform fees (leagues), the relationship layer (families),
and a transparently low payments take that undercuts Spond/SportsEngine
loudly in Canada.

### Engine A — Clubs (primary payer) · maps to `TenantPlan` FREE/BASIC/PRO

Billing per **season** (owner call: Fall-Winter-Spring "school year" season +
Summer season) with an annual = 2-seasons-for-less option. CAD pricing.

| | **STARTER — free forever** | **CLUB PLUS** (`BASIC`) | **CLUB PRO** (`PRO`) |
|---|---|---|---|
| Price | $0 | **$249/season or $399/yr** | **$649/season or $999/yr** |
| Teams | up to 3 | unlimited | unlimited |
| Registration + payments (tryouts/camps/HL) | ✅ (take-rate below) | ✅ | ✅ |
| Rosters, schedules, RSVP, team chat, calendar, push | ✅ | ✅ | ✅ |
| **Live scoring + box scores + standings** | ✅ **never gated** | ✅ | ✅ |
| Public club page | basic | + customization (branding, blocks) | + full microsite |
| AI game recaps + covered posts | last 3 visible | ✅ full | ✅ full |
| Marketing/comms center (consented email blasts, season re-engagement) | — | ✅ | ✅ |
| Tryout→offer pipeline w/ templates, bulk offers, order sheets | 1 active tryout | ✅ | ✅ |
| Practice scheduling + polls + program staff | — | ✅ | ✅ |
| Tournaments hosting module | — | — | ✅ |
| Analytics (pipeline, revenue, attendance) | — | basic | ✅ advanced |
| Platform fee on registrations | **2.0% + $0.30** | **1.25% + $0.30** | **0.75% + $0.30** |

*Why these numbers:* PLUS ≈ half of one Hudl Bronze team for the whole club;
PRO ≈ one Hudl Silver team. Against SportsEngine ($696–828/yr + 3.75%/txn)
both tiers read as bargains. The bps ladder is the Shopify pattern — the
subscription buys down the take, so big clubs upgrade on math alone.
Segments ([[club-segmentation-taxonomy]]): house-league orgs (seg 5) live on
STARTER + take-rate; rep clubs (seg 3, 10–40 teams) are PLUS; hybrids/prep
(segs 1/2/4, multiple budgets) are PRO.

### Engine B — Leagues · per-team-per-season

| | **LEAGUE CORE** | **LEAGUE MEDIA** |
|---|---|---|
| Price | **$19/team/season** | **$39/team/season** |
| Scheduling substrate, registration, rosters, standings, referee booking | ✅ | ✅ |
| Live scoring console + live pages + leaders | ✅ | ✅ |
| AI recaps, league news hub, covered posts | — | ✅ |
| Branded league hub + sponsor slots | — | ✅ |
| Native-app presence (scores, alerts) | ✅ | ✅ + featured |

*Anchors:* NPH pays Exposure ~$2/team/event today — we do not compete on
that number; $39/team/season is **under 1%** of the $3,990/team NPH collects,
and buys them a media product they currently can't offer. NPH at ~230 teams
× 2 seasons ≈ **$9K–18K/yr** from one operator. Alternative for operators who
move team-fee collection onto us: waive per-team fee for **1.5% of collections**
(NPH scale ≈ $13.7K/yr) — same money, zero sticker.

### Engine C — Families · freemium relationship layer (maps to `hasFamilyPass()`)

- **Free forever:** follow teams, live scores, schedules, RSVP, chat, push,
  recaps, iCal. This is the moat — GameChanger-parity, never degrade it.
- **FAMILY PASS — $9.99/mo or $79/yr CAD, household (all kids + grandparents,
  4 seats):** kid-specific real-time alerts ("Trey checked in", "Trey scored"),
  full personal game logs + advanced stats, downloadable highlight clips,
  season keepsakes discount, priority RSVP reminders. Anchor: GameChanger
  Premium $99.99 USD/yr (≈$135 CAD) — we're the cheaper CAD-native option.
  Channel per SportsRecruits' lesson: **club-bundled** at $49/yr wholesale via
  the obligation engine (club adds it to fees; everyone wins).
- **Later — EXPOSURE PASS (~$149/yr):** verified player page, film room,
  recruiter visibility, creator highlights. Villain pricing vs NCSA's
  reported $1,500–6,000; distribution via clubs like SportsRecruits Pro.

### Engine D — Payments take (the quiet compounding engine)

Already built (`platformFeeBps`/`platformFeeFlat` + destination charges).
Public rate card, all-in language, positioned against Spond's Canadian
5% + $0.50: *"Canadian clubs shouldn't pay double."* Take applies to
registrations we process (tryouts, camps, house league, league team fees) —
never to Family Pass or donations. Offline payments: free (LeagueApps
parity).

### Later engines (documented, not launched)
Creator marketplace (70/30 rev-share on paid highlight packages / PPV),
keepsakes (one-time), sponsor placements on league hubs, streaming when
volume justifies (BallerTV's paywall-everything model shows the demand;
their no-free-tier posture is our opening).

---

## 3. Launch sequencing (all gates already in code)

1. **Now → first 10 clubs:** everything free (`ENFORCE_FEATURE_GATES` off),
   take-rate ON at Starter levels from day one (2% + $0.30 — nobody balks;
   it's half of Spond CA). Revenue from day one without a single sales call.
2. **Season 2:** flip feature gates; grandfather founding clubs at PLUS for
   Starter price for a year (lock-in + testimonials).
3. **Family Pass:** launch after 3+ leagues live-scoring weekly (content
   density makes the alerts worth paying for) — the P3 trigger from the
   content plan.
4. **NPH:** design-partner offer — LEAGUE MEDIA free for season 1 in exchange
   for exclusivity in their circuits, co-branding, and the case study; list
   price season 2. (Owner to confirm.)

## 4. Year-1 realistic revenue sketch (Ontario beachhead, conservative)

| Engine | Assumption | ARR (CAD) |
|---|---|---|
| Clubs | 20 paying (15 PLUS, 5 PRO) of 183 censused | ~$11K |
| Take-rate | 30 active clubs × $50K avg processed × ~1.5% blended | ~$22K |
| Leagues | NPH (yr-2 pricing) + 2 smaller ops | ~$12K |
| Family Pass | 400 households × $79 (+ club-bundled) | ~$32K |
| **Total** | | **~$75–80K** |

Not venture-scale year one — but every engine compounds with the census
(183 clubs, 824 teams is just Ontario basketball), and engines B+C are
near-zero marginal cost.

## 5. Open questions for the owner

1. **Take-rate on the free tier:** 2% + $0.30 from day one (industry-normal,
   funds the free tier), or launch at 0% to maximize trust and flip later?
2. **NPH deal shape:** free design-partner season for exclusivity + case
   study, or charge from day 1?
3. **Family Pass unit:** household at $9.99/mo (recommended, GC Family-Plan
   pattern) vs per-kid?
4. **Seasonal vs annual default** for club tiers — bill each season (matches
   club cash flow) with annual as the discount, or annual-first?
5. **Live scoring free forever** at every tier — confirm this is untouchable
   (my strong recommendation; it's the audience machine GameChanger proved).
6. **Creator rev-share** target when that launches — 70/30? 80/20?

## Sources & confidence
Adversarially verified (2-of-3+): SportsEngine HQ pricing page (Jan-2026
update), LeagueApps pricing page, PlayMetrics pricing page, TeamSnap pricing
page. Official-page single-fetch: Spond fee schedule, Heja pricing/help,
GameChanger pricing, Hudl club-basketball pricing, Hudl Fan help, BallerTV
pricing article (Jun-2026), Exposure Events pricing, SportsEngine Tourney
listing, NCSA/SportsRecruits pricing + help pages. Third-party (△): NCSA
actual prices, LeagueApps % norms, industry take-rate ranges. Gaps to fill
when relevant: Jersey Watch + Crossbar price points (small-club website
platforms; not blocking), MaxPreps (free/ads, no pricing to collect).

⬅ [[_dashboard|Roadmap dashboard]] · [[club-segmentation-taxonomy]] · [[competitor-tracker]] · [[feature-backlog]]
