---
updated: 2026-08-18
tags: [theme/research, theme/gtm, theme/expansion, type/analysis, status/first-pass]
---

# US expansion — New York shortlist, and what the scan actually found

**Question asked:** which big US leagues, ideally in New York, are large enough to matter and light enough on technology that we can walk in?

**Short answer: New York metro is the wrong first US market, and the scan turned up something more important than a shortlist.** Both are below. The shortlist is in §4 regardless, because it was asked for.

⚠️ **Confidence note.** This is a first pass built from public sites in one sitting. Team counts are marked verified or estimated, and the platform detection method has a known blind spot described in §6. Given how many numbers in this research thread needed retracting, treat §4 as a starting list to verify, not a finished target list.

---

## 1. The headline finding: a diocese with no software budget built our operator product

**CYO Brooklyn-Queens** (`cyobq.org`) has no commercial sports platform. What they have instead is **"CYO Connect"** — a league management system they built themselves on **Base44** (the AI app-builder Wix acquired in 2025), backed by Supabase, embedded into their WordPress site at `cyobq.base44.app`.

Their own description: *"The official league management platform for the Catholic Youth Organization, handling registrations, rosters, scheduling, payments, and communication across all sports and parishes."*

The public app bundle declares **50 data entities and 40+ admin pages**. Read this list against our own roadmap:

| Their capability | Entities / pages they ship |
|---|---|
| Registration + rosters | `Athlete`, `AthleteRegistration`, `Coach`, `Parish`, `Team`, `RosterAuditPage` |
| Divisions + pools | `Division`, `DivisionTemplate`, `Pool`, `PoolTeam`, `Program` |
| **Scenario scheduling with draft→publish** | `ScheduleScenario`, `Scenario`, `DraftGame`, `PublishedSchedule`, `SchedulerV2` |
| **Venue slot inventory + booking** | `VenueSlot`, `VenueSlotBooking`, `VenueSlotScenario`, `ParishVenue` |
| Conflict detection | `CrossSportConflictAnalyzer`, `ParishConflictChecker`, `TeamBlackoutDate` |
| Officials | `Official`, `GameAssignment`, `OfficialsManagement` |
| **Billing** | `Invoice`, `InvoiceLineItem`, `Payment`, `ExpenseReport`, 4 invoice reports |
| Waivers | `Waiver`, `WaiverApproval` |
| Score entry with approvals | `ScoreEntry`, `GameScoreManagement`, `ScoreModificationRequest`, `RecentScoreChanges` |
| Standings + playoffs | `Standings`, `PlayoffBracketManager`, `SavedBracket`, `ParishPlayoffBracketViewer` |
| Discipline + forfeits | `DisciplineCase`, `DisciplineActivityLog`, `ForfeitReport`, `ForfeitTracker` |
| Comms | `EmailCenter`, `EmailDraft`, `Survey`, `SurveyResponse` |

That is a substantial slice of our operator workspace — **including the scenario planner and the DRAFT→PUBLISH layer we have been treating as differentiating**, built by a diocesan sports office in a season on a vibe-coding tool.

### What it emphatically does NOT have

I probed the 3.7MB bundle for the consumer layer. The decisive terms return **zero**:

```
playbyplay 0 · boxscore 0 · playerstat 0 · rebound 0
livescore 0 · mixtape 0 · reaction 0 · mvp 0
```

A `Game` carries `home_score` / `away_score` — one final number (plus volleyball set scores). Their roles are `admin, coach, official, parent, referee`: **there is no player and no follower.** No profile, no stat line, no highlight, no feed, no card, no notification to a family.

**So CYO Brooklyn-Queens has independently reproduced the exact shape of Exposure, ARC and RAMP: excellent at running the league, produces nothing after the final buzzer.**

### Why this matters more than the shortlist

Two conclusions, and the second one is uncomfortable:

