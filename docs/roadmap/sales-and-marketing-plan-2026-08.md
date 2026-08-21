---
updated: 2026-08-21
tags: [theme/gtm, theme/sales, type/plan, status/proposed]
---

# Sales and marketing plan, post-launch

**Status: PROPOSED, not approved.** Written 2026-08-21 at the owner's request
("marketing hat and biz dev hat"). It builds on
[[expansion-strategy-2026-07]], [[us-league-targets-2026-08]],
[[league-economics-and-obl-structure-2026-08]] and
[[README-go-to-market]] rather than restating them. Where it disagrees with
them it says so.

---

## 0. Where we actually are

Numbers pulled from the box on 2026-08-21, not estimated:

| Asset | Count |
|---|---|
| Clubs in the census | **1,685** |
| With an email address | **1,159** (69%) |
| With a phone number | 813 (48%) |
| With a website | 1,225 (73%) |
| Published to the public directory | 1,514 |

**The target list is already built.** The single most expensive part of an
outbound motion, finding and enriching the accounts, is 69% done for Canada.
That changes what needs building: not a scraper, a *sending and response*
system.

### The one blocker that outranks everything

**Signups are closed.** `PUBLIC_SIGNUPS=false`, the platform is invitation
only, and the SSO buttons are click-stopped on the brand domain. Every plan
below is void until this is decided, because you cannot run demand generation
into a door that does not open. Marketing to 1,159 clubs while they cannot
sign up produces one outcome: you burn the list once and it is worth less the
second time.

Three ways out, and they are a real choice, not a formality:

1. **Open signups.** Fastest, and the least reversible.
2. **Keep invitation only and make it the pitch.** "By invitation" is a
   position, not an apology, and it is already how the NPH email reads. Works
   at low volume and high touch. Does not work for a 1,159-club campaign.
3. **Open per-league.** A league signs, and its clubs get invite codes. This
   matches the strategy already chosen (leagues pull clubs) and keeps the
   funnel closed to strangers. **Recommended.**

---

## 1. The strategic tension in the ask

The request was for a US plan with shows and automated outreach. The research
already in this repo argues against opening the US now, and the reasons are
strong enough that they should be answered rather than skipped.

**From [[us-league-targets-2026-08]]:**

- The three biggest youth basketball bodies in NY metro are already covered:
  CYO New York on Sports Connect, CYO Long Island on SportsEngine, and CYO
  Brooklyn-Queens on a system they built themselves.
- **LeagueApps is headquartered in New York City.** Opening there means
  attacking an incumbent where its sales team is densest and its reference
  customers are next door.
- The uncomfortable finding: a volunteer-staffed diocese built scenario
  scheduling, invoicing and bracket management on an AI app builder in a
  season. **The operator console is commoditizing.** Defensibility has to be
  the consumer and media layer: the box score, the player record, the recap,
  the card, the audience.

**From [[expansion-strategy-2026-07]]:** US basketball is sequenced 2027+ and
needs a compliance build first, a Delaware entity, a COPPA redesign for
under-13s, and a screening-partner integration. None of that exists.

**What I would do instead, and why it still answers the ask:**

Go to the US **shows** in 2026 without opening the US **market**. A booth is
market research you get paid to attend: you meet operators, you learn what
they run on, you find out whether the consumer layer lands with Americans, and
you build a list. Selling into it comes after the compliance build. This costs
a few thousand dollars and no engineering.

Ontario is where the volume is unserved. The census found **59% of Coalition
clubs running nothing at all**. That is not true in any US metro examined.

---

## 2. Canada now: the manual motion

This is the part that pays. Do not automate it.

**Tier 1, named, warm, in flight:**

| Target | Size | Status |
|---|---|---|
| **The Coalition** (Ben Sanders) | 890 winter teams, ≈$3.9M/yr | Priority pitch. Owner knows the founder. Deck live at `/deck/coalition-67acde08df` |
| **NPH** (Tariq and Elias Sbiet) | ~230 team entries across 4 leagues | Email sent 2026-08-21 |
| **NJC / NSC** (Tony House) | ~80 teams, one venue | Ideal first pilot per [[README-go-to-market]]. Small, contained, weak incumbent tooling |

**Tier 2, named, cold, rest-of-Canada** (from [[expansion-strategy-2026-07]],
each a single-operator decision):

- **Edmonton EYBA**, 2,500+ players, all on RAMP
- **Halifax MBA**, 350+ teams
- **Winnipeg WMBA**, 200+ teams
- **BC's BCCBA**, 24 to 196 teams in three years, no platform

At the $62K/league unit, five of these is $250–300K/yr run-rate. **Timing is
the risk:** TeamLinkt is free, raised $9.7M, and is actively eating the same
game-ops wedge. Land these before they do.

**The motion for all of Tier 1 and 2 is the same and it is manual:** a warm
intro if one exists, a tokenised deck link, a 15-minute call, then a live
demo in their own world. It is seven accounts. It does not need software.

---

## 3. The club long tail: 1,159 emails, handled carefully

The temptation is to mail all 1,159 on Monday. Do not.

**Deliverability is a hard constraint, not a detail.** The brand domain is
new. A cold blast of 1,159 messages will land you in spam permanently and
take the transactional mail (welcome emails, waiver links, receipts) down
with it. That is a self-inflicted outage of the product.

**The rules that keep the domain alive:**

1. Send outbound from a **separate subdomain** (`go.sportshubone.com` or a
   separate domain entirely), never from the root that sends product mail.
2. **SPF, DKIM and DMARC** on that subdomain before the first send.
3. **Warm up over weeks**: 20/day, then 50, then 100, then 200. Reaching 1,159
   takes about a month and that is the fast version.
