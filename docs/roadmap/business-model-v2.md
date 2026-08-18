---
updated: 2026-07-25
tags: [theme/business, type/plan, status/working]
---

# Business Model v2 — social-first launch, payments margin, family revenue

> ⚠️ **Extended by [[business-model-v3]] (2026-08-15)** — v3 adds market benchmarking, club/league/referee pricing structure, team-count tiering, and the content-rights strategy. §1–§16 below remain the source of truth for the payments mechanics, content catalog, gamification and build order.

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

## 12. Content catalog (owner ask 2026-07-25: who can create what)

**System-generated (zero human effort — the feed's heartbeat):**
- Score/final cards + stat lines — DEPRIORITIZED per owner: routine results collapse into ONE daily "Yesterday around your clubs" DIGEST card per viewer (expand to see all) instead of N cards flooding the feed. Big games (rivalry, playoff, upset, milestone) earn standalone cards.
- POTG cards (standalone, Class A) · player MILESTONE cards (season high, 20+ pt game, 100th point, win streaks, first basket) · standings-movement cards ("Lords jump to 2nd") · matchup PREVIEW cards ("Sat: Lords vs Kings, 2nd vs 3rd") · MVP-race tracker · season wrap/records cards · registration-closing-soon + waitlist-open cards · AI weekly team recap + league week-in-review (Claude, existing recap pipeline).
**Org-authored (clubs/leagues/teams; already gated + pre-screened):** photo/video posts, announcements (auto-feed), polls/surveys (3-tier ruling), QUIZZES (new: same poll infra, correct-answer variant), fundraiser/sponsor shoutouts, coach-recruiting posts.
**Platform-authored (editorial + interest capture):** weekly power rankings, basketball trivia quizzes, prediction contests, top-plays-of-week (once clips), themed challenges.
**Family/player-SHARED (never free-form, existing rule):** stat cards, POTG cards, clips (metered), season reels (paid).
**Gamification cards:** prediction cards (pick winner — auto from schedule), POTG voting cards, leaderboard updates, badge-earned cards, streaks.
**Quiz/survey authorship:** team staff (team scope), club admins, league admins, PLATFORM. Kids: answer/vote/predict only. Results: aggregates public by default, individual answers never public, org can restrict results to admins.

## 13. REVISED family monetization (owner correction: not everything free)

Principle updated: the NETWORK is free (follow, feed, chat, schedules, RSVP); CAPABILITIES are metered. Every new family gets ONE FREE MONTH of the full experience, then capabilities degrade to free tier without payment.

- FREE: network + digests + voting/predictions + watermarked basic share cards + points economy (points can unlock single tastes of paid features).
- **PLUS (~$7.99/mo family)**: premium card templates, watermark-free + HD downloads, Moments archive, extended stat history, priority in POTG galleries.
- **PREMIUM (~$14.99/mo family)**: everything in Plus + VIDEO — live game streams + VOD replay (7+ days), AI-generated per-player highlights, season reels, manual clip tools. Benchmarks: TeamSnap $6-7 for chat+calendar only; BallerTV ~$30/mo for live games. Premium at half BallerTV with 10x scope = the wedge. Streaming cost basis ~$0.70/game (live-streaming-plan) keeps margin.
- Non-live markets still get value: scorekeeper-recorded/phone-recorded games as VOD after the fact ("offline games access").
- AI roadmap hooks: AI scoring assist, auto-highlights (owner: BallerTV-style signup per game as an alternative a-la-carte).

## 14. Video: mixtape editor v1 (owner ruling 2026-07-25 — auto-highlights deferred)

Owner: auto-generating highlights is tricky — v1 is MANUAL with smart UI. Spec:
- Source: uploaded phone recordings (pre-streaming era) and later VOD.
- Editor: timeline scrubber, set start/end per clip, multi-clip list w/ reorder, simple transitions (cut/crossfade), music overlay — LICENSED/royalty-free library ONLY (never user-uploaded tracks: copyright takedowns would hit kid content; flag legal).
- Output "MIXTAPES": server-side render (ffmpeg on box — on-device RN editing not viable), watermarked on free tier, HD/watermark-free = Plus/Premium; export/share as post or story (consent + Claude pre-screen apply to uploaded footage, existing rules).
- Path to semi-auto later (realistic, NOT computer vision): scoring events already carry game-clock timestamps — once video and scoreboard clock are synced, "auto-clip ±8s around every basket by player X" is deterministic. Auto-highlights = event-time clipping, an enhancement of the same pipeline.
- AI CONTENT PIPELINE (§12) is the living catalog — owner: keep detailed, enhance continuously.

## 15. Ghost opponents — scoring before the other club signs up (owner Q 2026-07-25)

Problem: Club A is on-platform with rosters; opponent Club B is not. How does A score Saturday's game?

**Answer: unclaimed opponent teams ("ghost teams") + claim-later merge — one club alone generates full game content.**
1. **Search-first association (owner 2026-07-25):** creating an opponent STARTS with a club-directory search (including the 188 imported UNCLAIMED clubs). Pick the unclaimed club -> the ghost team is created UNDER that club (traceability + one-claim-gets-everything). Only if the club truly isn't in the directory does Club A create a minimal unclaimed club + team in one step.
2. Scoring modes: FULL stats for A's own roster; opponent side defaults to TEAM TOTALS ONLY (score per quarter — one scorekeeper can run this alone, the GameChanger model). Optional quick guest roster (jersey # + first name) if they want opponent play-by-play.
3. Everything downstream just works with ONE club signed up: score cards, POTG (A's players), stat lines, milestones, digests, predictions — the whole §12 content engine fires. This supersedes "exhibition between two signed clubs" as the cold-start unlock: ANY club alone = game content.
4. Games vs ghosts are labeled "Exhibition · unverified opponent" — never pollute standings; single-scorekeeper truth stands as recorded.
5. **Claim = growth loop**: the ghost team's public page is indexable; Club B's parents find their kid's game score on us, page says "Is this your club? Claim it." On signup, Club B searches, claims its ghost team(s) → history/games merge onto their real team; from then on both sides see the games natively. Mirrors the club-claiming v2 flow that already exists.
6. Anti-abuse: rate-sane creation limits, claim disputes via existing club-claim review, ghost teams excluded from directories' main listings (searchable, labeled).

Build shape (when approved): OpponentTeam-as-Team with tenantId null/ownerTenantId + claimedAt; scoring console "quick opponent" path; claim/merge admin flow. Effort: moderate — reuses claiming, scoring, cards.

## 16. BUILD ORDER — social component (proposed 2026-07-25, owner to confirm)

- **S0 Foundation (start immediately, small):** FeedEvent instrumentation web+native (recsys P0 — every week unlogged is signal lost) + auto-feed completeness (ALL org content feeds once at publish) + feed ranking CLASSES incl. the daily scores DIGEST card.
- **S1 Cold-start engine:** ghost opponents w/ search-first club association (§15) + club exhibition scoring path + the §12 system-card generators (milestones, previews, standings-movement, weekly AI recaps). Outcome: one club alone lights up the feed.
- **S2 Gamification core:** points economy + prediction cards + POTG voting + quizzes on poll infra + statuses/badges + leaderboards (handles-only for minors) + earned-Plus-for-a-month. Outcome: the daily habit loop.
- **S3 Recsys v1:** hourly affinity job + heuristic ranking + query-time recent-signal boost (needs S0 data volume).
- **S4 Monetization switch-on:** free-month trial mechanics + Plus/Premium gating via existing hasFeature() + points-taste unlocks + watermarking. PARALLEL BUSINESS TRACK from today: aggregator sales calls (VoPay/Zum Rails/Payper) -> e-transfer rail integration when picked.
- **S5 Video (Premium anchor):** mixtape editor v1 (§14: upload/trim/merge/transitions/licensed music/server render) -> later event-time auto-clips; streaming per live-streaming-plan when ready.
- **S6 Advertising:** local club-sold sponsor cards -> self-serve advertiser role once DAU proves audience.
- **GATES before any public launch:** STRICT_SCREEN=true + ANTHROPIC_API_KEY on box (runbook #38) + ToS review + aggregator compliance/legal check.

### §12 addendum — expanded system-content inventory (2026-07-25)
Added on owner request beyond the original list: comeback/upset cards, double-double & first-career cards, head-to-head history cards, clutch-finish cards, undefeated/perfect-week team cards, roster-milestone (100th club game), season countdown/tip-off cards, registration-opened cards, prediction-results ("you called it") cards, leaderboard-movement cards, streak-at-risk nudge cards, weekly club digest for club admins, anniversary/on-this-day cards (opt-in), new-club/new-team-joined-platform cards, waiver/RSVP utility nudges (bell-only, never feed).

### §12 addendum 2 — attendance + referee card types (owner Q 2026-07-25)
ATTENDANCE (from EventRsvp/practices/check-ins; POSITIVE-ONLY, absences never public): iron-player perfect-attendance cards (opt-in, family-shareable) · team attendance streaks ("full squad 6 weeks running") · practice milestones (50th of season) · season gym-nights wrap ("41 gym nights") · pre-game hype "X/12 confirmed in" (team-circle visibility only). Absence data stays operational (staff bell nudges), never feed.
REFEREE (from assignments/settlements/cert verification): officiating milestones ("Mike's 100th game") · "verified certified official on the whistle" element on preview cards (ties to league quality perks) · ref season-wrap card (games/leagues served — the ref's own marketing, complements advertised rate) · "new verified official joined the pool" league card. HARD EXCLUSION: no public ref performance/rating cards — abuse magnet in youth sports.