1. **Confirmation.** A fourth independent operator, on a fourth continent's worth of separate tooling, stops at the final score. The gap we are building into is real and it is structural, not a Canadian accident.
2. **Warning.** *The operator/admin layer is commoditizing.* If a volunteer-staffed diocese can stand up scenario scheduling, invoicing and bracket management on an AI app builder, then "we do registration and scheduling better" is not a durable pitch anywhere, including Ontario. **Our defensibility has to be the consumer and media layer — the box score, the player record, the recap, the card, the audience — not the admin console.** This should be weighed against the open decisions in [[business-model-v3]] §13.

---

## 2. Why New York specifically is the hardest US market to enter

| Fact | Consequence |
|---|---|
| **LeagueApps is headquartered in New York City** (founded 2011, Accel-KKR backed) | We would be attacking an incumbent in its home market, where its sales team is densest and its reference customers are next door |
| **CYO New York** (Archdiocese), the largest single body at **1,400+ teams**, moved to **Sports Connect (Stack Sports)** in Aug 2023, plus Stack Team App | The flagship prize is signed and recently migrated — nobody re-platforms two seasons in |
| **CYO Long Island** (Diocese of Rockville Centre), **25,000+ children/year**, is on **SportsEngine** | The second-largest body is on the largest national platform |
| The one big body not on a commercial platform (**CYO Brooklyn-Queens**) built its own (§1) | Not unserved. Self-served, by someone invested in what they built |

**The three biggest youth basketball bodies in NY metro are all already covered.** That is not true in Ontario, where our census found 59% of Coalition clubs running nothing at all.

**Recommendation: do not open the US in New York metro.** If the US is opened at all before Ontario is won, open it where the density of unserved volume is high and the incumbent sales presence is thin. That is a different research question and I have not answered it — flagged in §7.

---

## 3. Everything the scan checked, with verdicts

Method: fetch each site, fingerprint CMS and sports platform from HTML signatures and outbound links (§6).

| Organisation | Area | Scale | Platform found | Verdict |
|---|---|---|---|---|
| **CYO New York** (Archdiocese) | NYC, Westchester, Rockland, Dutchess | **1,400+ teams**, gr. 2–8 + some HS, $15/player · *verified* | Sports Connect / Stack Sports (2023) + Stack Team App | ❌ Served |
| **CYO Long Island** (Rockville Centre) | Nassau, Suffolk | **25,000+ kids/yr all sports** · *verified, all-sport not basketball-only* | **SportsEngine** | ❌ Served |
| **CYO Brooklyn-Queens** | Brooklyn, Queens | 2 seasons/yr; **$250/team** entry + **$10/athlete** · *verified*; team count *unknown* | **Self-built "CYO Connect" on Base44** | ⚠️ See §1 |
| Island Garden Super League | Long Island | "31st season", "TOP league in NY Metro" · *their claim, unverified* | LeagueApps + Jotform | ❌ Served |
| Basketball City | Manhattan | unknown | LeagueApps | ❌ Served |
| Rockland Basketball | Rockland Co. | unknown | Sports Connect / Blue Sombrero | ❌ Served |
| **Spartans Basketball League** | Melville, LI | unknown, likely small | Wix, **none detected** | ✅ Open, but size unproven |
| **Impact Youth League** | NYC | unknown, likely small | Wix, **none detected** | ✅ Open, but size unproven |
| **CYO Newark** (Archdiocese) | Northern NJ | unknown | WordPress, **none detected** | ✅ Worth a look |
| PSAL | NYC public high schools | large but it is a **school athletic association**, not a youth club league | own site | ➖ Wrong shape for us |
| Zero Gravity | 10 states, 300+ events/yr | large | Three Step Sports | ❌ Served |
| Hoop Group | Mid-Atlantic, since 1963 | **1,100+ teams, 27,000+ athletes** · *their claim* | Three Step Sports | ❌ Served |
| NY Gauchos | Bronx | historic program | **domain parked and for sale** | ➖ Dead |

Unreachable in this pass (Cloudflare, dead hosts, or bad guesses at URLs): New Heights, Tri-State Basketball, NY Rens, Westchester leagues, Jersey Shore, NJ Hoops, CHSAA NY, Staten Island CYO, CYO Philadelphia, Long Island Lightning, NY Jayhawks, PSA Cardinals, Brooklyn Kings, Riverdale Basketball. **Several of these are plausibly the real answer and simply did not respond.**

