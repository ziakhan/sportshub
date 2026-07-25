---
updated: 2026-07-25
tags: [theme/business, type/plan, status/working]
---

# Business Model v2 — social-first launch, payments margin, family revenue

Owner working session 2026-07-25. Supersedes pricing-v1 assumptions; BUSINESS MODEL still not final until owner signs off.

## 1. Money rails (the engine)

**Positioning against "cheap owner" objection:** the fee is not a cost, it is recovered revenue. Clubs lose real money to forgotten payments, untracked e-transfers, and spreadsheet reconciliation (industry shrinkage 3-8% of fees). Our overdue nagging + aging + auto-reconciliation recovers more than the fee costs. And the rail is OPTIONAL: cash/offline stays free forever — the fee applies only to automated collection. Don't like fees? Keep your spreadsheet.

**Fee structure (proposed):**
- E-transfer rail (ours): **1.5% per transaction** — our cost via an aggregator is flat cents, so ~all margin. This is ALSO the cheapest automated option a club can buy anywhere (cards cost 3%+ everywhere).
- Card rail (Stripe): pass-through (~2.9%+30c) + **0.5% platform**.
- Sales pitch is one sentence: "Automated collection from 1.5%, cheaper than any card option, and it chases the money for you."

**E-transfer automation ladder (the "foolproof" ask):**
- L1 (built): reference code per obligation + club records receipt manually.
- L2: club connects the inbox that receives Interac notifications (OAuth/IMAP) → we parse + auto-match by reference/amount.
- L3: read-only bank feed (Flinks/Plaid) → auto-match deposits to obligations.
- **L4 (RECOMMENDED TARGET): Interac e-Transfer via API aggregator (evaluate: Zum Rails, VoPay, Payper)** — Request-for-Payment sent to the parent, webhook on completion, fully automated validation, flat per-tx cost (~$0.25-1). Parent shares nothing sensitive; they just answer the e-transfer request from their own bank. This is the provider path discussed earlier; next step = pricing/onboarding calls with 2 aggregators.

## 2. Cold start without leagues (owner correction, accepted)

Phase A reality: no leagues → no games → no scoring, no clips, no POTG. Content = club posts + program auto-feed + gamification + platform-authored posts.

**Product unlock to shorten Phase A: club-run exhibition/scrimmage scoring.** Scoring today assumes league seasons; letting a CLUB score its own scrimmages/exhibitions generates game content (cards, POTG, clips later) with zero league adoption. Evaluate effort — this may be the single highest-leverage build for the social launch.

Phase A feed sources: auto-fed programs/announcements, club photo/video posts, club+platform polls/quizzes, platform editorial (rankings, tips), follow/handle/profile loops.
Phase B (first games, via exhibitions or first leagues): predictions, POTG voting, score cards, clips.

## 3. Points economy (engagement currency)

- Earn: daily open streaks, votes, poll/quiz participation, shares, (later) prediction accuracy, POTG voting.
- Spend: platform goods ONLY — clip unlock credits, premium card templates, profile flair. Never cash, never raffle-like mechanics (gambling-adjacent = no, youth platform).
- Bridge to revenue: points UNLOCK tastes of Plus (one free HD clip at N points) — the funnel INTO the family subscription, not a substitute for it.
- COPPA lens: points for kids are fine; anything resembling wagering or cash value is not.

## 4. Recommendation feed

- **Phase 0 NOW (before any model): instrument everything.** FeedEvent capture: impressions, dwell ms, pauses, taps, shares, likes, comments, follows-after-view. Data compounds; retrofitting loses months.
- Phase 1: heuristic ranking (recency x follow-affinity x engagement velocity), Instagram-basic.
- Phase 2: learned ranker on captured signals.
- Privacy stance (selling point): first-party signals only, never sold, no third-party ad tech on kids. Recommendations yes, surveillance no.

## 5. Sponsors (native, local-first)

- Sponsored cards in feed, clearly labeled. Differentiator vs big social: LOCAL — the pizza shop sponsoring a U12 team reaches exactly that team's families.
- Two tiers: club-sold sponsors (club keeps majority, platform takes cut — makes clubs money, defuses fee objections) and platform-sold geo/interest slots.
- Platform-authored engagement posts double as interest capture for targeting (first-party only).

## 6. Tiers (from v2 discussion 2026-07-24/25)

- Kids/players: free forever. Parents: free core (schedules, RSVP, safety, feed) + **SportsHub Plus** family sub ($6-8/mo or ~$50/yr): HD/watermark-free media, season reels, Moments archive, extended stats.
- Clubs: Founding year free with **visible "Pro" labels from day one** (custom domains, accounting exports, advanced analytics/SEO, featured placement, org media tools). Year 2: charge Pro; grandfather founding clubs on PRICE (e.g. 50% for life), never "free forever". Launch one new marquee Pro feature the same day billing starts.
- Leagues: free longest (they bring the games); later per-team-per-season fee once scheduling/scoring/refs/settlements are proven.

## 7. Open decisions for owner
1. Aggregator pick for e-transfer (Zum Rails vs VoPay vs Payper) — need pricing calls.
2. Exhibition-scoring unlock: approve as pre-league build?
3. Points naming + earn/spend table sign-off (and relationship to the old Energy Pass experiment).
4. Plus price point + what is IN Plus at launch vs later.
5. Sponsor revenue split for club-sold slots.
