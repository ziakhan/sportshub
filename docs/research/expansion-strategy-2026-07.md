---
updated: 2026-07-12
tags: [theme/research, theme/gtm, type/research, status/complete]
---

# Expansion strategy — where next after Ontario basketball (2026-07)

**The question (owner, 2026-07-12):** do we take the platform to (a) rest-of-Canada
basketball, (b) US basketball, or (c) other sports (hockey, baseball, soccer,
volleyball)? Which cities/leagues first? How fast can the framework adapt?

**Method:** two research rounds (deep-research workflow with adversarial
verification + 8 targeted operator scans, ~2.8M agent tokens) + a full codebase
sport-specificity audit. Confidence labels: **[verified]** = adversarially
triple-checked against primary sources; **[primary]** = quoted from a primary
source, single-pass; **[inferred]** = reasoned/derived, flagged.

---

## 0. Recommendation (TL;DR)

**Sequence: (a) → (c) → (b). Don't pick one — phase all three.**

1. **NOW → Q4 2026 — Rest-of-Canada basketball, English metros.** Zero build,
   same playbook, and the targets are named single-operator league deals:
   **Halifax MBA (350+ teams)**, **Edmonton EYBA (2,500+ players, all-RAMP)**,
   **Winnipeg WMBA (200+ teams)**, **BC's BCCBA (24→196 teams in 3 yrs, no
   platform)**. Five deals ≈ $250–300K/yr run-rate at the $62K/league unit.
   **Timing matters: TeamLinkt (free, $9.7M raised, Saskatoon) is actively
   eating RAMP's game-ops layer — the same wedge we sell.** Land leagues
   before they do.
2. **Q1–Q2 2027 — Volleyball in Ontario as the second sport.** Build the
   sport-config abstraction + set-based scoring (moderate; the codebase is
   ~90% sport-agnostic). Sell to *independent* operators (the new OVL league,
   club-run tournament series like Synergy, and beach season) — NOT into
   OVA-sanctioned play, which is locked to AES/MRS. Ontario volleyball:
   ~15K athletes, 831 tournaments/season, ~23%/yr growth, $1,500–4,000/player
   fees.
3. **2027+ — US basketball, deliberately.** Biggest prize ($40B market) and our
   wedge is real (nobody has native live play-by-play + AI recaps; our
   2%+$0.30 undercuts every incumbent), but entry needs a compliance build:
   Delaware entity, COPPA redesign for under-13s, screening-partner
   integration. A mid-size US league deal ≈ **$54K/yr** — comparable to
   Canada. First metros: **wherever your personal connections are** (that
   dominates), else **NYC/NJ** and **Cleveland/Akron**.

**Quebec** is a separate decision (French-first product + Bill 96), **hockey**
is a 2028+ layer-on-top play, **soccer** is opportunistic-only (provincial
tech mandates), **baseball** is parked (GameChanger + different data model).

---

## 1. The decision frame

Our economics ([[business-model-scenarios]] V2): the adoption unit is the
**league deal** — one league ≈ **$62K/yr** steady state (media fee $14K +
payments take $35K + family passes $12.6K); ~14 operator relationships by Y4
≈ $1.28M revenue. So the expansion question is precisely: **where are the next
12 winnable league deals, and does a second sport multiply the league count
faster than a second geography?**

Answer from the research: the next ~8 deals are Canadian basketball metros
(named below, sales-ready). Volleyball adds a *new pool* of Ontario operator
deals on a moderate build. The US multiplies the pool ~10x but gates behind a
compliance build. Hence the phasing.

---

## 2. Track 1a — Rest-of-Canada basketball

### The incumbent picture (two competitors, not one)

- **RAMP InterActive** (Edmonton): the registration/website incumbent at
  nearly every governing body and metro league we scanned — including Canada
  Basketball's own national membership system (adopted with OBA 2023-24)
  **[verified]**. Claims $1B+ processing, 10M+ registrations, 10K+ customer
  orgs, ~40 sports, Canada+US **[verified]**. Has a "Gamesheets" digital
  scoring product **[verified]** — but in basketball practice we found it
  used for standings, not live game-day. RAMP is the layer we *coexist with*
  (sanctioning/membership) and *displace* (league ops), exactly like Ontario.