---

## 4. The shortlist, as asked

Ranked by *(unserved × reachable × size)*. Being honest: none of these is a Coalition-grade opportunity, and the reason is §2.

### 1. CYO Brooklyn-Queens — the only one worth a real conversation
- **Why:** they built a league platform themselves, so they have already diagnosed the problem, have someone technical, and have zero vendor loyalty to protect. And what they built stops dead at the final score.
- **The pitch is NOT "replace your system."** They will defend it, correctly. It is *"you built the hard operational half. We are the half that happens after the score is entered — the player's record, the recap, the thing a parent shares."*
- **Risk:** they may consider themselves finished. Base44 also means their build cost was near zero, so cost-savings arguments do nothing.
- **Verify first:** how many basketball teams? Not published. Get it from a fact sheet or by asking.

### 2. CYO Newark (Archdiocese of Newark, northern NJ)
- WordPress, no platform detected, large Catholic diocese. **Entirely unverified on size** — the page that responded was a summer camp page, not a basketball league page. Cheapest next check on the list.

### 3. Spartans Basketball League (Melville, LI) and Impact Youth League (NYC)
- Genuinely on nothing (Wix sites). Almost certainly too small to anchor a market entry, but they are real and reachable. Useful as design partners, not as a beachhead.

### 4. The unreachable list, retried properly
- New Heights, Tri-State, NY Rens and the Westchester leagues are exactly the profile we want and they simply did not load. Retrying them is higher expected value than anything ranked 2–3 above.

**What I would actually recommend: do not spend the next block of time on this list.** Coalition is a warm introduction to a 6,971-game, ~$3.9M/yr league via someone who coached the owner's son ([[coalition-demo-plan-2026-08]]). Every candidate above is a cold approach into an incumbent's home market. The ordering is not close.

---

## 5. What this changes in the business model

| Doc | Change to make |
|---|---|
| [[business-model-v3]] §13 | Add a decision: *is the operator console a moat or a cost of entry?* §1 is evidence it is a cost of entry. |
| [[business-model-v3]] §3x | Add CYO Connect to the ecosystem critique as the fourth independent "stops at the final score" datapoint, and the first one that is self-built. |
| [[coalition-demo-plan-2026-08]] §5 | The pitch line already avoids selling admin. Keep it that way. This finding hardens that choice. |

---

## 6. Method, and its known blind spot

Probe: `curl` with a browser user-agent, then fingerprint the HTML for CMS signatures (`wp-content`, `wixstatic`, eCatholic) and sports-platform signatures (`sportngin`, `sportsengine`, `leagueapps`, `teamsnap`, `leaguelineup`, `stacksports`, `sportsconnect`, `exposure`), plus outbound-href tracing to registration subdomains. Script: session scratchpad `us/probe.sh`.

**Blind spot, and it has already bitten this research once:** this detects platforms a site *links to or loads publicly*. It cannot see a platform used purely internally behind a login. Earlier in this thread I wrongly concluded five clubs "use ARC" from HTTP 200s alone, and separately missed that Burlington Basketball had already left ARC for LeagueApps. **A "none detected" in §3 means "not publicly visible", not "uses nothing."** Every ✅ above needs a human check before anyone acts on it.

Second limitation: **CYO figures are all-sport.** CYO Long Island's "25,000+ children a year" covers basketball, cheer, chess, soccer, swimming, track and volleyball. The basketball-only number is smaller and is not published.

---

## 7. Open, not answered

- **Where should the US actually open, if not New York?** The right screen is high unserved volume × thin incumbent presence, which points away from the coastal metros LeagueApps and Stack have farmed. Not researched.
- Basketball-only team counts for CYO BQ and CYO Newark.
- Retry the 14 unreachable organisations with proper headers and correct URLs.
- Whether Base44-class tooling is showing up in Ontario yet. If it is, the §1 warning arrives at home.

⬅ [[coalition-league-census-2026-08]] · [[coalition-demo-plan-2026-08]] · [[business-model-v3]] · [[tool-feature-matrix-2026-07]] · [[team-census-2025-26]]