4. **Segment before sending.** A club with 40 teams and a club with 2 get
   different mail or they get nothing worth reading.

**The offer that fits a closed product:** not "sign up". It is
**"claim your page"**. Their club is already in the public directory with a
page, their teams, and the census brand stamp. The email tells them it exists
and hands them the keys. That is a real thing to receive, it needs no signup
flow, and it converts a directory listing into an account.

---

## 4. The machine: what to build for the pipeline

Only build this once §0 is decided and the Canadian manual motion is running.
The sequence matters: **a pipeline with nothing in it is a hobby.**

### The stages, and who does each

| Stage | Automated? | Notes |
|---|---|---|
| Discover accounts | **Done** | 1,685 in the census |
| Enrich contacts | Semi | 526 clubs still have no email. The machine-edits queue and review console already exist |
| Segment and prioritise | Automated | By team count, province, and whether a platform is detected |
| Compose | **Templated, not generated** | One template per segment, merge fields only. Per-club generated prose reads worse and risks saying something untrue |
| Send | Automated | Subject to the warm-up ramp above |
| **Classify replies** | Automated | The highest-value piece. See below |
| Book the demo | Semi | A link, then a human runs it |
| Run the demo | **Human. Always.** | This is the product's whole advantage |

### Reply classification is where agents actually earn their keep

Sending is easy. The expensive part is reading 1,159 replies and finding the
nine that matter. A classifier reading inbound mail into
`interested / not now / wrong person / unsubscribe / question` with the
question routed to you is the single highest-leverage automation here.

**Model tiering is mandatory** (CLAUDE.md § SUBAGENT MODEL TIERING, after the
2026-07-14 incident where one untiered run consumed 70% of a weekly budget):

- Enrichment, scraping, extraction, classification: **haiku or sonnet, low
  effort**. This is mechanical work at volume.
- Reserve the top model for judgement: reviewing a segment's message before it
  goes out, or handling a reply that the classifier flagged as ambiguous.
- Any fan-out above three agents resolves **down** a tier, not up.

### What exists and what does not

Already built: the census, the importer, the enrichment queue with human
review, the club review console, the public directory, welcome email v2, SMS,
opt-out, and the activity beacon.

Needs building: outbound sending on a warmed subdomain, a reply inbox with a
classifier, a per-prospect deck token generator, and a simple pipeline board.
Estimate honestly: **two to three weeks** of build, and it should not start
until the seven Tier 1 and 2 accounts have been worked by hand.

---

## 5. Events, and which ones are real

Two conferences are where youth sports league directors actually gather:

**[NextUp](https://nextupconference.com/)** — run by LeagueApps. 400+ youth
sports leaders a year, explicitly "directors, operators, and entrepreneurs".
Your buyers, in one room, at your competitor's event. That is uncomfortable
and it is also the highest concentration of qualified prospects available.
Attend before you exhibit.

**[Project Play Summit](https://projectplay.org/summit/2026)** — the Aspen
Institute's gathering, 500 to 850 attendees, national bodies, foundations and
governing bodies. This is the policy and credibility room rather than the
buying room. Useful for the media and consumer story, not for closing.

Also worth checking, dates unverified: **[TEAMS Conference &
Expo](https://www.teamsconference.com/)** for the events and tournament side.

**Tournaments beat trade shows for this product**, and that is the real
insight. The pitch is live scoring, player pages and recaps. A trade show
booth cannot show that. A tournament floor can: you run live scoring on real
games, parents watch their kid's box score update on their phone, and the
operator sees it happen at their own event. In Canada the obvious candidates
are the **CNIT** and the **Jane and Finch Classic**, both already in the
owner's orbit.

**Recommended shape:** one tournament activation in Canada this season where
you score real games for free, filmed for content. That single event produces
the proof, the footage, the parent testimonials and the operator conversations
that a booth cannot. Then take that reel to NextUp.

---

## 6. The 90 days

**Weeks 1–2 — decide and unblock**
- Settle §0: open, invitation only, or per-league. Nothing else starts first.
- Work the seven Tier 1 and 2 accounts by hand. Coalition first.
- Reply to NPH.

**Weeks 3–6 — prove it once**
- Land one pilot. NJC/NSC is the smallest yes.
- Run one tournament activation. Capture everything.
- Stand up the outbound subdomain and start the warm-up ramp at 20/day.

**Weeks 7–12 — turn it into a motion**
- Claim-your-page campaign to the 1,159, segmented, ramped.
- Build the reply classifier and the pipeline board.
- Attend NextUp as a delegate, not an exhibitor. Build the US list by hand.

**Not in the 90 days:** opening the US market, volleyball, and any exhibitor
booth spend. All three are 2027 decisions per the existing research.

---

## 7. Decisions needed from the owner

1. **Signups: open, invitation only, or per-league?** Everything is blocked
   on this.
2. **Is the US a 2026 research trip or a 2027 market entry?** The research
   says the second. The ask implied the first.
3. **Budget for one tournament activation**, and which tournament.
4. **Who runs demos?** At two a week this is the ceiling on the whole plan,
   and it is currently one person.
5. **Outbound domain**: subdomain of the brand, or a separate domain?

---

## 8. What this plan deliberately does not do

- **No mass US outreach.** Wrong market, wrong sequence, no compliance build.
- **No AI-written per-club emails.** Templates with merge fields. Generated
  prose at volume says untrue things, and a false claim to a league operator
  costs more than the campaign earns.
- **No exhibitor booths in 2026.** Attend first, exhibit when there is a
  reference customer to name.
- **No claims the product cannot show.** The copy rules hold everywhere:
  never sell the absence of a bug, never headline the scheduling speed, and
  the planning is the work.