- **TeamLinkt** (Saskatoon) — **the real competitive threat, new this
  research**: free core + embedded-payments model (rate undisclosed,
  volume-tiered) + $425–795/yr bundles + in-app ads. $9.7M CAD raised
  (Series A Jul 2025, Growth Street Partners), 3,000+ orgs, 3M+ users
  **[primary]**. **Has live scoring, auto box scores, tournaments, website
  builder, officials mgmt.** Displacing RAMP publicly (Hockey Regina). Already
  inside basketball: CMBA Calgary's spring hub + a CMBA zone, DRIVE (BC),
  Fredericton's game-ops, all of Saskatchewan. **BUT:** hockey-first — its
  basketball leagues run standings-only in practice; no AI recaps (only
  AI-assisted admin writing); no basketball-native stat depth **[primary]**.
  **Our differentiation vs TeamLinkt = basketball-native depth: true box
  scores, leaders, player pages, AI auto-recaps, league media — not price,
  not breadth.**

### Target list (ranked, with named operators)

| # | Target | Scale | Current stack | Why |
|---|--------|-------|---------------|-----|
| 1 | **Metro Basketball Assn (Halifax)** | **350+ teams**, U10–U18, one operator | RAMP (thin), legacy itSportsNet remnants | Biggest single-league prize found in Canada; no game-day layer at all **[primary]** |
| 2 | **EYBA (Edmonton)** | 2,500+ players, 8 divisions, ~10 zones | All-RAMP (single vendor) | Cleanest rip-and-replace sale in the country **[primary]** |
| 3 | **WMBA (Winnipeg)** | 200+ teams, 6 leagues, 3 seasons | RAMP **[verified]** | Exact WMBA=league-anchored profile; caveat: Manitoba has Canada's lowest youth sport participation (56%) **[verified]** |
| 4 | **BCCBA (BC Hoops)** | 24→**196 teams** 2021-24, U9–U17 | WordPress + Exposure for tourneys, no all-in-one | Fastest-growing independent league in BC; outgrowing its stack **[primary]** |
| 5 | **CMBA (Calgary)** | ~4,500 players/yr; spring alone 180 teams/38 divisions | **Fragmented RAMP + TeamLinkt**, mid-migration | Biggest AB league, but 10-zone federation = multi-stakeholder sale; go after EYBA first **[primary]** |
| 6 | **Fredericton Fusion (FYBA)** | 700+ players (from 200 in 2020) | **Paying for RAMP AND TeamLinkt** | Small but fast; the consolidation pitch lands verbatim; Atlantic regional champion potential **[primary]** |
| 7 | **Rock Sports Group (St. John's)** | SJMB + Paradise Minor + a pro CBL team | RAMP | One commercial operator, multiple properties **[primary]** |
| 8 | **DRIVE Basketball (BC)** | ~11 Lower Mainland locations, league + AAU circuit | TeamLinkt + Exposure + HoopSoles (3 tools) | Displacement sell against TeamLinkt — prove the basketball-depth wedge here **[primary]** |

Second tier: TCYBA (Tri-Cities BC, on SportsEngine), RBL (Vancouver, dated
eSportsDesk), Moncton MKMBA (legacy Pointstreak/itSportsNet), Greater Moncton
cluster, Basketball NB/NLBA as PSO-endorsement plays, Basketball Alberta
Youth-Provincials event pilot (credibility wedge into every member league),
AYBC (50-club distribution channel).

**Skip/defer:** Saskatchewan (TeamLinkt home turf — only PACBA Prince Albert +
Swift Current on RAMP + Moose Jaw/Golden Ticket on LeagueApps are realistic);
**Quebec** — see below.

### Quebec (deferred, but bigger than we assumed)

Quebec has Canada's **highest** youth sport participation (79% vs 68% national)
**[verified]**. But: our workflow's verification round **refuted** the easy
thesis that "sign Fédération Basketball Québec = the province." Reality
**[verified refutation]**: Basketball Québec directly runs only the **LBQ**
(U10–U12, $1,000–1,100/team, on Kreezee-Sports, French-first) + an
invitational circuit; the **Montreal Basketball League** (independent,
ages 8–17, since 1905) and **RSEQ school leagues (~18,500 secondary
athletes)** are separate, substantial operators. A Quebec entry needs a fully
French product (Bill 96) and 3+ operator relationships. Real opportunity,
own project — schedule it after the English-metro sweep.

---

## 3. Track 1b — US basketball

### Market structure

- **$40B/yr market, ~30M youth athletes, ~$1,000/athlete annual spend, clubs
  charge $1–2K/player** [primary; L.E.K. 2026]. PE is consolidating operators.
- **The top of the market is closed:** 3STEP Sports (Juggernaut-backed,
  exploring a sale) owns Zero Gravity (15K teams), Hoop Group, Premier 1,
  Select Events, HoopSeen, One Day Shootouts + operates the **UAA** circuit
  **[primary]**. Shoe circuits (Nike EYBL, adidas 3SSB, UAA) are brand-owned.
  Unrivaled Sports (Harris/Blitzer) is baseball/flag — NOT basketball
  **[primary]**. Made Hoops (largest independent, 100K+ athletes) is
  LeBron/KD-backed **[primary]**.
- **Our layer is the tier below:** independent metro league operators, CYO
  diocesan leagues, and non-consolidated tournament operators.

### The product wedge is real **[primary, cross-checked]**

- **Exposure Events** (the AAU-basketball standard): $2.00/team scheduling
  credits, ~free registration, 1% EventStore fee — **and no native live
  play-by-play**; it rents scoring from NBN23/HoopStats/iScore, which
  organizers pay extra for.
- **SportsEngine Tourney**: score-*posting*, not live scoring. 45K+ orgs.
- **Payments: we undercut everyone.** TeamSnap 3.25%+$1.50; SportsEngine HQ
  3.25%+$2.00 (+$58-69/mo); LeagueApps ~5–5.9% (reviewer-reported, no public
  rate). Us: 2%+$0.30. (Round-1's "SportsEngine 3.75%+$1.75" figure did not
  survive verification — real figure is 3.25%; conclusion unchanged.)

### What a US deal is worth **[worked model, inputs primary]**

Blended $150/player registration, 10/team, $39/team/season software:
- Mid-size recurring metro league (250 teams × 3 seasons): **≈$54K/yr** —
  within 13% of the Canadian $62K unit.
- Large (450 teams × 3 seasons, JBL/Detroit-CYO scale): **≈$97K/yr**.
- Caveat: CYO/YMCA/municipal leagues collect money at parish/branch/city
  level and charge $35–150/player — there you win mostly the software fee,
  not the take. **The take lands with independent operators** (travel/house
  leagues, i9-style operators at $207–247/child).

### First-metro shortlist

1. **Wherever the owner's personal connections are.** In a relationship-driven
   operator market this dominates any structural ranking. Tell me the city
   and I'll re-rank.
2. **NYC / New Jersey** — densest independent-operator cluster found:
   **CYO New York (1,400+ basketball teams — the largest single "league
   deal"-shaped entity we found anywhere)**, **JBL Hoops (~450 teams,
   $400/team)**, **NYC Basketball League (200 teams)**, **Hoop Heaven**
   (recurring leagues, on LeagueApps), **FCP Youth** (70–150 teams/weekend),
   Bergen/Hudson CYO on legacy LeagueLineup. Eastern time, direct flights.
3. **Cleveland/Akron + Ohio** — **King James Shooting Stars / Dru Joyce
   Classic: 600+ teams, already draws Canadian teams** (a bridge product:
   sell the Canadian clubs' experience to the operator). Ohio Youth
   Basketball + Grassroots Tournaments on Exposure; Ohio Basketball
   ($595/team events). 4–5h drive from Toronto.
4. **Detroit** — closest US metro to Ontario; CYO Detroit ~430 teams; rec
   cluster (FAST, PAL, N Zone, i9). Modest scale but adjacency + the
   Windsor–Detroit story.
5. Chicago (Full Package Athletics on LeagueApps; CYO ~3,000 youth) and
   Boston (Hoop Mountain; CYO ~300 teams) as expansion ring.

### US entry frictions (the reason it's phase 3, not phase 1)

- **COPPA — the big one [primary; FTC].** Applies extraterritorially to a
  Canadian platform serving US kids. Photos/videos/audio of a child are
  personal information *in themselves* requiring **verifiable parental
  consent**; amended rule (Apr 2025, compliance ~Apr 2026) adds written
  retention policies and separate opt-in for third-party disclosure.
  Penalties $53,088/violation. **Our event-driven parent-linking and public
  player handle pages need a US under-13 mode: upfront VPC at registration,
  media-consent gates, retention policy.** Our 13+ self-registration age gate
  is a valid COPPA pattern (mixed-audience neutral age screen) — the
  under-13 flow is the build.
- **Payments:** processing US clubs from a Canadian entity adds ~1%
  cross-border — would eat half the take. **Stripe Atlas Delaware entity:
  ~$500, ~2 days** [primary]. Cheap, fast, required.
- **Screening ecosystem:** FCRA + state fingerprint laws; buyers expect
  NCSI/JDP integration (AAU bundles NCSI into membership since 2025).
  Partner (Ankored-style), don't build **[primary]**.

---

## 4. Track 2 — Other sports

### What the codebase says (full audit, 2026-07-12)

The platform is **~90% sport-agnostic**. Everything around the game —
registration/payments/Stripe Connect, offers, camps/tryouts/programs,
scheduling, venues, roles/invitations, messaging/polls, calendar/RSVP,
reviews, club/league pages, player handles, follow/news, referee booking,
native app, push sidecar — has **zero** basketball coupling. Basketball lives
in one vertical slice (live scoring → box score → season stats → standings →
recap), **~6-8k of ~105k LOC**, plus a shallow rename/branding layer
(`@youthbasketballhub/*` packages, `court/hoop/play` design tokens, ~87
"basketball" strings). There is **no Sport config concept** — that
abstraction (Sport on Tenant/League; stat categories, period structure,
standings rules as config) is the first build, ~2-3% of codebase, and it
also future-proofs us against TeamLinkt-style breadth competition.

Per-sport effort ranking (from the code, not vibes):

1. **Soccer — easiest.** Standings are already tie-aware (W/T/L + T column
   render today); `HALVES` exists; needs 3-1-0 points ranking + slim
   goal/assist console. Mostly config.
2. **Volleyball — moderate.** No clock (we support clock-off), but set-based
   rally scoring is a new structure (`PeriodType` has no SETS; match = best-of-N).
3. **Hockey — moderate-high.** 3 periods, penalty clock, OT/shootout,
   OT-loss = 1 point (a 4th result type).
4. **Baseball — a different product.** Innings/outs/base-state/at-bats — new
   fold engine, console, box score, standings. Park it.

### What the market says (lock-in spectrum, all **[verified]** or **[primary]**)

| Sport | Canada youth base | Registration lock-in | Game-ops layer | Verdict |
|-------|------------------|---------------------|----------------|---------|
| **Hockey** | 603K registered 24-25, growing 4th yr; girls +30% since '22 | **National mandate**: HCR = Spordle, universal, 3,500+ MHAs (contract "through 2026" — watch the renewal) | HCR is registration-only, BUT RAMP Gamesheets are league-mandated in many places + TeamLinkt is hockey-first | Biggest base, hardest fight. 2028+ "coexist-on-top" play at most |
| **Soccer** | Largest participation (28% of youth sport participants; ~733K registered) | **Provincial full-stack mandates**: Ontario Soccer × SportsEngine covers league/tournament/officials/discipline — our whole surface. 16-month RFP to displace. (One district migrating to "PowerUp" 2026 — single-source, watch it: mandates DO churn) | Included in the mandate | Cheapest build, blocked sanctioned market. Opportunistic only (unsanctioned/rec leagues, futsal); bid at RFP cycles |
| **Baseball** | 9% participation | **Open** — Baseball Ontario mandates a data spec + waivers, not a platform | **GameChanger**: free-everything for coaches, Little League/PONY/USA Baseball partnerships, DICK'S-owned | Open door, occupied house, hardest build. Park |
| **Volleyball** | 7% participation but **fastest growth**: OVA ~23%/yr | National: SportLoMo VRS — but **Ontario is the exception: OVA runs its own MRS** + Connect | See below — partially contested | **Best second sport, via the independent-operator wedge** |

### Volleyball Ontario — the close-up (round-2 deep dive)

**The size surprise:** OVA ≈ **21K+ members / ~15K athletes / 7,553 team
registrations (+11% yr) / 831 regular-season tournaments (+12% yr)** —
*larger in absolute terms than BC* and growing ~23%/yr (Sport for Life
competition review). Ontario Championships: 1,400+ teams 2026, "largest youth
amateur volleyball event in the province." Club fees **$1,500–4,000+/player**
— a payments base 2-3x basketball's. Beach is counter-seasonal (May–Aug;
917-team provincials, +30% YoY) **[primary]**.

**The incumbency surprise (revises round-1's "volleyball is unserved"):**
OVA-sanctioned play is effectively locked — **MRS** (proprietary) for
registration, **AES** (SportsEngine-owned, volleyball-native, does live score
entry + spectator app) for scheduling/results, **OVA Connect** for
program payments (**10% capped at $15/booking** — on a $3,000 club fee
that's $15 vs our $60.30 at 2%+$0.30!), Hudl for streaming. **Do not attack
sanctioned indoor play.**

**The wedge [primary]:** Ontario's delivery is *decentralized* — those 831
tournaments are run by clubs/organizers, not OVA (opposite of BC's central
model). And new *independent* leagues are appearing: **OVL (ovleague.com,
launched 2025-26 explicitly around scheduling/cost pain, $400+HST/competition
day, dome-based, designed to coexist with OVA)** is the archetype customer.
Plus club-run series (Synergy: one-day tournaments most weekends Jan–Jun) and
beach (incumbent MyTeam.Click is weak). Open product space: **public player
pages, AI recaps, media/content** — AES publishes results but nobody does
narrative/profiles.

**Pricing implication (feeds [[business-model]] open questions):** volleyball's
high-value dues + Connect's $15 cap mean our flat 2% take needs a **cap or
tier** for high-ticket transactions, or we lose every rate comparison on
$2K+ fees. Recommend modeling a $15–25 cap per transaction for the
volleyball vertical before any pitch.

---

## 5. Ranked answer to the owner's question

1. **(a) Rest-of-Canada basketball — first, starting now.** Zero build, named
   pipeline (§2 table), $62K/league economics proven, and a closing window as
   TeamLinkt spreads east from Saskatchewan. Sequence: Halifax MBA →
   EYBA Edmonton → WMBA Winnipeg → BCCBA → Fredericton (fast small win) →
   CMBA Calgary (longer, federated).
2. **(c) Second sport = volleyball in Ontario — build over winter, sell for
   the Jan-2027-style season and summer beach.** Requires the sport-config
   abstraction (which we want anyway, strategically) + sets scoring. Soccer
   is cheaper to build but has nowhere sanctioned to sell; volleyball has
   both a market and a wedge.
3. **(b) US basketball — deliberate 2027 entry.** Start the low-cost
   pre-work now (Delaware entity via Stripe Atlas; COPPA under-13 design;
   screening-partner conversation) so the option is exercisable. First metro
   = owner's connection city, else NYC/NJ (CYO NY + JBL + NYC Basketball
   League density) or Cleveland/Akron (King James Classic's Canadian teams
   as the bridge).

**What would change this ranking:**
- Owner's US connections being operator-level (not just personal) in a major
  metro → US moves up.
- TeamLinkt announcing basketball-native depth or AI recaps → accelerates
  phase 1 urgency further (or forces the differentiation review).
- OVA/AES relationship shifting (e.g., OVA tendering game-ops) → volleyball
  moves up.
- Hockey Canada/Spordle contract renewal opening (was "through 2026") →
  a once-a-decade wildcard worth one exploratory conversation.

---

## 6. Assumptions made (owner asleep — flag if wrong)

1. **US connections' location unknown** — ranked metros on fundamentals;
   your connection overrides.
2. Ranked with **current team/capital** in mind: phases are sequential
   sales+build motions, not parallel bets.
3. Treated **AAU figures (~800K members, Exposure routing) and COPPA
   analyses as [primary]** — the workflow's verification round for those
   specific claims was cut off by a session limit; sources are primary
   (aausports.org, FTC.gov) so confidence is high but not triple-checked.
4. Assumed the **2%+$0.30 take** and $39/team/season pricing as modeled in
   [[business-model-scenarios]]; volleyball cap recommendation (§4) is a
   proposed amendment, not a decision.
5. "Ontario Soccer → PowerUp" migration is **single-source** (one district
   site); do not act on it without confirmation.
6. Operator scale figures without published counts (MBA player count, most
   NB/NL orgs) are **derived estimates**, marked in the per-region scans.

## 7. Source trail

- Round-1 verified claims + refutations: workflow wf_62e0700b-9ae journal
  (13 claims 3-0 confirmed; 2 Quebec claims refuted and corrected in §2).
- Round-2 scans (full reports with per-claim URLs live in the agent
  transcripts; key URLs inline above): Ontario volleyball; US Northeast
  operators; US Midwest operators; US consolidation/platforms; US rec/deal
  economics; BC; Alberta; Saskatchewan; Atlantic; TeamLinkt profile.
- Codebase audit: full model-by-model classification (Prisma schema,
  fold.ts, scoring-console.tsx, standings/compute.ts, recap-claude.ts) —
  summarized in §4.

⬅ [[business-model]] · [[business-model-scenarios]] · [[competitor-tracker]] · [[gta-league-landscape-2026]]
