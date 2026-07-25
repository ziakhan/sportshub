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

## 8. E-transfer aggregator mechanics (owner Q&A 2026-07-25)

**Who does what:**
- PARENT: taps "Pay $250 by e-transfer" on the obligation → receives an official Interac Request Money notification (email/bank app) naming the club → approves inside THEIR OWN banking app. Shares nothing: no IDs, no security questions (RFM auto-deposits). Confirmed VoPay mechanics: request embedded in our app, authorized through their bank, 250+ FIs, $25K/tx network limit.
- CLUB: nothing manual. Sees the obligation flip PAID in real time, receives scheduled payouts (daily/weekly EFT) NET of our fee, with a statement (gross / fee / net) — feeds the existing accounting exports.
- US: hold the master/trust integration with the provider; on webhook (payment completed, carries our reference id) auto-match to the obligation via the existing engine; run the ledger; instruct payouts.

**How we take the 1.5% (his question):** NOT billed, NOT deducted by Interac. Interac moves the GROSS amount into the provider-held funds account; our platform ledger nets the fee at settlement — club payout = gross - 1.5%. Same net-settlement model Stripe uses; clubs see one clean statement line.

**What it costs us:** provider pricing is volume-quoted (public pages confirm no list price). Industry ballpark pending sales calls: ~$0.50-1.50 per transaction flat + monthly platform/minimum fee + KYB onboarding. At 1.5% on an average $250 registration ($3.75 revenue) the flat cost leaves healthy margin at any realistic quote.

**Compliance structure (flag for legal):** prefer the funds-in-provider-trust model (we instruct, never custody) — avoids SportsHub itself registering as an MSB with FINTRAC. Confirm with provider + a lawyer before launch.

**Next step:** sales/pricing calls with VoPay + Zum Rails (+ Payper as third quote); owner on the call for the pricing negotiation.

## 9. Gamification v2: statuses, leaderboards, earned Pro (owner 2026-07-25)

- **Statuses/titles for bragging rights:** badge tiers earned by participation + prediction accuracy (e.g. Rookie → Regular → Analyst → Guru — names TBD w/ owner). Displayed by handle on comments/polls/predictions = credibility loop.
- **Leaderboards:** weekly/season boards — best predictors, most active voices, per club and platform-wide. Minors: leaderboard shows handle only, respects socialVisibility; opt-out honored.
- **Earned Pro:** top predictor/participant of the month earns Plus free for a month — status AND a taste of the paid tier (funnel, not substitute).
- **Daily loop objective:** predict every game, vote POTG, streaks — habitual daily open = the advertiser-value engine.
- Guardrails unchanged: no cash value, no wager mechanics, platform-goods rewards only.

## 10. Advertiser role (later phase, after engagement proof)

- Self-serve ADVERTISER account type: sports gear, trainers, physio, orthotics, mouthguards, merch — sponsored LISTINGS that render as native feed cards with a clear "Sponsored" label. No banners, no programmatic exchanges, no third-party trackers.
- Quality gates: category allowlist (youth-appropriate only), creative approval, geo/interest targeting from first-party signals only.
- Sequencing: local club-sold sponsors first (§5), self-serve advertiser marketplace once DAU proves the audience; premium CPMs justified by parent demographic + brand-safe environment.

## 11. Recommendation feed — architecture (owner Q&A 2026-07-25)

- Phase 0 (build first, days): FeedEvent capture — {userId, postId, type: impression|dwellMs|tap|like|comment|share|follow_after|hide, surface, ts}; client batches (flush every 10s/on-blur) to POST /api/feed/events; same schema web+native (parity law). Indexes (userId,ts),(postId,type).
- Phase 1 (heuristic, ~1 wk, NO model training): score = recencyDecay x sourceAffinity x engagementVelocity x qualityPrior. UserAffinity(user,source) materialized HOURLY by cron on the box (weighted decayed interaction counts: share 5, comment 4, like 3, dwell>10s 1). Query-time boost from the user's LAST-HOUR events so likes/follows reflect on the very next feed refresh; heavier aggregates within the hour.
- Phase 2 (embeddings, weeks): pgvector extension in Postgres (owner said PostGIS — the right tool is pgvector). Post embeddings via off-the-shelf embedding API; user vector = decayed mean of engaged-post vectors, recomputed hourly; cosine similarity becomes a ranking feature → discovery beyond follows. Still NO training.
- Phase 3 (learned ranker): only at millions of events; logistic/GBDT on logged features. Not a launch dependency.
- Confidence: P0/P1 near-certain (plain SQL engineering); P2 high (pgvector mature); "TikTok-quality" claims honest-capped by data volume at our scale — affinity+recency gets ~90% of the felt personalization for a community this size.
- Privacy: first-party only, no third-party trackers, kids' signals never leave the platform.
