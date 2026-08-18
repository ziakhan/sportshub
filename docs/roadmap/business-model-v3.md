---
updated: 2026-08-15
tags: [theme/business, type/plan, status/working]
---

# Business Model v3 — who pays, what's free, and how we hold the content

Working session 2026-08-15. Extends [[business-model-v2]] with market research, a club/league/referee pricing structure, family tiering, and the content-rights strategy. **Still not final — owner sign-off required.**

> **Reconciliation note (owner challenge, 2026-08-15).** The first draft of this document was written without reconciling against [[business-model]] (2026-07-12) or [[tool-feature-matrix-2026-07]], both of which already existed. Three corrections resulted, and they are material:
> 1. **The league recommendation was wrong.** "Charge leagues nothing" reasoned from "don't tax supply." [[business-model]] §1 read 3 has the better frame: a league's software cost is a **rounding error against its own revenue**, so the question is the *unit*, not the *level*. §3 below is rewritten to the per-team-per-season model.
> 2. **Exposure Events was omitted entirely** despite being a tracked competitor in the matrix and the incumbent at NPH, the league we most want. New §3b.
> 3. **The analysis benchmarked against incumbents instead of pricing the white space.** New §3c is the gap analysis: what we have that nobody else does, and what we're missing.
>
> Club tier and take-rate numbers below are the v3 proposal; [[business-model]] §2 carries an earlier structure ($249/$649 per season with a 2.0% → 1.25% → 0.75% bps ladder). **These two must be merged into one number before anything ships** — see §13 decision 9.

---

## 1. The one-line thesis

> **Families are the profit engine. Clubs are the distribution channel. Leagues are the supply of games and the source of content rights. Payments are the utility margin.**

Every pricing decision below falls out of that sentence. The research says the club-software market is racing to zero, and the money in youth sports has moved to the parent's phone.

---

## 2. What the market actually charges (research, 2026-08-15)

### Club / league software — the race to zero

| Platform | Model | Price |
|---|---|---|
| **TeamLinkt** (#2 in our Canada census) | Free core, add-on bundles | **$0** core forever · $425/yr Operations · $425/yr Revenue · $795/yr full · transaction fee only |
| **Spond** | Free, payments-monetized | **$0** · 2.99% + 2 NOK + 27 NOK per membership fee · club may pass fee to members |
| **RAMP InterActive** (#1 in our Canada census) | Transaction-driven | No published list price; "industry-leading rates," quoted |
| **LeagueApps** | No subscription, % of transactions | 2.5% platform on top of processing; reported **up to 5.9%** all-in per registration |
| **SportsEngine** | Subscription | $79/mo Express · $129/mo Premium · $2,199/yr Pro |
| **Jersey Watch** | Subscription | $29–$79/mo billed annually |
| **TeamSnap** | Per-team + org custom | ~$9.99–$17.99/mo per team; TeamSnap ONE for clubs = custom quote |

**Read:** the two platforms that own Canada (RAMP, TeamLinkt) charge little or nothing for software and make money on the payment rail. Anybody selling club software as a subscription in Canada is selling against free. We cannot win a "our software is worth $99/mo" argument against TeamLinkt's $0.

### Family-side monetization — where the money actually is

| Platform | Who pays | Price |
|---|---|---|
| **GameChanger** (Dick's-owned, largest youth sports app in NA) | **Families** | **Free forever for coaches and staff, all features.** Plus $39.99/yr · Premium $99.99/yr · Family plan $179.99/yr ($14.99/mo) · monthly from $9.99 |
| **BallerTV** | Families | ~$25–30/mo for live game access |
| **Black Bear TV** | Families | $25.99/mo, arena-exclusive streaming |

**Read:** GameChanger gives the entire operational product away to the organization — that is their distribution cost, deliberately zero — and charges the parent $40–180/year for video, highlights, stats and keepsakes. That is the model the owner's instinct is already pointing at, and it is the highest-ARPU model in the category by a wide margin.

**The arithmetic that settles the argument.** A 12-team club has ~120 families. At an 8% conversion at a blended $75/yr, those families are worth **$720/yr** to us. You could never charge that club $720/yr for software when TeamLinkt is free — but you can earn it from the club's families while charging the club nothing.

---

## 3. Should we charge the leagues?

**Recommendation (CORRECTED): yes, a little — but priced per team per season so it disappears inside the league's own team fee. The unit matters far more than the level.**

### Why the first answer ("charge nothing") was wrong

The original reasoning was "leagues are supply, don't tax supply." That's true but incomplete, and [[business-model]] §1 read 3 already had the sharper version:

> **A league's software cost is a rounding error against its own revenue.** NPH collects roughly **$3,990/team × ~230 teams ≈ $918,000 per year**. It pays Exposure Events a few hundred dollars a season. Selling a league "cheaper software" is selling into a rounding error — they do not feel software pain in dollars, so a discount buys us nothing.

That inverts the conclusion. A league won't notice **$39/team/season** either, because it is **under 1% of the $3,990 it already charges that team**. The fee vanishes inside a number the league sets itself. What a league notices is a *bill it has to find budget for*, which is why the unit has to be per-team-per-season, invoiced against a roster they're already collecting on, and never a flat annual SaaS line item.

So: leagues pay, but the amount is trivial to them and the collection is invisible.

### The structure ([[business-model]] Engine B, retained)

| | **LEAGUE CORE** | **LEAGUE MEDIA** |
|---|---|---|
| Price | **$19/team/season** | **$39/team/season** |
| Scheduling, registration, rosters, standings, referee booking | ✅ | ✅ |
| Live scoring console, live pages, leaders | ✅ | ✅ |
| AI recaps, league news hub, covered posts | — | ✅ |
| Branded league hub + sponsor slots | — | ✅ |
| Native app presence | ✅ | ✅ + featured |

**NPH at ~230 teams × 2 seasons ≈ $9K–18K/yr from one operator.** Alternative for leagues that move team-fee collection onto us: **waive the per-team fee entirely for 1.5% of collections** (NPH scale ≈ $13.7K/yr) — same money, zero sticker, and it makes the payment rail sticky at the league level.

### What survives from the original reasoning

Three points still hold and still shape the deal:

1. **One league is 20–60 clubs in a single signature.** It remains the cheapest acquisition available, which argues for a **free design-partner season**, not a permanently free product. ([[business-model]] §3 already proposes exactly this for NPH: LEAGUE MEDIA free for season 1 in exchange for exclusivity, co-branding and the case study; list price season 2.)
2. **Leagues are the slowest, most political sale.** Per-team pricing helps here too — it is approved as a line in a budget the league already builds, not as a new vendor contract.
3. **A paying league has a stronger claim to content revenue than a free one** (§7). This is the one real cost of charging them, and it is why the licence language in §7 must be signed at the *design-partner* stage, while the platform is still free, and must survive the transition to paid.

### The design-partner season, and putting a value on it

Season 1 free is still right — but as a *term*, not a permanent posture, and the agreement should name what the free season is worth and what it buys:

> Platform Services are provided to the League at no fee for the [2026-27] season. The parties acknowledge the value of the Platform Services at not less than $X,XXX per season, and that the licences granted in Section [N] form part of the consideration for their provision. From the [2027-28] season, Platform Services are charged at the then-current per-team rate.

Signing the content licence (§7) while the platform is still free is deliberate: it removes the "we pay you, so we should share in it" argument before it can form, and the survival clause carries the licence through into the paid years.

### Don't sell leagues on price

Given the rounding-error read, discounting is wasted breath. The pitch is the outcomes Exposure Events and RAMP cannot deliver — live content, public recaps, an engaged family audience, a sponsor surface, a real app — priced per team so the number never becomes the conversation. See §3b for exactly what the incumbents are missing.

---

## 3b. What the incumbents actually do — including the one at NPH

The first draft benchmarked *prices* and skipped *functionality*, which made every recommendation read as "undercut TeamLinkt." Here is what the three that matter actually provide.

### RAMP InterActive — #1 in Canada, hockey-first governing-body plumbing

Edmonton, founded 2002, unfunded, ~40 sports, the most widely used sports registration platform in Canada. What it does:

- Online **registration** across a governing-body hierarchy (national → provincial → association → club → team) — this hierarchy is the real product and why provincial bodies mandate it
- **Site builder** + team apps (every `*.rampinteractive.com` league site)
- **Digital gamesheets** — the officials' scoresheet, signed, offline-capable
- **Official assignor tools** — assigning, web + mobile
- Scheduling, calendar sync, volunteer management, player profiles with medical/registration history across seasons
- Payment processing, in-game analytics

**What it does not do:** basketball-depth play-by-play (gamesheets are hockey-first), tournaments (probably — the claim comes from TeamLinkt's biased comparison page), any family/consumer subscription, any content or social layer, public player profiles, AI recaps, streaming. **No free tier at all — quote-only.**

### TeamLinkt — #2 in Canada, free-core land grab

3,500+ organizations, 3.5M app users, 20+ sports, 500K MAU on the family app. Free core = registration forms, payment collection, schedule builder, team app, website builder, fundraising. Paid bundles at $425/$425/$795: officials functionality, resource centres, sponsorship management, location bookings.

**Their real weapon is the fundraising/sponsorship revenue suite** — it makes clubs money, which is why clubs tolerate an undisclosed volume-tiered take rate. **Their weakness is basketball:** the scoring engine is real but templates are hockey-first, and their basketball leagues in the wild (e.g. Saskatoon Minor Basketball) run standings-only. No family subscription (they run ads instead), no public player pages, no content layer.

### Exposure Events — the one I missed, and the one that matters most

Basketball-**first** event and tournament software, 15 years old, and **the incumbent inside NPH's Showcase League** — the league we most want to approach. NPH's stats portal hands off to Exposure for per-game venue/directions, their app, and BallerTV watch links.

**Pricing is micro and event-shaped, not SaaS:**

| Item | Price |
|---|---|
| Scheduling credit | **$2.00 per scheduled team per event** (100-team event = $200) · 5 free credits to start |
| Single team/participant registration | **$0** (merchant fees only) |
| EventStore multi-team registration | **+1%** |
| Marketing credit | **$30/event** (and grants 15 scheduling credits) |
| Branded mobile app | **$299 one-time** (+$99/yr Apple) · $399 non-profit |

What it does: event registration, bracket building and propagation, schedule validation, automated standings, real-time results, messaging, contactless payments, **NCAA certification compliance**, event sites, event app.

**What it does not do — and this is the whole opening:**
- **No native play-by-play.** Organizers pay separately for NBN23 / HoopStats / iScore.
- **No owned family app, no notifications, no iCal.** NPH's own newsletter is email-only; their calendar widget was abandoned around 2022.
- No club/season administration, no league-season layer outside events, no public player profiles, no AI recaps, no content or follow graph, no streaming (NPH rents BallerTV separately).

### The NPH numbers that reframe the pitch

- ~230 teams, **$3,990/team**, ≈ **$918,000/yr collected**
- Pays Exposure a **few hundred dollars a season**
- Separately sells its own YouTube broadcast **to teams at $2,000/team**
- ~1,420 games across 8 calendars in 2025-26; two venues carry two-thirds of them

**Read:** NPH already monetizes content aggressively at $2,000/team, and rents three vendors (Exposure + BallerTV + third-party scoring) to do a fraction of what one platform could. They are not price-sensitive on software. They are vendor-fatigued and content-hungry. That is a completely different sales conversation than "we're cheaper than Exposure."

⚠️ It also sharpens §7: **a league already selling broadcast at $2,000/team understands content economics perfectly.** The concession ladder in §10 is not hypothetical for NPH — assume they will ask.

---

## 3s. ⭐ IF *WE* RAN A LEAGUE — clean operator P&L (owner exercise 2026-08-16, revised)

Owner correction: the question was not "what does NPH earn," it was **"what could WE make running a league like that."** Padding removed — no athletic therapy, no $40k media production, no contingency line, no vendor stack (we own the software). Gate revenue added.

### The atom: what one game costs

⚠️ **Correction 2026-08-16:** an earlier version applied NPH's 48.7% court utilisation to our model. That was wrong — it imported the incumbent's booking inefficiency into a clean-sheet plan. **If you book what you need, rented hours ≈ played hours.**

| Direct cost, one game | |
|---|---|
| Court — 1.25h × $75/hr | $93.75 |
| Referees — 2 × $25 | $50.00 |
| Scorekeeper — 1.5h × $17.60 | $26.40 |
| **Direct cost per game** | **$170.15** |

### The season — 146 teams × 12 games ÷ 2 = 876 games

**Court-hours booked = 876 × 1.25 = 1,095 hours.** No utilisation factor.

| | Amount |
|---|---|
| **Direct** (876 × $170.15) | **$149,051** |
| Staff (PT ops + weekend site supervisors) | $43,000 |
| Insurance (mandatory) | $13,000 |
| Awards + championship | $10,000 |
| Marketing / filling teams | $20,000 |
| Payments (our e-transfer rail) | $438 |
| Bad debt + refunds 2.5% | $14,564 |
| *Fixed subtotal* | *$101,002* |
| **Total cost** | **$250,053** |

| | |
|---|---|
| Revenue | **$582,540** |
| **Profit** | **$332,487 — 57.1% margin** |
| **Per team** | revenue $3,990 · cost $1,713 · **profit $2,277** |
| **Per game** | revenue $665 · cost $285 · **profit $380** |

### The two levers that actually move it

| Court rate | Court cost | Profit | Margin |
|---|---|---|---|
| $50/hr | $54,750 | $359,862 | 62% |
| $60/hr | $65,700 | $348,912 | 60% |
| **$75/hr** | $82,125 | **$332,487** | 57% |
| $90/hr | $98,550 | $316,062 | 54% |
| $110/hr | $120,450 | $294,162 | 50% |

| Referee rate (×2) | Ref cost | Profit | Margin |
|---|---|---|---|
| **$25/game (your figure)** | $43,800 | **$332,487** | 57% |
| $30/game | $52,560 | $323,727 | 56% |
| $40/game | $70,080 | $306,207 | 53% |
| $50/game | $87,600 | $288,687 | 50% |

**Neither lever breaks the model.** Even at retail court rates it clears 50%, and at $50/game officials still 50%. **The fee and the team count are what decide it, not the operating costs.**

### Plus gate (owner: $15–20/day, $20 weekend pass)

1,810 players. Assuming one paying adult per player:

| Weekends attended × paying rate | Gate revenue | Total profit | Margin |
|---|---|---|---|
| **4 × 60%** | **$86,899** | **$419,386** | **59%** |
| 6 × 70% | $152,074 | $484,561 | 62% |

**Gate is potentially 18–26% of total revenue and almost pure margin.** It deserves to be modelled as a first-class line, not an afterthought.

### ⚠️ But two assumptions decide everything

**1. The fee. $3,990 is NPH's pricing power, not ours.** They charge it for 15 years of brand, scouting exposure, BallerTV and the NPH name on a kid's profile. A new league cannot charge that in year one.

| Fee @ 146 teams | Profit | Margin |
|---|---|---|
| $1,500 | **−$75,627** | −35% |
| $2,000 | −$4,452 | −2% |
| $2,500 | $66,723 | 18% |
| $3,000 | $137,898 | 31% |
| $3,500 | $209,073 | 41% |
| $3,990 | $278,824 | 48% |

**2. Scale. Costs are heavily fixed, so small leagues lose money.** At $2,500/team — a realistic new-league price:

| Teams | Revenue | Cost | Profit |
|---|---|---|---|
| 30 | $75,000 | $108,057 | **−$33,057** |
| 50 | $125,000 | $138,095 | −$13,095 |
| **80** | $200,000 | $190,152 | **$9,848 — break-even** |
| 110 | $275,000 | $235,209 | $39,791 |
| 146 | $365,000 | $298,277 | $66,723 |

**Break-even fee by size** — the single most useful table here:

| Teams | Games | Direct | Fixed | **Break-even team fee** |
|---|---|---|---|---|
| 30 | 180 | $30,627 | $61,530 | **$3,151** |
| 50 | 300 | $51,045 | $62,550 | **$2,330** |
| 80 | 480 | $81,672 | $74,080 | **$1,997** |
| 110 | 660 | $112,299 | $75,610 | **$1,752** |
| 146 | 876 | $149,051 | $86,446 | **$1,654** |

**Reading: below ~50 teams you need close to NPH-level pricing just to survive. This is a scale business with a hard floor at roughly 50 teams.**

### Our structural advantage over a conventional operator

| Line | Conventional | Us | Saved |
|---|---|---|---|
| Gym (48.7% util @ $92 → 75% @ $75) | $202,372 | $107,125 | **$95,247** |
| Media production (ours auto-generates) | $40,000 | $0 | **$40,000** |
| Card processing → our e-transfer rail | $17,000 | $438 | $16,562 |
| Marketing (we have the audience) | $35,000 | $20,000 | $15,000 |
| Vendor stack (they rent, we own) | $8,000 | $0 | $8,000 |
| **Total** | | | **$174,809** |

**That $174,809 is the whole argument for us operating leagues rather than only selling to them.** It is the difference between a 5% margin and a 48% one on identical revenue — and every line of it comes from owning the platform.

### The strategic question this raises

If we can run a league at 48% margin and sell software to leagues at ~$5,700 each, **operating is worth roughly 50× more per league than serving one.** That argues for a hybrid: **operate our own league in the markets we can win, and serve as software everywhere else.** It also creates an obvious channel conflict — we would be competing with our own league customers, which must be disclosed and geographically fenced or it poisons the OBL and NPH relationships.

⚠️ **Not modelled, and material:** venue availability risk (Six Park is ~20 of 23 weekends sold out across NPH and the circuits), the two-to-three-season ramp to fill 146 teams, cancellation/weather exposure, and the working capital to pre-book courts before fees are collected.

---

## 3t. NPH's ACTUAL P&L — what the incumbent earns (for the pitch, not for us)

Modelled on our own NPH ops intel: **146 SL team entries · $3,990/team · 857 games (714 regular + playoffs) · 75-minute slots · 48.7% observed court utilisation.** Cross-check: 146 teams × ~12 games ÷ 2 = ~876 games, consistent with 857.

**Revenue: 146 × $3,990 = $582,540.** That is **~$332 per game per team**, or **~$322 per player** for the season at 12.4 players.

### Step 1 — the four costs the owner named

Court-hours of actual play: 857 × 1.25 = **1,071**. At the 48.7% utilisation their real calendar shows, they must **rent ~2,200 court-hours**.

| Cost | Amount |
|---|---|
| Gym rental (2,200 court-hrs @ $92 blended) | **$202,372** |
| Referees @ owner's $25 × 2 officials × 857 games | $42,850 |
| Scorekeepers (857 × 1.5h paid @ ~$17.60 min wage) | $22,625 |
| Staff (1 FTE ops + weekend site supervisors) | $80,000 |
| **Subtotal** | **$347,846** |
| **Naive profit** | **$234,694 — 40.3% margin** |

**A 40% margin is the illusion.** It is what you get from counting only the four obvious costs.

### Step 2 — what was missed

| Missed cost | Amount | Why |
|---|---|---|
| Insurance (general liability + participant accident) | $14,000 | Mandatory. ~1,800 athletes |
| Payment processing (~2.9% + 30¢) | $17,000 | On $582k of card volume |
| Athletic therapy / first aid on site | $14,400 | 2 venues × ~18 days |
| Vendor stack (Exposure Events, hosting, comms) | $8,000 | Their actual stack |
| Awards, medals, championship weekend | $12,000 | |
| Marketing + team recruitment | $30,000 | Filling 146 teams is not free |
| Bad debt, refunds, withdrawals (~3%) | $17,476 | The $500 forfeit fee implies this happens |
| Media + content production | $40,000 | Their entire differentiator |
| Contingency 5% | $26,322 | |
| **Subtotal missed** | **$179,198** | |

⚠️ **Referees at $25 is also too low.** Ontario youth basketball officials run $25–60/game, and a Gr 9–12 showcase league sits at the top. At **$40 × 2 officials** it is **$68,560**, not $42,850.

### Step 3 — the real P&L

| | |
|---|---|
| Revenue | **$582,540** |
| Total cost | **$552,754** |
| **Profit** | **$29,786 — 5.1% margin** |

**With the broadcast upsell they actually run** (30 teams × $2,000, ~$15,000 production): **+$45,000 of near-pure margin → profit ≈ $74,786, 11.6%.**

### What this explains about NPH's behaviour

A 5–12% margin explains everything we observed:
- **Why they sell broadcast at $2,000/team.** It is ~$45,000 of nearly costless margin against a ~$30,000 operating profit — **the broadcast upsell is more than the entire league's profit.**
- **Why they rent three vendors** (Exposure + NBN23 + BallerTV) instead of building. No capital for it.
- **Why they are vendor-fatigued and content-hungry** rather than price-sensitive on software.

### 🚨 The pitch this hands us

Our own waste audit of their actual 2025-26 calendar found **17–30 avoidable Six Park court-days** through whole-cohort co-location. At $92/court-hour × 12h:

| Avoidable court-days | Savings | As % of their net profit |
|---|---|---|
| 17 (conservative floor) | **$18,768** | **63%** |
| 30 (fair upper) | **$33,120** | **111%** |

**Our scheduler is worth between 63% and 111% of their entire annual profit.** That is not a software pitch, it is a *"we roughly double your bottom line"* pitch — and it is computed from their own published calendar, not a projection.

⚠️ **Tension to hold honestly:** at a 5% margin, the $39/team fee proposed in §3z is **$5,694 — about 19% of their operating profit.** That is not trivial to them. The correct framing is **net**: save them $18,768–33,120, charge $5,694, they are **$13,000–27,000 ahead**. Lead with the saving, never with the fee.

### Sensitivities that actually matter

**Gym rental is 37% of total cost and swings the entire outcome:**

| Rate | Gym cost | Profit (no broadcast) |
|---|---|---|
| $75/court-hr (strong bulk deal) | $164,977 | **$67,181 — 11.5%** |
| $92/court-hr (base) | $202,372 | $29,786 — 5.1% |
| $125/court-hr (retail private) | $274,961 | **−$42,803 — loss** |

**At retail rates this league loses money.** Which means the operator's single most valuable relationship is the facility deal, and the second most valuable thing is **not renting courts they do not use** — which is exactly what we sell.

**Revenue the owner did not count:** gate admission, sponsorships, merchandise, late fees, the $500 forfeit fees, and separate tournament properties (CNIT). NPH's real business is the portfolio, not the SL alone.

### Strategic conclusion

**League operating is a thin-margin business dressed up as a big-revenue one.** $582,540 of revenue produces ~$30,000 of profit before the broadcast upsell. Two consequences for us:

1. **Never pitch a league on cost savings of software.** Software is ~$8,000 of their $553,000. Pitch on **court-days saved** (63–111% of profit) and **new revenue** (broadcast, sponsors, more teams filled).
2. **This validates the reach model (§3u) from the other side.** A league that clears $30k on $583k desperately needs the $60k broadcast line and any tool that fills teams. Our reach product sells to leagues too, not just clubs.

---

## 3u. ⭐ THE REACH MODEL — the revenue line this document kept missing (owner 2026-08-16)

Everything above priced **software**. The owner's correction: the product being sold is **distribution**, and software is the thing we give away to earn the right to sell it.

> *"You want your tryout to get noticed. You pay. You want your house league to get noticed. You want to promote your tournament so teams can join, you pay."*

### The reframe, and why it changes the arithmetic

**We are not competing for a club's software budget. We are competing for its marketing budget.** That is a different, larger, and far less contested pot.

A rep club's tryout fills ~12 spots at ~$500 each = **~$6,000 of revenue from one tryout**. Clubs already buy Meta and Instagram ads to fill those spots, typically several hundred dollars a cycle, with terrible targeting — Meta cannot tell a basketball parent in Mississauga from anyone else. **We can, because every user on the platform is self-identified as a basketball family with a known city, age group and club affiliation.**

At $100 to fill a tryout, we are a **1.7% customer-acquisition cost** on that tryout's revenue. That is an easy yes, and it is a recurring, seasonal, budgeted spend rather than a grudging SaaS line item.

This also **inverts the "53.5% of clubs have one team" finding.** Under a SaaS model those clubs are worthless — nothing to charge for. Under a reach model they are the **best** customers, because the reason they have one team is that *they could not fill enough tryout spots to field more*. Growth is exactly what they are buying.

### The ladder

| Tier | What the club gets | Model |
|---|---|---|
| **Free** | A club page, a public program listing. People must come and find you. | $0 forever |
| **Listed / Promoted** | The program, tryout, house league or tournament **enters the feed** and reaches families beyond your own followers | Per-campaign fee |
| **Boosted** | Instagram-style: extended reach, **audience targeting** by city, age group, gender, competitive level; performance stats | Per-campaign, priced by reach |

**Programs as upsell modules** (owner's correction — house leagues and tournaments are *programs*, not teams): running a house league, hosting a tournament, and organising a camp are paid **modules**, separate from the reach spend that fills them. Two distinct purchases: *manage the thing*, and *fill the thing*.

### 🚨 The bright line that must never be crossed

**Reaching your OWN members must be free, forever, without exception.** Announcements, schedule changes, cancellations, team chat, RSVPs, and anything reaching families already attached to that club — never metered, never boosted, never delayed.

**Only reaching NEW people is a paid product.** Discovery, tryout recruitment, tournament team-acquisition, house-league signups from outside the existing membership.

If a club ever has to pay to tell its own parents that practice moved, we are extortionate, it will be screenshotted, and the trust the whole platform runs on is gone. **This line belongs in public-facing pricing copy, stated proudly, not buried.**

### Indicative sizing (Ontario, once audience exists)

| Line | Assumption | Annual |
|---|---|---|
| Tryout promotion | 400 active clubs × 2 cycles × $100 | **$80,000** |
| Tournament promotion | 60 tournaments × $300 | $18,000 |
| House-league / camp registration drives | 150 clubs × $150 | $22,500 |
| **Reach subtotal** | | **≈ $120,000** |

That is **1.5× the entire club SaaS line ($75–81k)** from a budget clubs already spend elsewhere — and it scales with audience rather than with club count.

### The videographer marketplace (owner's model — a revenue line, not a cost line)

The earlier draft of §8 treated the weekend shooter as **payroll**. The owner's model is better:

- Videographers and photographers work the weekend, shooting **single-play highlights on their phones straight into the feed** — which solves feed density and cold-start at zero marginal cost.
- **They earn by selling mixtapes to families.** We take a **revenue share**.
- Two or three working a single weekend puts hundreds of families in front of a highlight of their own kid, which is the highest-converting mixtape sales moment that exists.

Indicative: a shooter covering ~20 games in a weekend reaches ~240 players. At 5% ordering a $100 mixtape = 12 sales = $1,200, of which a 30% share = **~$360 per shooter-weekend**. Three shooters over a 30-weekend season ≈ **$32,000/yr**, at **zero payroll risk to us** — the shooter carries the risk and the upside.

⚠️ **Three requirements before this runs:** (1) signed copyright assignment + moral-rights waiver in every shooter contract (Canada s.13(3) — a contractor owns their work absent a signed assignment); (2) contractor status documented properly, since revenue-share workers who look like employees create liability; (3) taking a commission makes us a **marketplace** — GST/HST on the commission and T4A reporting obligations follow.

### Advertisers

Owner's target categories: orthotics, mouthguards, arm and leg sleeves, goggles, jerseys and uniform suppliers, shoe companies, training equipment, sports drinks and bottles.

**Realistic sequencing:** at ~19,900 Ontario families and a plausible 30% monthly-active rate, that is **~6,000 MAU**. That is far too small for CPM advertising, which needs six figures of audience to interest a media buyer. **Sell flat seasonal sponsorships, not CPM, until scale** — a local orthotics clinic will pay $500–2,000 a season to be the presenting sponsor of a league hub or an age division. CPM and self-serve advertiser accounts are a Year-3 line.

⚠️ **Advertising to minors is heavily regulated and this list points straight at kids.**
- **Quebec bans commercial advertising directed at children under 13 outright** (Consumer Protection Act ss. 248–249, upheld in *Irwin Toy*). The strictest regime in North America and we operate in that market.
- Ad Standards Canada's **Code of Advertising to Children** applies elsewhere.
- **Sports drinks to youth athletes** carry additional health-claim exposure.

**Design rule: advertising targets PARENT accounts only. No ad surface renders on a child account, ever. Quebec under-13 gets a hard geo/age exclusion.** This also happens to be a marketing asset — "we never advertise to your kid" is a claim no general social platform can make.

### Honest critique of the reach model

The owner asked previously to be critiqued rather than flattered; the same applies here.

**1. The chicken-and-egg is severe, and it is the whole risk.** Reach is only sellable if we have audience, and today we have none. Instagram's boost works because 2 billion people are already there. **Selling reach into an empty room to the first fifty clubs is the fastest possible way to lose them** — they will pay once, see nothing, and never pay again. So: **Season 1 gives all reach away free** to build the audience, and boost becomes sellable only once we can show a club a real number for how many families saw their last post. **Do not sell boost before that number exists.**

**2. "We bring the audience" is the one claim in the pitch we cannot currently support.** Everything else — the chain, the waivers, the officials, the multi-league submission — is demonstrable on a laptop today. Audience is not. Until there is a number, it is a promise, and promises made to league operators who later check are expensive.

**3. Pay-to-be-seen has an integrity problem specific to youth sports.** If a parent searching for tryouts sees a paid program above a better-matched free one, and their kid ends up somewhere worse because someone paid, that is a reputational landmine in a category built entirely on trust. **Mitigations: label paid placement plainly; never let money outrank relevance in *search*, only in *feed*; and never let paid placement promote a program with weaker safety credentials over one with stronger.**

**4. It concentrates revenue in a seasonal spike.** Tryout season is a few weeks. Reach revenue will be extremely lumpy, which is hard to run a business on. The family subscription is the smoothing mechanism — another argument for it being the base of the model rather than the top.

**5. The mixtape rev-share depends on a video pipeline we do not have.** §3v established there are zero video dependencies in the codebase. Shooter-posts-highlight-to-feed needs upload, transcode, playback and a storefront. **This is the same missing build that blocks Premium** — which means video is now load-bearing for *two* revenue lines, and should be sequenced accordingly.

### Where this leaves the model

| Revenue line | Ontario, at maturity | Depends on |
|---|---|---|
| **Families** (Plus/Premium) | ~$119,000 | Content density |
| **Reach / promotion** | ~$120,000 | **Audience existing first** |
| **Club SaaS + programs** | ~$75–81,000 | Nothing — sellable today |
| **Payments (e-transfer)** | volume-driven | Aggregator + RPAA clearance |
| **Mixtape rev-share** | ~$32,000 | **Video pipeline** |
| **Sponsorship** | $500–2,000/sponsor | Audience |

**The correct reading: club SaaS is the only line sellable today, and it is the smallest. Everything larger is downstream of audience.** That is the real sequencing constraint on this business, and it argues for giving software away aggressively in Season 1 to buy the audience that makes the other four lines possible.

---

## 3w. COMPETITOR APP TEARDOWN — ratings, features, and what users actually complain about

Owner ask 2026-08-15: stop quoting download counts, read the listings and the reviews. Done. All figures from the live App Store / Play listings.

| App | Rating | Ratings | What it actually does | What users actually complain about |
|---|---|---|---|---|
| **GameChanger** | **4.9★** | **876,000** | Scorekeeping across 20+ sports · 150+ baseball/softball stats · **AutoStream AI hands-free BASKETBALL streaming with a real-time scoreboard overlay** · RTMP with Mevo/GoPro · auto highlight clips · athlete profiles · messaging, scheduling, RSVP · web portal | Paywall confusion; *"I feel like a prisoner to the app while watching games"*; *"the app has shifted more so to the focus on streaming/recording… then the actual scoring"*; wrong clips, livestream out of sync |
| **TeamSnap** | 4.8★ | 59,000 | Roster, scheduling, calendar sync, chat, live updates, pro training content (FC Barcelona, MLS, Jr. NBA) · 25M users | *"The notification function of the team chat is horrible. Our team is getting notifications approximately 30% of the time"* · household invitations are *"an endless un useful circle"* · file attachments desktop-only · six-day support waits |
| **TeamLinkt** | 4.7★ | 23,000 | Roster, schedule, availability, reminders, photos, group + direct chat, polling, tasks, lineups, **in-game scoreboard** | App/web sync issues · **removing previously free features and pushing a premium subscription** |
| **RAMP Team** | 4.7★ | 6,200 (iOS) | Roster, calendar sync, attendance, lineups, messaging, **Ramp Media Live** real-time game updates, file/photo storage | *"Why am I losing access to the app? It now just says an error occurred and I should 'retry' but clicking the button does nothing"* · chat broken · bugs, freezing |
| **BallerTV** | **3.8★** | **510** | Live streams + replays of tournament games · Game Finder · scout/NCAA exposure · opponent scouting | *"The quality of the video was horrible. I couldn't tell what kid was on the field."* · *"Games are frequently missing altogether"* · *"Only fragments of a game are recorded, cutting off key moments or entire halves"* · cameras pointed at the parking lot · **"Better to have a parent video the game than to download this app"** |

**Owner's read on the RAMP app is confirmed exactly.** Calendar / Teams / News / Chat is a TeamSnap clone, invitation-only, and no self-serve admin. Its listing confirms it: roster, calendar sync, attendance, lineups, messaging, file storage. That is a team-management app bolted onto a registration database.

**The most useful number in the table is BallerTV's: 3.8★ from only 510 ratings**, against a company claiming 2,000+ events, 5M athletes and 325,000 games streamed. Low rating *and* tiny rating volume at that claimed scale means thin engagement and poor sentiment. **BallerTV is the weakest incumbent in this market and the most vulnerable.**

---

## 3v. 🚨 BALLERTV, AND THE VIDEO REALITY CHECK

### What BallerTV actually charges

| Plan | Quarterly | Annual (billed yearly) | What you get |
|---|---|---|---|
| **Bronze** | $14.95/mo | $7.95/mo | 1 live event + 1 game download per month · **no custom athlete profile** |
| **Silver** | $24.95/mo | $12.95/mo | 3 tournaments/mo · 3 simultaneous viewers · 5 download credits ($39 value) |
| **Gold** | $49.95/mo | $24.95/mo | Unlimited tournaments · 5 simultaneous viewers · Highlight Reel ($149 value) |
| **All-Tournament Pass** | — | **$39.95 one-time** | One tournament, no subscription, no auto-renew |

**No single month can be bought** — minimum is a 3-month package, which is itself a top complaint. Partner model: BallerTV works with tournament operators who supply hardware and staff; capture is via BallerCam. Partners include AAU, Pangos, Hoop Group, AJV and Nike EYBL. They are on **Roku, Apple TV, Android TV, Xbox and onn**.

### The owner's team-buyout math, run properly

Owner's instinct: NPH selling its own broadcast at **$2,000/team** beats families each buying BallerTV. Correct. For a 12-family team over a 5-month season:

| Route | Cost to the team's families |
|---|---|
| Silver quarterly ($24.95/mo × 5 mo × 12 families) | **$1,497** |
| All-Tournament Pass ($39.95 × 6 events × 12 families) | **$2,876** |
| Gold quarterly ($49.95/mo × 5 mo × 12 families) | **$2,997** |
| **NPH team broadcast buyout** | **$2,000 flat** |

**So the team-level buyout is the right unit for video, not the per-parent subscription** — and NPH already worked that out. GameChanger reached the same conclusion from the other direction with **Team Pass**: any staff member or confirmed parent makes a one-time purchase that unlocks Plus or Premium for the *entire team community*.

**Implication for us: sell video as a Team Pass, not a per-family subscription.** A team pass at $299–499/season would undercut every route in that table by 3–6×, and it collects from one payer instead of chasing twelve.

### ⚠️ The correction the owner needs most

> **"Live games linked with an overlay of scores" is not our differentiator. GameChanger already ships it, for free, and does it well.**

Their listing states it plainly: **AutoStream AI for hands-free basketball streaming, with a real-time scoreboard overlay for viewers**, plus RTMP support for Mevo and GoPro, plus auto-generated highlight clips. That product carries **4.9★ across 876,000 ratings** and is owned by Dick's Sporting Goods.

Against that, our verified position is: **zero video dependencies in the codebase** — no hls, mux, livekit, agora, ffmpeg or rtmp anywhere. And no TV app of any kind, while BallerTV is on five TV platforms.

**So on video specifically we are not ahead, we are absent, and the category leader gives it away free.** This is the single most important correction in this whole thread, and it has two consequences:

1. **Do not put streaming or score-overlay in the pitch** until it exists. A league operator who has seen GameChanger will know immediately, and one overclaim costs the meeting.
2. **Premium ($14.99/mo) must be rescoped or funded.** Its headline features — VOD, reels, mixtape, auto-clips — are exactly the vapour above. See §3x.

**What survives, and it is still a lot:** GameChanger has **no league layer whatsoever** — no registration, no payments, no cross-team standings, no club administration, no waivers, no officials, no directory, and its 150+ deep stats are **baseball and softball only**. BallerTV has none of that either, plus a 3.8★ product. **Nobody is competing with us on the chain. They are competing with us on one link — and on that link, we should not fight yet.**

---

## 3x. OUR OWN SYSTEM — audit, ecosystem chain, and an honest critique

Owner challenge 2026-08-15: *"You understand our system better... we're building a complete ecosystem... really critique what I'm saying."* Fair — every prior revision researched competitors and never audited us. Done now, from the codebase.

### What we actually have (verified 2026-08-15)

| Measure | Count |
|---|---|
| Prisma models | **121** |
| Enums | 78 |
| Web pages (`page.tsx`) | **172** |
| API routes (`route.ts`) | **307** |
| Shared query modules (the parity layer) | 23 |
| React components | 164 |
| lib modules | 206 |
| Test files | 120 |
| Native app files | **510** |

### The ecosystem chain, link by link

| Link the owner named | State | Evidence in the codebase |
|---|---|---|
| **Parents finding clubs** | ✅ **built** | `/club` directory, `/club/[slug]`, `/leagues`, `/league/[id]`, `/org/[slug]`, `/marketplace`, `/events`, `/news`; `directory-clubs.ts`, `directory-leagues.ts`, `club-ratings.ts`; reviews live on public club pages |
| **Clubs responding to parents** | ✅ **built** | `Tryout`, `TryoutSignup`, `OfferTemplate`, `Offer`, `OfferOption`, `OfferInstallmentTerm`, `PaymentObligation`; 5 tryout + 6 offer API routes |
| **Clubs submitting to leagues** | ✅ **built** | `ClubSeasonEntry`, `TeamSubmission`, `TeamSubmissionRequest`, `SeasonRoster`, `SeasonRosterPlayer`, `RosterChangeRequest`, `PlayoffEligibilityOverride`; **54 season API routes** |
| **Leagues reaching clubs and players** | ✅ **built** | `Announcement`, `TeamMessage`, `Conversation`, `DirectMessage`, `Notification`, `Device` (push), `CommunicationConsent`, `EmailLog`, `MessageLog`; `lib/comms` |
| **Waiver signing** | ✅ **built** | `WaiverDocument`, `WaiverSignRequest`, `WaiverSignature`, `WaiverReminder`; `lib/waivers`; cron reminders live on the box |
| **Referees** | ✅ **built** | `RefereeProfile`, `LeagueReferee`, `RefereeAvailability`, `RefereeSessionRequest`, `RefereeSettlement`; `lib/referees`, `queries/referee-games.ts`. ⚠️ Payout rail still not built ([[referee-payouts]]) |
| **Social / content** | ◐ **partial** | `Post`, `MediaAsset`, `PostTag`, `Follow`, `Story`, `StoryView`, `PostReaction`, `Comment`, `Repost`, `FeedEvent`; `lib/social`, `lib/feed`. **No creator/influencer role, no rev-share, no creator marketplace** |
| **Live games** | ✅ **built** | `Game`, `GameEvent`, `PlayerStat`, `StatDepth`, `ClockMode`, `PeriodType`; scoring console at `/games/[id]/score`; public `/live/[gameId]`; `lib/realtime` publish + `use-realtime`; live cards via next/og at `/api/live/[gameId]/card` |
| **Score overlay on video** | ❌ **absent** | The live *cards* are OG images, not a video overlay. There is no video to overlay onto |
| **Streaming** | ❌ **absent** | **Zero video dependencies** — no hls, mux, livekit, agora, ffmpeg, rtmp anywhere in package.json. The 35 "stream" hits are scheduler terminology and one league-perk label |
| **TV apps** | ❌ **absent** | No tvOS, Roku, Chromecast or AirPlay references anywhere |

**Seven of ten links are genuinely built. Two of the missing three are video.**

### 🚨 The inconsistency that matters most

**Premium ($14.99/mo · $119.99/yr) is priced almost entirely on things that do not exist.** Its differentiators are game VOD replay, season highlight reels, the mixtape editor and per-player auto-clips. **We have no video pipeline at all — not a dependency, not a stub.**

Two honest options, and this needs deciding before any family pricing is announced:
1. **Rescope Premium to what we can actually ship** — full-res media, premium cards, the Moments archive, career stats, advanced splits — and hold video for a genuine v2 tier.
2. **Commit video as a funded roadmap item** with a real budget and date, and keep Premium as designed but unsold until it lands.

Selling a Premium tier whose headline features are vapour is the fastest way to lose the parent trust the whole model depends on.

### Honest critique of the ecosystem thesis

The owner asked to be critiqued rather than flattered. Five real objections, in order of severity.

**1. "Ecosystem" is a seller's word, not a buyer's word — and there is no single buyer for it.** This is the strongest objection. Bundling wins when one buyer holds budget authority over the whole bundle. Here, authority is split four ways: the **PSO** owns registration and membership, the **league** owns competition, the **club** owns its own operations, and the **parent** owns their own wallet. Nobody can purchase the ecosystem. So "it's all in one place" is a genuine **user** benefit and a weak **sales** benefit — every sale still has to be won on the one thing that specific buyer feels. Pitch the ecosystem as the reason to *stay*, and a single sharp pain as the reason to *start*.

**2. The integration tax is the real risk, not the competition.** 121 models, 307 routes and 172 pages maintained by essentially one person plus agents. The plausible failure mode is not losing to a better product — it is being 70% good at nine things, excellent at none, with each release breaking a neighbour. Our own docs carry a standing deferred-litter list and a known-issues list. Incumbents can afford to be mediocre at eight things because they have staff; we cannot.

**3. "Nobody comes close" is true on paper and completely untested in the field.** We have 121 models and near-zero production load. RAMP's *"data is routinely lost"* complaint is what a system looks like after a decade of real Saturday-morning traffic. We have not earned our reliability complaints yet. This matters tactically, not morally: overclaiming to a league operator who then hits a bug in week two costs more than a modest claim ever would.

**4. Depth-versus-breadth is a real trade and we are on the wrong side of it in two places.** GameChanger's scoring depth and BallerTV's streaming are both better than anything we have in those specific lanes. The ecosystem argument does not rescue us there — it just means we should not pick those fights. Score against **RAMP's absent game day** and **the spreadsheet**, not against GameChanger's scorer or BallerTV's cameras.

**5. The owner's own best insight is being under-used.** *"They're still using TeamSnap... volunteers... they are not able to perform their job."* **That is a stronger pitch than the ecosystem.** It reframes the product from feature-count to **labour replacement**: "we remove the three hours a week your volunteer team manager does not have." Volunteer burnout is the single most universal pain in youth sports administration and it is felt by exactly the person who signs the cheque. Lead with that.

### Where the ecosystem thesis is genuinely right

**The value is not the nine features. It is the eight seams between them — and the seams are what nobody else has.**

A demonstrable, provable chain, all of which exists today except the last step's video:

> Parent searches the directory → finds the club → registers → signs the waiver electronically → is rostered → the club submits that roster to the league → the league schedules it → the game is scored live → the stat line lands on the kid's public profile → the parent shares the card.

**Every incumbent breaks that chain at least twice.** RAMP breaks it at scheduling (Google Sheets) and again at scoring (hockey gamesheet, no basketball mode). GameChanger has no league layer at all, so it cannot start the chain. Exposure Events has no season, no club admin and rents its scoring. TeamLinkt has no player identity and no content.

**That chain is the pitch, and it demos in ninety seconds.** It is a far stronger claim than "we have more features," because it is specific, falsifiable, and visibly painful to whoever is currently doing it by hand.

---

## 3x-b. THE MEETING CHEAT SHEET — "we already use X"

Owner ask: *"I need to answer questions in a meeting when people say 'oh we're using this.'"* Every line below is verified earlier in this document. **Never claim streaming or score overlay.**

| They say | You say | The proof |
|---|---|---|
| **"We use RAMP."** | "Keep it — Canada Basketball standardised on it and it's good at eligibility. But RAMP stops at registration. Your OBL schedule is a Google Sheet, your gamesheet app has tabs for Goals, Goalies and Penalties, and there's no basketball mode. Nothing about the game gets back to a parent." | OBA schedule page; RAMP's own gamesheet guide |
| **"RAMP has an app."** | "It does, and it's a TeamSnap clone — calendar, teams, news, chat. One username and password per team, no SSO, parents can't join without an invite, players hidden from public by default, and the gamesheet doesn't talk to the membership database." | RAMP Team Desktop + team app guides |
| **"We use TeamSnap."** | "For the calendar, yes. Ask your managers how often chat notifications actually arrive — their own reviewers say about 30% of the time. And TeamSnap knows nothing about your league, your registration, your waivers or your officials." | TeamSnap App Store reviews, 4.8★/59K |
| **"We use GameChanger."** | "Great product and genuinely better than us at scoring and streaming today. But it has no league layer at all — no registration, no payments, no standings across teams, no club admin, no waivers, no officials — and its deep stats are baseball and softball only. It can't run your league." | GC listing, 4.9★/876K |
| **"We use BallerTV."** | "What are your parents saying about it? 3.8★ from 510 ratings, and the reviews are missing games, halves cut off, cameras on the parking lot, and 'better to have a parent video the game.' Also they won't sell you one month — minimum three." | BallerTV App Store + support pricing |
| **"BallerTV costs us nothing, parents pay."** | "Your parents pay. Twelve families on Silver quarterly over a five-month season is about $1,500; on Gold it's about $3,000. NPH figured this out and sells its own broadcast at $2,000 a team. A team pass is the right unit, and it should cost a fraction of that." | Pricing table in §3v |
| **"We use Exposure Events."** | "For brackets it's fine. But it rents its live scoring from NBN23, has no season league layer, no club administration, no player profiles, no recaps, and no family app — your calendar widget has been down since 2022." | Feature matrix; NPH ops intel |
| **"We use TeamLinkt."** | "Solid and free, and strong on fundraising. But it's hockey-first — its basketball leagues run standings-only — no player identity, no content layer, and it just moved previously-free features behind a subscription." | Census; TeamLinkt reviews |
| **"Our team managers handle communication."** | "They're volunteers with three hours a week they don't have, and they're doing it in TeamSnap because nothing else talks to your league. That's the job we remove." | Owner's own field observation |
| **"What about streaming?"** | **"We don't do video yet, and I won't pretend otherwise."** Then pivot: "What we do is the chain nobody else has — a parent finds your club, registers, signs the waiver, gets rostered, the roster goes to the league, the league schedules it, the game is scored live, and the stat line lands on the kid's public profile." | §3x ecosystem chain |

**The one-line frame for any of these:** *"You're not choosing between us and them. Everything you named solves one link. We're the only one that closes the chain."*

---

## 3y. RAMP vs us — the capability comparison for the OBL pitch

Owner ask 2026-08-15: forget the money, what does RAMP actually do and how good is it. Sources: RAMP's own product pages (via search index — their site 403s and Cloudflare-challenges direct fetches), Capterra listing + reviews, Google Play listing, OBA's own announcement.

### 🚨 The finding that changes the OBL pitch

From Ontario Basketball's own announcement of the Canada Basketball partnership:

> **"The RAMP Interactive system will be available for free for all OBA member clubs for the use of their own club registration."**

Three consequences, and they are large:

1. **RAMP is free for the ~175 OBA-affiliated clubs.** Our earlier read — "RAMP has no free tier, US$500 floor, quote-only" — is **true in general and false in Ontario basketball**. We cannot win an OBA club on registration price. The incumbent is free, nationally aligned, and comes down through the PSO.
2. **But RAMP is only doing membership and registration for OBA.** It carries member registration, championship registration and OBL team registration. **The OBL schedule itself lives in Google Sheets** (public CSV export — that's how we enumerated 1,256 teams). There is no live scoring, no automated standings, no stats, no content.
3. **So the pitch is not "replace RAMP." It is "replace the spreadsheet."**

That reframing solves the pricing problem too. We are not competing with free registration software. We are competing with a Google Sheet, an email list, and nothing at all on game day.

### The actual OBL workflow, traced end to end (2026-08-15)

Owner challenge: *"How are clubs submitting teams to OBL? How is this information communicated back to the parents?"* Traced from OBA's own pages and **RAMP's own published user guides** (associations host them on `cloud.rampinteractive.com`; RAMP's marketing site 403s but the PDFs are public).

**Step 1 — club submits, via a 32-page manual and three tutorial videos.** OBA's process is: Club Affiliation (manual pp. 1–5) → Create and Assign a Staff Account (pp. 6–11) → Rostering (pp. 12–29) → **Register for Programming** (pp. 30–32). The club picks a tier (OBLX / AAA+ / AAA, suggested from Ontario Cup results) and pays the team fee. Deadlines stagger by age group — U9–U12 Sept 25, U13–U14 Oct 2, U15–U19 Girls Oct 9, U15–U16 Boys Oct 16, U17–U19 Boys Jan 22. *"Once the relevant OBL registration deadline has passed, the registration package on Ramp will close."* Late = OBA team fee **+ $150** and "no guarantee" of approval.

**Step 2 — the league schedules in Google Sheets.** Verified on OBA's own schedule page: schedules are **published as Google Sheets, one per division**, released *"approximately 1–2 weeks prior to the competition weekend,"* and *"not considered official until confirmation via email is sent."*

**Step 3 — there is no step 3.** OBA's own site describes **no app, no parent notification system, and no standings tracking** for OBL. Parents *"must actively check the Google Sheets or wait for email announcements rather than receiving automated updates."*

> **So the loop is open.** Club submits teams into RAMP → OBL publishes a spreadsheet → parents refresh a spreadsheet. Nothing about the game comes back.

### ⚠️ RAMP GameSheets is a HOCKEY scoresheet — there is no basketball mode

From RAMP's own team instructions (WHA Ontario), the app's tabs are literally: **Game Details · Goals · Goalies · Penalties · Rosters.** No points, no rebounds, no assists, no fouls, no quarters. Additional findings from the same guide:

- The coach creates **"a personal account… not tied to a team or an association."**
- Every game needs a **unique code** handed out by the convenor or home team; codes **auto-delete 7 days** after the game and cannot be deleted manually.
- **"The timekeeper will be entering all the stats… You as the team coach will not be entering any statistical information… you cannot input or change the information yourself via the app."**
- Suspensions must be **emailed** to the league within 24 hours. RAMP is *"currently working to link the website to the database for the game related suspensions to auto populate"* — **the gamesheet and the membership database are not integrated.**

And for anything outside league play (RAMP Team Desktop guide, Kanata Girls Hockey): **"The Games button only brings up non-league games… Games registered in this part of the website will not generate a Game Sheet code… This means you need to use a paper game sheet and upload a picture of it to the results."** Also **"Games are not verified by the other team."**

### ⚠️ The account model is as bad as the owner found it

- **RAMP Team Desktop: "Each team will have ONE username and password to be used. The system is not capable of having multiple usernames associated to the same team."** Passwords reset by the association admin.
- **Parents cannot self-serve.** The manager adds players and parent emails and ticks *"Send Team Ramp App Invite."* There is **no team discovery, no self-registration, no adding your own child**. You are invited or you are not in.
- **No SSO anywhere** — email and password only, on every surface. Matches what the owner saw.
- **"All players have been defaulted to be hidden from the public on the main website."** No public player pages.
- App reviews: 4.6★ but *"so, so many bugs and errors,"* freezing, and users *"missing practices and tournaments because the app communication chat doesn't work."*

### Where I'd push back on "no different than a spreadsheet"

The owner's read is ~80% right, and the 20% matters because attacking the wrong part loses the room.

**RAMP is not a glorified spreadsheet. It is a glorified registrar's filing cabinet, and it is genuinely good at that.** From the club guide, the club database carries: full registration history per member, **Matching Members** (duplicate detection and merge), **Retention** (compare two seasons for returning/new/missing registrants), Memberships Check, **Age Check** (registered outside age range), **Position Check**, **Requirement Check** (does this coach hold the right certification for this division), Suspensions, Alerts, Locked Accounts and Locked Registrants, waivers layered PSO-then-club, qualifications, **criminal record check expiry tracking**, promo codes, volunteer sign-up jobs with obligation tracking, clinics, and permits/sanctions/forms.

**That is a real compliance engine and a spreadsheet cannot do it.** It is exactly what a provincial body needs and exactly why Canada Basketball standardised on it. Do not walk into OBA and call it a spreadsheet — the registrar in the room knows better and you lose credibility in one sentence.

**But it is emphatically not a club operating system and not a game-day system.** The club modules are Settings, Seasons, Competitions, Clinics, Permits/Sanctions/Forms, Teams (view + assign players/staff only), Packages, Build a Page, Members, Registrations. **There is no scheduling module, no scoring, no stats, no standings, no communications feed, no media.**

> **The accurate sentence: RAMP answers "who is registered and are they eligible." It has no answer for anything after tip-off, and no answer for the parent.**

### What RAMP actually provides

| Module | What it does | Verified |
|---|---|---|
| **RAMP Registrations** | Registration setup, payment processing, reporting, member management. **Registers referees/officials with certification tracking**, integrates with RAMP Assigning | ✅ product page |
| **RAMP Websites** | Site design, CMS, schedules, standings, news. Every `*.msa4.rampinteractive.com` league site | ✅ |
| **RAMP Team App** | Rosters, schedules, communication, calendar sync, **attendance tracking**, availability/RSVP for games and practices, event RSVPs | ✅ Play listing |
| **RAMP Gamesheets** | Digital gamesheet replacing paper. **Works offline, syncs automatically**, integrates with the league site for real-time stats and standings | ✅ product page |
| **Officials Assigning** | Official scheduling, availability management, **payment processing** for officials | ✅ |
| **Governing-body hierarchy** | National → provincial → association → club → team. **This is the actual product** and why Canada Basketball and OBA chose it | ✅ |
| Also | Volunteer management, in-game analytics, calendar sync, player profiles with medical + registration history across seasons | ✅ Capterra |
| Scale | **10,000+ clubs, leagues, associations and governing bodies** across North America; ~40 sports; Edmonton, founded 2002 | ✅ |

### How good is it, honestly

**Better than we have been assuming, in its own lane.**

- **Google Play (RAMP Team): 4.6★, ~1,070 ratings, ~56K downloads.** That is a real, functioning consumer app with genuine adoption, not vapourware.
- **Capterra: 4.0 overall from only 2 reviews** — ease of use 4.0, customer service 4.0, features 4.0, **value for money 3.5**. Tiny sample, treat as anecdote not data.
- Positive review: handled "registrations, special fees, sponsorships, misc. sales, rostering of teams, scheduling" for five years "without issue"; support answers "usually on the same phone call."
- Negative review: "**data is routinely lost**," "chat notifications never clear, chat doesn't work if you click on notification," "volunteer section doesn't work," and they were **forced to use it** by their association.
- App reviews report "so, so many bugs and errors," freezing, and "while RAMP has improved, it's still far from where it needs to be."

**Verdict: solid, unglamorous institutional plumbing with real reliability complaints and a dated feel — but genuinely deep on the administrative and officials side, offline-capable on gamesheets, and deeply entrenched.** Do not walk into OBA calling it bad software. It does its job, and their national body chose it.

### Where we actually beat RAMP

| Capability | RAMP | Us | Notes |
|---|---|---|---|
| **Live play-by-play, basketball** | ❌ Gamesheets are hockey-first | ✅ native, basketball-deep | Their gamesheet records a hockey scoresheet, not basketball possessions |
| **Public player profile pages** | ◐ stats appear on the league site | ✅ `/p/handle`, permanent, follows the kid | Confirmed white space category-wide |
| **AI game recaps, public** | ❌ | ✅ | SEO + distribution asset |
| **Feed / follow graph / social** | ❌ | ✅ | RAMP has no consumer surface at all |
| **Family subscription product** | ❌ none | ✅ Plus/Premium | RAMP has no consumer revenue line |
| **Highlights, clips, reels, media** | ❌ | ✅ (Premium) | |
| **Streaming** | ❌ | ❌ Y2 pilot | Neither of us. Not a differentiator yet |
| **Season-league scheduling with constraints** | ✅ exists | ✅ scheduler v2 | **But OBL doesn't use RAMP's — they use Google Sheets** |
| **Automated standings + tiebreakers** | ✅ | ✅ configurable | |
| **Referee self-serve end-to-end** | ✅ assigning + payment | ✅ + availability + **digital sign-off** | Closest RAMP comes to matching us |
| **Offline scoring** | ✅ **gamesheets work offline** | ❌ | **Their advantage. Gyms have bad wifi.** |
| **Governing-body hierarchy** | ✅ the whole point | ◐ tenant model, not PSO-shaped | **Their advantage, and it's structural** |
| **~40 sports** | ✅ | ❌ basketball only | Advantage for a PSO, irrelevant to OBL |
| **Volunteer management** | ✅ | ❌ | Minor gap |

### The three-sentence OBL pitch this produces

> RAMP handles your membership and registration and Canada Basketball has standardised on it, so keep it. **What it does not do is game day** — your 1,256 OBL teams are scheduled in a Google Sheet, there is no live scoring, no automated standings, no stats, no player pages and nothing for parents. **We are the game-day layer on top of RAMP**, and every game we cover generates content that promotes OBL for free.

**Do not pitch replacement. Pitch the layer.** It avoids a price fight we cannot win, avoids asking OBA to unwind a national partnership, and targets a gap that is unambiguously real.

### The two things to fix before that meeting

1. **Offline scoring.** RAMP has it and gyms have bad wifi. First technical objection an OBA operations person will raise.
2. **A story for the governing-body hierarchy.** OBA thinks in PSO → association → club → team. Our tenant model needs an answer for how a provincial body sees across its members.

---

## 3z. THE THREE TARGETS — what they run, what they pay, what to charge them

This is the section that should have been written first. OBL, NPH and NJC/NSC are the first three pitches; everything else in this document is background to them.

### The stack each one actually runs

| | **OBL / Ontario Basketball** | **NPH (North Pole Hoops)** | **National Jr / Sr Circuit** |
|---|---|---|---|
| **Operator** | Ontario Basketball Association (PSO) | Tariq + Elias Sbiet, Burlington ON | Tony House, Ottawa (Canada Topflight) |
| **Registration / membership** | **RAMP InterActive** — via a **Canada Basketball** partnership, from 2023-24 | Own site + `/2026-application/` | **TeamLinkt** (migrated off Stack Sports/GOALLINE) |
| **Scheduling / results** | Google Sheets (public CSV export) | Bespoke PHP/Vue portal `stats.northpolehoops.com` | TeamLinkt (assoc 27543 / 27544) |
| **Live scoring / stats** | — | **SWISH by NBN23** (FIBA-endorsed digital scoresheet, partner since Feb 2023) | TeamLinkt |
| **Events / brackets** | — | **Exposure Events** (Showcase League) | TeamLinkt |
| **Streaming** | — | **BallerTV** (Nov 2024) + own YouTube broadcast | **CBC Sports Local** |
| **Family app / push / iCal** | ❌ | ❌ (Exposure's app; own calendar widget abandoned ~2022) | TeamLinkt app |
| **Size** | **1,256 team entries · 19 divisions · 645 club stems** · OBA claims ~16,000 athletes | **230 team entries · 121 orgs** (SL 146, D1 60, NPA/WNPA 24) | **83 team entries · 73 clubs** (NJC 51, NSC 32) |
| **What they charge a team** | Unknown — the one number I still need | **$3,990 + tax per team** (Summer 2026), 50% non-refundable deposit, $500 forfeit fee | **$5,150 all-in** · $950/session · $4,500 for 3–4 sessions + champs |
| **Estimated collections** | — | SL alone 146 × $3,990 ≈ **$583K**; all properties ≈ **$918K** | 83 × ~$4,800 ≈ **$400K** |
| **Estimated software spend** | RAMP, bundled through the PSO/CB partnership | **Very low.** Exposure ≈ $2/team/event; **NBN23 is free to competition organisers**; BallerTV rev-share | **$0** — TeamLinkt free core |

### 🚨 Two findings that reframe the NPH pitch

**1. NBN23 gives NPH the scoresheet free and sells NPH's parents a subscription.** SWISH GOLD is **$2.99/mo or $29.99/yr** for advanced player and game stats, full game history and filters. NBN23 states it provides its services **free of charge to federations**. So NPH's stats partner monetizes NPH families directly, and NPH sees none of it.

⚠️ **CORRECTED 2026-08-15 (owner challenge).** I first wrote that this was "proof the model works on these families" and "our competitive floor, already installed on their phones." **That was an unevidenced inference and the owner was right to reject it.** What is actually established:

- ✅ SWISH GOLD exists at $2.99/mo · $29.99/yr, and the free tier shows scores **only at the end of each period**; GOLD unlocks minute-by-minute, detailed player/game stats, full history, advanced filters.
- ✅ NBN23 provides services free to competition organisers.
- ❌ **No evidence any NPH family subscribes.** I have no download-by-region data, no NPH-specific uptake figure, and NBN23's own NPH page says nothing about consumer pricing.
- ❌ **And the owner's counter-argument is strong**: `stats.northpolehoops.com` is a free public portal carrying box scores and standings. An NPH parent can already get the result and the box score for nothing, from NPH directly. **The marginal value of GOLD to that parent is probably low**, which means uptake is probably low.

**Revised read:** SWISH is a *scoresheet vendor with a consumer app attached*, not a proven consumer business inside NPH. Treat $29.99/yr as a **price reference point that exists in basketball**, not as a floor we must beat and not as evidence of demand. **The real lesson runs the other way**: NPH gives away box scores free and still has no family product, no push, no iCal and an abandoned calendar widget — so the family relationship at NPH is **unclaimed**, not contested.

That is a better fact for the pitch than the one I originally wrote.

⚠️ **Tactical warning: do not lead with this in the NPH meeting.** "Your vendor is monetizing your parents" invites the response "then so will you, and I want a cut" — which lands directly on rung 4 of the concession ladder (§10), the one rung we do not concede. Know it; don't open with it.

**2. NBN23 already integrates with Exposure Events** (they publish a joint digital-stat-keeping page). NPH's two main vendors are partnered with each other. Displacing one means arguing against the pair.

### The pricing rule for leagues

The per-team fee that is invisible at NPH is **not** invisible at OBL, because their team fees are an order of magnitude apart. So the rule is proportional, not absolute:

> **Charge a league no more than ~1% of what that league charges a team.**

| League | Their per-team fee | 1% | Recommended per-team-per-season |
|---|---|---|---|
| **NPH** | $3,990 | $39.90 | **$39** (LEAGUE MEDIA) — 0.98% of their fee |
| **NJC / NSC** | ~$4,800–5,150 | $48–51 | **$39–49** — under 1% |
| **OBL** | ~~unknown, likely $300–800~~ → **$2,900 (U10–U14) · $2,950 (U15–U19) · $1,935 (U9)** | $29 | **$19–39 — trivially affordable** |

⚠️ **RETRACTED 2026-08-16.** This section previously guessed OBL team fees at "$300–800" and concluded $39/team would be "5–13% of what a club pays OBL... would be refused." **OBA's own 2025-26 Rules & Regulations Manual §1.1 shows OBL charges $2,900 per team (U10–U14) and $2,950 (U15–U19)** — within 30% of NPH's $3,990. See [[league-economics-and-obl-structure-2026-08]].

**Corrected position: $39/team is 1.34% of an OBL team fee and OBL can easily afford it.** At 1,256 teams that is **$48,984/season** — against the **~$4.6M** OBA collects from the OBL ecosystem, and against the **~$10,900 a typical 3-team club already pays OBA every season**.

**Revised recommendation for OBL: charge the full $39/team ($48,984), and lead the pitch with the 29% travel reduction rather than the fee.** The earlier "charge near zero" advice was built on a bad number and should be discarded.

### What each target is worth per season

| | LEAGUE CORE $19 | LEAGUE MEDIA $39 | Their clubs (Pro) | Their families (8% × $75) | **Total** |
|---|---|---|---|---|---|
| **NPH** 230 teams / 121 orgs / ~2,850 players | $4,370 | **$8,970** | 121 orgs, mostly small — est. **$12K** | ~2,300 families → **$13,800** | **≈ $35K/season** |
| **NJC+NSC** 83 teams / 73 clubs / ~1,030 players | $1,577 | **$3,237** | 73 orgs — est. **$7K** | ~830 families → **$4,980** | **≈ $15K/season** |
| **OBL** 1,256 teams / 645 clubs / ~15,600 players | $23,864 | $48,984 | 645 clubs — est. **$60K+** | ~12,500 families → **$75,000** | **≈ $140K/yr** at $5/team league fee |

Rostered players computed at the censused **12.4 players/team**.

**Read the OBL row carefully.** Even charging OBL essentially nothing at the league level, the league is worth ~$140K/yr because of its 645 clubs and 15,600 families. **NPH is the marquee logo; OBL is the money.** They should be pitched differently and probably in that order — NPH for the case study and the content, OBL for the volume.

---

## 3d. Who actually uses what — from our own census

Mined from `docs/research/canada-basketball-clubs.csv` (964 clubs, rest-of-Canada expansion census, human-researched `Software` column) and `docs/research/consolidated/clubs-consolidated.csv` (1,516 rows incl. Ontario). **446 of 964 clubs have a platform recorded**; the other 518 are blank, so all shares below are of the 446, not of the whole census.

### Vendor share — clubs with a platform recorded (n=446)

| Platform | Clubs | Share | Where they are |
|---|---|---|---|
| **RAMP InterActive** | **117** | **26.2%** | AB 39 · MB 22 · NS 22 · NL 18 · NB 8 · SK 3 · BC 2 · Terr 2 · QC 1 |
| **TeamLinkt** | **69** | **15.5%** | SK 40 · AB 13 · NS 4 · NB 4 · NL 4 · BC 3 · MB 1 |
| Website-only (Wix/Squarespace/WP) | 65 | 14.6% | scattered |
| Social/forms only | 37 | 8.3% | scattered |
| SportsEngine/Sportngin | 24 | 5.4% | scattered |
| TeamSnap | 22 | 4.9% | scattered |
| Citrus Camps | 14 | 3.1% | Rock Sports network |
| LeagueApps | 12 | 2.7% | scattered |
| Amilia | 8 | 1.8% | QC-leaning |
| eSportsDesk | 4 | 0.9% | legacy |
| **Exposure Events** | **3** | 0.7% | event operators (incl. NPH) |
| Unclassified | 127 | 28.5% | mixed/custom |

### ⚠️ TeamLinkt: the owner has never encountered it, and the data agrees

Owner challenge 2026-08-15: *"I've never seen anybody in my career that uses TeamLinkt."* **Our own census supports that, and I should have said so instead of presenting TeamLinkt as a headline threat.**

- TeamLinkt's 69 census clubs are **Saskatchewan 40 · Alberta 13 · NS 4 · NB 4 · NL 4 · BC 3 · MB 1 — and Ontario 0.**
- Domain detection across 621 Ontario clubs finds **exactly one**.
- In Ontario basketball, the only TeamLinkt deployment that matters is **NJC/NSC** (Ottawa, assoc 27543/27544) — a circuit, not a club platform, and one operator.

So it is simultaneously true that TeamLinkt is **real at national scale** (3,500 orgs, a 4.6★ app with ~6,750 ratings, more app reviews than RAMP's) and **essentially absent from the owner's market**. Both facts matter: it is not a threat in the room in Ontario, and it *is* the template for what a free-core competitor looks like if it ever moves east.

**Practical consequence: stop benchmarking Ontario pricing against TeamLinkt.** In Ontario the relevant incumbents are **RAMP** (via OBA/Canada Basketball), **Exposure Events + NBN23** (via NPH), and **spreadsheets**.

### ⚠️ The finding that matters most: **neither incumbent has Ontario**

RAMP's 117 clubs include **one** Quebec club and **zero Ontario**. TeamLinkt's 69 include **zero Ontario**. Domain-level detection across the 621 Ontario clubs in the consolidated file confirms it: of 432 Ontario clubs with a website, **98.4% run their own domain**, 1 on TeamLinkt, 0 on RAMP.

Two readings, and we should be honest that we can't yet tell them apart:
1. **Ontario is genuinely unconsolidated** — clubs run custom sites and hand-rolled registration, which is a far better market to enter than one already locked up.
2. **We never researched the Ontario `Software` column.** `docs/ontario-basketball-clubs.csv` has no such field. The near-zero could be a measurement artifact.

**This is a concrete, cheap research task and it should be done before pricing is locked** — the answer changes whether we are displacing an incumbent or filling a vacuum, and those are different price points and different sales pitches. Ontario is our beachhead and it's the one province where we don't know what people run.

### Club size, by platform (clubs matched to a verified team count)

| Platform | n | Median teams | Mean | Range | ≤3 | 4–10 | 11–25 | 26–60 | 60+ |
|---|---|---|---|---|---|---|---|---|---|
| RAMP | 30 | **7** | 16.7 | 1–66 | 6 | 10 | 7 | 6 | 1 |
| TeamLinkt | 7 | **5** | 9.6 | 3–28 | 2 | 3 | 1 | 1 | 0 |

Small n on the join, so treat as directional. The shape is still informative: **both incumbents serve mostly small clubs** (median 5–7 teams), with RAMP carrying the large association tail — SWBA 66 teams, NWZBA 59, Strathcona 46, Parkland 41, NEBA 37, all Alberta. Those large associations are RAMP's real franchise and the hardest to move.

---

## 3e. What those clubs are actually paying

Both vendors are quote-only, so this is assembled from disclosed fragments. Confidence noted on every line.

### The disclosed numbers

| Fact | Source | Confidence |
|---|---|---|
| RAMP starting price **US$500** (≈ CA$680), flat rate, custom/bundled (site + registration + assignor + team app) | Capterra listing | **Medium** — a listing figure, not a rate card |
| RAMP merchant rate **"lowest in the industry, under 2%"**, optionally added onto the registration fee | RAMP's own registrations page | **Medium** — vendor claim |
| RAMP is aimed at organizations with **1,001+ members** | Capterra listing | Medium |
| RAMP charges **per-user fees** | Implied by TeamLinkt's competitor page titled "A No-Per-User-Fee Alternative to RAMP InterActive" | **Low** — hostile source, amount never stated |
| RAMP value-for-money rated **3.5/5**; one reviewer "forced to use it" by their association | Capterra reviews | Medium — and note the captive dynamic |
| TeamLinkt core **$0**, bundles **$425 / $425 / $795per yr** | TeamLinkt pricing page | **High** |
| TeamLinkt processing **2.7% + $0.30 for non-profits** | TeamLinkt competitor page | **Medium-high** |
| TeamLinkt claims **"$3,000+ savings"** switching from SportsEngine/Sports Connect | TeamLinkt site | Low — marketing, but it implies the SportsEngine spend they target |
| **TeamLinkt Plus: CA$4.99/mo consumer subscription** — ad-free, 5 users, video up to 20 min, all-schedules view | TeamLinkt Plus page | **High** |

### 🚨 TeamLinkt now has a family subscription and our matrix says they don't

[[tool-feature-matrix-2026-07]] records TeamLinkt consumer subscription as "✗ (ads instead)". That is now **stale**. TeamLinkt Plus is **CA$4.99/mo** — they have entered the family-monetization lane and are priced at **62% of our proposed $7.99 Plus**. The matrix needs correcting and our Plus price needs re-argued against $4.99, not against GameChanger's $39.99/yr alone.

### Modelled annual spend, by club size

Assumes ~11 players/team and the fee levels typical of the associations in the census. **Payment fees are usually passed to families**, so the "software" column is what a club board actually argues about.

| Club size | Players | Reg. volume | RAMP software | RAMP payment (<2%) | TeamLinkt software | TeamLinkt payment (2.7%+$0.30) |
|---|---|---|---|---|---|---|
| 5 teams | ~55 | ~$19,000 | ~$680 | ~$380 | $0–425 | ~$530 |
| 12 teams | ~132 | ~$53,000 | ~$680–1,000 | ~$1,060 | $0–795 | ~$1,470 |
| 25 teams | ~275 | ~$124,000 | ~$1,000–2,000 | ~$2,475 | $425–795 | ~$3,425 |
| 50 teams | ~550 | ~$248,000 | ~$2,000+ | ~$4,950 | $795 | ~$6,860 |

**What this says for our pricing:**
- The **software line a club board debates is CA$0–2,000/yr.** Our proposed Community $290 / Club $590 / Elite $1,190 sits inside that range at every size, and *under* RAMP's floor for anything above a small club. The "same or less, for more features" pitch is quantitatively true on the software line.
- RAMP's real lock-in is **not price, it's mandate.** "Forced to use it" plus the governing-body hierarchy means provincial bodies push clubs onto it. **Price is not the lever there; the PSO relationship is.** Discounting at a mandated club is wasted effort.
- TeamLinkt's free core means **we cannot win small clubs on price at all.** Below ~10 teams they pay $0. We win those on product (basketball depth, content, family app) or not at all — which is exactly the free-tier-generosity argument in §4.

### 🚨 The payments problem this exposes

Our proposed card rail is **Stripe passthrough + 0.5%**, i.e. roughly **2.9% + 30¢ + 0.5% ≈ 3.4% all-in**. [[business-model]] Engine D is worse: `platformFeeBps` **on top of** Stripe at 2.0% + $0.30 at Starter ≈ **4.9% + 60¢ all-in**.

| Rail | All-in card rate |
|---|---|
| **RAMP** | **under 2%** (their claim) |
| **TeamLinkt** | **2.7% + $0.30** (non-profit) |
| Us, v3 proposal | ~3.4% |
| Us, business-model.md Starter | ~4.9% + 60¢ |

**On cards we are the most expensive option in Canada, not the cheapest.** The v2/v3 line "cheaper than any card option" is true against LeagueApps and Spond US, but **false against both Canadian incumbents**. Only the **Interac e-transfer rail at 1.5% genuinely undercuts them**, and only because its cost base is a flat ~$1 rather than interchange.

Three consequences:
1. **Stop claiming card-rate leadership.** It does not survive contact with a RAMP club.
2. **The e-transfer rail moves from "nice margin" to "the entire payments story."** It is the only rail where we win, and in Canada e-transfer is culturally native. This raises the priority of the aggregator calls and the RPAA legal question in §9.
3. **Reconsider the card markup entirely.** Passthrough + 0.5% may be worth dropping to passthrough + 0 as a loss-leader, with margin taken on e-transfer only. That makes "we never mark up your card fees" a clean claim nobody else in Canada can match.

---

## 3f. Who is each platform actually FOR

The question the feature matrix never answered directly. **Legend: ✅ built for them · ◐ serves them shallowly or as an add-on · ❌ not served.**

| Audience | **US** | RAMP | TeamLinkt | SportsEngine | TeamSnap | LeagueApps | GameChanger | Exposure |
|---|---|---|---|---|---|---|---|---|
| **League / governing body** | ✅ | ✅ | ✅ | ✅ | ◐ | ◐ | ❌ | ◐ events only |
| **Club / association admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ◐ |
| **Coach / team staff** | ✅ | ◐ | ✅ | ✅ | ✅ | ◐ | ✅ | ◐ |
| **Parent / family** | ✅ | ◐ team app | ✅ + **$4.99/mo Plus** | ✅ + Play sub | ✅ | ◐ portal | ✅ **the whole product** | ◐ event app |
| **Player (own identity/profile)** | ✅ **/p/handle public** | ◐ stats on site | ◐ in-league | ❌ private by design | ❌ | ❌ | ◐ baseball stats only, paywalled | ◐ team pages |
| **Referee / official** | ✅ **self-serve end-to-end** | ✅ assignor | ✅ + pay tracking | ◐ tags only | ❌ | ❌ | ❌ | ? |
| **Public fan / follower** | ✅ feed, follows, recaps | ◐ site news | ◐ site news | ◐ CMS | ❌ | ❌ | ◐ team-scoped | ❌ |
| **Scout / recruiter** | ◐ planned Exposure Pass | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ **the point of the product** |
| **Sponsor / advertiser** | ◐ planned | ❌ | ✅ sponsorship module | ◐ | ❌ | ❌ | ❌ | ◐ marketing credits |
| | | | | | | | | |
| **Who actually pays** | club + family + league | club/association | club (bundles) + family | club | coach/club | club | **family only** | event operator |
| **Sport focus** | basketball-deep | hockey-first, ~40 sports | hockey-first, 20+ | all | all | 9 | baseball-first | **basketball-first** |
| **Canada-native** | ✅ | ✅ | ✅ | ❌ US-first | ❌ US-first | ❌ US | ❌ US | ❌ US |

### Reading the matrix

**Nobody is us.** The three closest, and why each falls short:

- **TeamLinkt is our closest structural analogue** — free core, club + league + family, Canada-native, and now a family subscription. It is the competitor to watch. It loses on **basketball depth** (hockey-first templates, standings-only basketball in the wild), **player identity** (no public profiles), and **content** (no recaps, no follow graph, no feed). It wins on **fundraising/sponsorship** and **free**.
- **GameChanger is our closest revenue analogue** — free to the org, monetize the family. But it has **no league layer at all**: no registration, no payments, no cross-team standings, no websites, no officials. It cannot be a league's system of record, so it never competes for the league relationship.
- **RAMP is our closest institutional analogue** — governing-body hierarchy, officials, gamesheets, the thing a PSO mandates. It has **no consumer side whatsoever**: no family subscription, no content, no player identity, no social layer. It is plumbing, sold to administrators.

**The composite claim that is actually defensible:** we are the only platform that is a league's system of record *and* a family's consumer product *and* a player's public identity, in one product, basketball-first, in Canada. Every incumbent has two of those at most, and usually one.

**Where that leaves pricing:** we should not price as "cheaper TeamLinkt." We should price the software line at or below the incumbent (which §3e shows is easy) and take the real margin on the two things nobody else sells at all — the **family relationship** and, later, the **player's exposure profile**.

---

## 3c. The gaps — ours and theirs

The honest version, from [[tool-feature-matrix-2026-07]] which had already done this work.

### Confirmed white space — nobody is here, so price above the market, not below

1. **Public player profile pages.** Every incumbent is absent or partial: SportsEngine private by design, TeamSnap absent, LeagueApps absent, GameChanger's athlete profiles are shareable but career stats are **baseball/softball only** and gated behind Premium. Our `/p/handle` is the bet, and it is the foundation of the **Exposure Pass** (§6b).
2. **Public AI game recaps.** Only GameChanger generates them, and they are paywalled and team-scoped. Ours are public league content, which makes them an SEO and distribution asset rather than a feature.
3. **Native basketball play-by-play plus league ops plus payments plus public content in one product.** Full-stack admin platforms (SportsEngine, TeamSnap, TeamLinkt) are weak on basketball game-day depth. The game-day leader (GameChanger) has **zero league layer** — no registration, no payments, no cross-team standings, no websites, no officials. The basketball-events leader (Exposure) **rents** its live scoring. We are the only column with all four.
4. **Referee self-serve end-to-end** — availability, booking and digital sign-off. Only us. A sleeper differentiator, and the reason §5's ref strategy is a distribution play.

### Our real gaps — the honest list

| Gap | Who has it | Cost to us |
|---|---|---|
| **Streaming** | TeamSnap and GameChanger give it **free**; BallerTV and NPH charge for it | Biggest one. NPH sells broadcast at $2,000/team; we have no answer until the Y2 AI-stream pilot |
| **Fundraising / sponsorship suite** | TeamLinkt monetizes it as a paid bundle | Blocks the "we make clubs money" pitch that defuses fee objections |
| **Offline scoring** | RAMP (gamesheets) | Gyms have bad wifi. This is an operational credibility gap, not a nice-to-have |
| **App-store presence** | Everyone | Built on EAS, dormant pending owner-side steps |
| **French** | Kreezee is FR-first in Quebec | Blocks Quebec entirely — and Quebec is also where the §7 minors-likeness law is strictest |
| **Event / tournament depth + NCAA certification** | Exposure Events | The specific thing NPH is currently paying someone else for |

**The last row is new and it is the one to act on.** If the plan is to win NPH, "we replace Exposure" requires event-shaped scheduling, bracket propagation and NCAA-certification compliance, not just a better season league product.

---

## 4. Should we charge the clubs?

**Recommendation: yes — but late, optionally, generously tiered, and offsettable against payment volume.**

### The rule that governs the free/paid line

> **Never gate anything that reduces the amount of content on the platform.**

Rosters, schedules, communication, game scoring, media upload, feed posting, safety and consent — all free forever, for every club, at every size. Every one of those things produces the content that produces the family revenue. Gating them is negative-margin: we'd trade a certain $720/yr of family revenue for an uncertain $590/yr of subscription.

Second rule: **never gate safety.** Waivers, medical info, concussion protocol, background-check tracking, incident reporting. Charging for child safety is indefensible and one screenshot away from being a news story.

### Club free tier — deliberately more generous than the incumbents

- Unlimited teams, players, staff, seasons
- Registration and payment collection (all three rails, §6)
- Full scheduling, RSVP, attendance, practices
- **Live scoring and full stats** — including ghost-opponent exhibition scoring
- Team + club messaging, announcements, polls
- Club public page, roster pages, standings
- Photo and video upload, feed posting
- Waivers, consents, medical, safety, background-check tracking
- Basic accounting view, offline payment recording
- One club admin seat + unlimited staff

### Club paid tier — money, growth, brand, admin scale

Everything a club pays for should map to *making money, saving money, looking bigger, or handling scale*. Never to basic operation.

| Pro capability | Why a club pays |
|---|---|
| **Custom domain + full site builder + SEO** | Looks like a real organization; replaces a web contractor |
| **Club-branded media coverage** (§8) | Their logo on the weekend's photos/video, downloadable full-res, right to reuse in their own ads |
| **Sponsorship module** | They earn money — easiest sell on the list |
| **Accounting exports, aging, dunning, financial aid, installments** | Recovers the 3–8% of fees clubs lose to shrinkage |
| **Advanced analytics** — registration funnel, retention, roster churn, revenue by program | Board-meeting material |
| **Tryouts + evaluations at scale** | Rep programs with 200+ tryout skaters |
| **Tournament and camp hosting** | New revenue line for them |
| **Multi-admin seats + roles + audit log** | Real associations need this |
| **Priority support + onboarding/migration** | Switching cost from RAMP is the #1 objection |

### 📊 MULTI-LEAGUE ANALYSIS (owner ask 2026-08-16) — and why it changes the pricing unit

Computed from `docs/research/consolidated/clubs-consolidated.csv` (621 Ontario clubs, 535 with league data), `docs/research/raw/obl-division-teams.json` (1,256 OBL team entries, 645 club stems) and `docs/research/raw/on-club-sizes-full.json`.

#### Ontario is severely league-fragmented, and multi-league is the norm

**44 distinct leagues** appear in the Ontario census. Across 535 clubs there are **1,231 club-league relationships** — every one of which is a separate registration portal, deadline, roster format and payment.

| Leagues per club | Clubs | Share |
|---|---|---|
| 1 league | 176 | 32.9% |
| **2 leagues** | **195** | **36.4%** |
| 3 leagues | 83 | 15.5% |
| 4 leagues | 40 | 7.5% |
| 5 leagues | 19 | 3.6% |
| 6–14 leagues | 22 | 4.1% |

> **67.1% of Ontario clubs play in two or more leagues. The average is 2.30.** Extremes: Norfolk Youth Basketball at 14, Toronto Lords at 12, Gators Basketball Academy at 9, Scarborough Basketball Association and Burlington Basketball at 8.

Top Ontario leagues by club count: **OBL 215 · OBA-affiliated 185 · NPH Showcase 100 · NPH-SL 77 · CYBL 61 · NJC 54 · Phoenix 49 · OSBA 44 · NSC 44 · NPH-D1 39 · Hoop City 32 · Summer League 32 · Jr. NBA 31 · EOBA 26 · Coalition 19 · JUEL 15.**

#### The OBL cohort is *more* multi-league than average

| Metric | Value |
|---|---|
| Ontario clubs listing OBL or OBA | **217** |
| Of those, also playing ≥1 non-OBL league | **97 (44.7%)** |
| **Average leagues per OBL club** | **3.01** — well above the Ontario average of 2.30 |

Where OBL clubs also play: **CYBL 26 · NPH-SL 24 · NPH Showcase 22 · Coalition 16 · EOBA 14 · Jr. NBA Canada 11 · EOBA 11 · Jr. NBA 10 · Jr. WNBA 10 · ORBL 9 · Phoenix 9 · NJC 8 · Hoop City 8 · Summer League 8 · JUEL 8.**

⚠️ **Correcting the owner's estimate.** The guess was *"160 clubs that play for NPH also play in OBL."* The real number is far lower, because **NPH only has ~121 distinct organisations in total** across SL, D1, NPA and WNPA. Direct name-matching OBL club stems against the NPH-ecosystem club list gives **~42 matches** (some of which are false positives — "Simcoe United Spartans" matching "DC UNITED", "Hamilton Elite" matching "Hamilton Transway"). The league-column method agrees: **NPH-SL 24 + NPH Showcase 22 ≈ 40–46 OBL clubs also play NPH.**

**So the honest number is ~45, not 160 — roughly 37% of NPH's clubs also play OBL.** That is still a strong overlap story, just a smaller one, and it is better to walk into NPH with the defensible figure.

#### ✅ GAP CLOSED (2026-08-16) — after two errors the owner caught

⚠️ **Two numbers I published on 2026-08-16 were wrong. Both are retracted here.**

**Retraction 1 — "645 distinct OBL club stems" are not clubs.** They are **coach-suffixed team names**: `MUMBA ELITE - VARNAN`, `MUMBA ELITE - TORRES`, `Burloak Elite Allen`, `Kingston Impact- Morgenstern`. The file's own `distinct_club_stems` field counts naming variants. It also contains 16 rows of **scraped JavaScript** (`b){a.g&&clearInterval(a.g);for(var c={}`). Grouped conservatively, **OBL has 423 distinct clubs**, not 645.

**Retraction 2 — the "521-club registry" was doubly wrong.** It was produced with a fuzzy token matcher at a 0.75 threshold that **falsely merged genuinely different clubs** — DC Storm with Sudbury Storm, CW Celtics with Hamilton Celtics, EY Eagles with Golden Eagles. And it was never a count of Ontario clubs in the first place; it only ever covered clubs appearing in the eight enumerable league systems.

#### The authoritative numbers

From `docs/research/consolidated/summary.json` (generated 2026-08-14, 3,928 input rows deduped to distinct orgs):

| Number | What it actually is |
|---|---|
| **1,516** | Distinct clubs, **all of Canada** — the census total (+353 in audit queue, +518 discoveries pending) |
| **621** | **Ontario clubs in the census** — the real Ontario number |
| **583** | Ontario clubs entering **≥1 league we can enumerate** (the subset with team data) |
| **423** | Distinct clubs in **OBL** |
| **1,784** | Total team entries across enumerable Ontario leagues |
| ~~645~~ | ❌ retracted — team-name variants, not clubs |
| ~~521~~ | ❌ retracted — bad fuzzy matching |

#### Corrected team-size distribution (583 clubs, 1,784 team entries)

Median **1** · mean **3.06** · max **30** (PDM Basketball: OBL 25 + NPH-SL 4 + NPH-D1 1).

| Total teams | Clubs | Share |
|---|---|---|
| 1 team | **312** | **53.5%** |
| 2–3 teams | 142 | 24.4% |
| 4–9 teams | 92 | 15.8% |
| 10–19 teams | 29 | 5.0% |
| 20+ teams | 8 | 1.4% |

Largest: PDM 30 · EY Eagles 25 · MUMBA 25 · Eurostep 24 · Brampton Warriors 23 · NT Huskies 22 · JCC Warriors 22 · Pelham Panthers 21.

Implied players at the censused 12.4/team: **~22,100 players ≈ ~19,900 Ontario families.**

#### 🚨 What 1,784 actually measures — and the pricing bug it exposes (owner challenge 2026-08-16)

Owner: *"How is it possible that 1,500 clubs have 1,700 teams? Are you combining age groups?"*

**No age groups are being combined.** OBL counts teams **per division** across 19 divisions (U9 Boys through U19 Women): U14 Boys 174 · U16 Boys 136 · U13 Boys 135 · U12 Boys 119 · U11 Boys 88 · U17 Boys 82 · U14 Girls 71 · U10 Boys 63 · U13 Girls 59 · U12 Girls 49 · U16 Girls 47 · U19 Men 47 · U19 Women 37 · U11 Girls 32 · U15 Boys 29 · U15 Girls 29 · U17 Girls 26 · U10 Girls 18 · U9 Boys 15 = **1,256**. A club with a U12 Boys and a U14 Boys team counts as two. PDM's 25 entries span 12 divisions, i.e. multiple teams in some divisions.

**And the base was being confused.** 1,516 is the **Canada-wide** club count. The Ontario arithmetic is **583 clubs → 1,784 teams = mean 3.1 teams per club.** Not 1,516 → 1,784.

**Independent sanity check — the OBL figure is sound.** 1,256 teams × 12.4 players = **15,574 athletes**, against OBA's own published claim of **~16,000 athletes in sanctioned rep play**. A 3% match on an independently-sourced number.

**But the owner's instinct is right in a bigger way: 1,784 is a severe undercount of total Ontario teams.** It counts only eight competitive systems. Excluded entirely:

| Excluded Ontario league | Clubs affected |
|---|---|
| CYBL (Canadian Youth Basketball League) | 61 |
| Phoenix League | 49 |
| Hoop City Spring · Summer League 2026 | 32 each |
| Jr. NBA · Jr. WNBA Canada · Jr. NBA Canada | 31 · 31 · 29 |
| JUEL · JUEL Prep | 18 · 10 |
| Toronto Big League (Jr Rep / Sr Rep / Sr Prep) | 12 · 10 · 9 |
| ORBL | 12 |
| AAU | 8 |
| **House league — every team, everywhere** | **87 clubs typed house-league / community / YMCA / parish / municipal** |

**House league is the big hole.** A community association running 40 house-league teams and entering 3 rep teams into OBL appears in this dataset as a **3-team club**.

#### ⚠️ The pricing bug this exposes

**"53.5% of clubs have exactly one team" is an artifact of counting only rep entries.** Under the proposed *"1 team free"* gate, a community association with **1 OBL team and 35 house-league teams pays nothing** — while being among the heaviest users of the platform (registration, scheduling, payments, comms, waivers for 400+ families).

**Therefore, if we gate on team count, it must count ALL teams the club operates on our platform — house league included — not league entries.** Gating on league entries hands the free tier to exactly the largest operators. This is a hard requirement on whatever billing logic ships.

It also means the club-revenue estimates ($75k–81k Ontario) are a **floor, not a ceiling** — they price only the rep sliver of each club. The true billable team count per community association is multiples higher, which strengthens the case for a per-team component and weakens pure league-gating.

**Next dataset to build:** house-league team counts for the 87 community/house-league Ontario clubs. Until that exists, every club-revenue figure in this document understates community associations.

**Still-standing caveat:** counts only the eight enumerable systems, excludes house league entirely. Consistent with the census estimate of ~2,000+ Ontario rep team-seasons and OBA's ~16,000 athletes.

**Reconciling two multi-league numbers:** the registry shows **14.9%** of clubs in 2+ *enumerable* systems; the consolidated CSV shows **67.1%** in 2+ leagues. Both are right — the CSV counts all 44 league labels including those we cannot enumerate. **Use 67.1%**, it is the more complete measure.

#### ⚠️ CORRECTION to the 2026-08-15 claim

I previously wrote that league-gating earns "2.5× the per-team model." **That was computed against understated team counts** (single-system entries) and does not survive the corrected data. Re-run against real totals:

| Model (founding rates, Ontario, corrected base n=583) | Revenue | Payers | Avg/club |
|---|---|---|---|
| **Per-team** $5/team/mo, 1 team free, cap $49/mo | **$74,856** | 271 (46%) | $128 |
| **⭐ Hybrid** — league gate + size tier ($180 base, $468 for 10+ teams) | **$81,036** | 391 (67%) | **$139** |

**Per-team is not worse than league-gating — it is slightly better.** The hybrid is best of the three, and it is also the fairest story. My earlier ranking was wrong because the input was wrong.

Scaled across all ~1,178 Canadian clubs at the same mix: **≈$172,000/yr founding, ≈$333,000/yr at list.**

#### 🚨 The conclusion that actually matters

**Club revenue is small under every structure tested — $63k to $148k across all of Ontario, or $121–285 per club per year.** No pricing cleverness changes that, because Ontario clubs are small: half of them have one team.

Set against the family side: 1,795 teams × 12.4 players ≈ **22,300 players ≈ 20,000 Ontario families.** At 8% conversion and $75 blended, that is **≈$120,000/yr from Ontario families alone** — comparable to the entire club business, from one province, with far more upside (12% conversion ≈ $180,000).

**This is the strongest quantitative support yet for the original thesis: clubs and leagues are the distribution channel, families are the business.** It also means the owner's instinct — *"I don't mind giving this to clubs and leagues for free as long as I can charge the parents"* — is financially defensible. Charging clubs is worth doing for commitment and signal, not for the revenue.

#### The earlier finding (retained — data now superseded)

**Ontario clubs are small in team count.** From 215 Ontario clubs with verified counts: **median 2 teams, mean 2.6, range 1–18.** 98 of 215 have exactly one team. And in the OBL data specifically, **462 of 645 club stems (71.6%) have exactly one team entry.**

Modelling the owner's per-team proposal against those real counts:

| Model | Annual revenue across 215 Ontario clubs | Avg/club | Paying |
|---|---|---|---|
| Founding $5/team/mo, 1 team free, cap $49/mo | **$26,328** | **$122** | 117 (54%) |
| List $10/team/mo, 1 team free, cap $99/mo | $52,728 | $245 | 117 (54%) |

**$122 per club per year is not a business.** My earlier $290–590/club estimates assumed club sizes we do not actually have in Ontario.

🚨 **Important caveat on the data:** these counts are *entries in one system* (e.g. "Coalition Summer 2025 = 18"), not total club size. **We do not have reliable total-team counts for Ontario clubs** — that is a genuine gap and it should be filled before pricing is locked. But the direction is not in doubt: Ontario clubs are team-poor and league-rich.

#### The pricing unit should be LEAGUES, not teams

The owner's instinct — *"clubs should pay up if they play in multiple leagues"* — is correct, and the data says it should be the primary gate rather than a surcharge.

| Gate | Free share | Converting share |
|---|---|---|
| 1 **team** free | 46% free (98/215) | 54% |
| **1 league free** | **32.9% free (176/535)** | **67.1%** |

Gating on leagues converts two-thirds instead of half, and it charges for **exactly the thing we uniquely provide**: one roster submitted to many leagues and tournaments, instead of 3.01 separate portals.

**Recommended structure:**

| Tier | Who | List | Founding (50%, to 2027-28) |
|---|---|---|---|
| **Free** | 1 team **or** 1 league — house-league orgs and single-entry clubs | **$0** | **$0** |
| **Club** | 2+ leagues: unlimited teams, unlimited league entries, unlimited tournament submissions | **$29/mo** | **$15/mo ($180/yr)** |
| **Association** | 10+ teams: adds multi-admin, audit log, advanced analytics, custom domain | **$79/mo** | **$39/mo ($468/yr)** |

Ontario at scale: **359 multi-league clubs × $180/yr founding ≈ $64,600/yr**, or ≈ $125,000/yr at list. Against the per-team model's $26,328, that is **2.5× the revenue from a fairer story**.

**Why this is also the better pitch.** Per-team pricing says "we charge you for existing." League-gated pricing says **"your first league is free forever; you pay when we start saving you real work."** A club entering 3 leagues plus 4 tournaments runs **7 separate submission processes** a season — different portals, deadlines, roster formats, fee schedules. At $180/yr that is roughly $26 per submission surface eliminated, against a volunteer's time we know they do not have.

**And do not meter league entries.** Charging per league would penalise the exact behaviour that makes us sticky, and it is the one capability no competitor has at all. Make it unlimited and loud: **one roster, submit anywhere, no extra charge.**

### ⭐ Club pricing — the owner's per-team model (2026-08-15, superseded by the league-gated model above)

Owner: *"free for one team; $10/month per team at two; maybe cap it; and I want to show 50% off."* That instinct is right and the unit is better than annual tiers, because **per-team scales with the value a club receives and a club can do the arithmetic in their head.** Two adjustments needed.

**Adjustment 1 — the cap is not optional, it is load-bearing.** At $10/team/mo uncapped: 10 teams = $1,200/yr, 25 teams = $3,000/yr, 40 teams = $4,800/yr. Against the census, clubs currently spend **$0–2,000/yr** on software, and RAMP is **free** for OBA-affiliated clubs. Uncapped pricing puts us far above the market exactly where the biggest clubs are.

**Adjustment 2 — make the 50% a real founding rate with an end date, not permanent theatre.** A standing "50% off" against a price nobody ever pays is both unpersuasive and legally exposed: Canada's Competition Act ordinary-selling-price rules require that an advertised regular price was actually charged in substantial volume, or offered in good faith for a substantial period. **A time-bounded founding-club rate is clean; a permanent fake discount is not.**

**The proposal:**

| Teams | List | **Founding rate (50%, through the 2027-28 season)** | Annual equivalent |
|---|---|---|---|
| **1 team** | **$0** | **$0** | Free forever, never expires |
| 2–9 teams | $10/team/mo | **$5/team/mo** | 5 teams = $300/yr |
| **10+ teams** | **capped $99/mo** | **capped $49/mo** | **$588/yr, and it never goes higher** |

At the founding rate: 2 teams $120/yr · 5 teams $300/yr · 10+ teams $588/yr flat. That sits **under RAMP's US$500 floor** and inside the $0–2,000 band the census shows clubs already pay, while the cap removes the "you punish us for growing" objection permanently.

**Why charge at all** (the owner's own reasoning, and it holds): a club that pays $588/yr has decided we are worth something, which makes them answer the phone, show up to onboarding, and complain when something breaks — all of which we need. Free users churn silently. And the alternative to us is hiring or burning out a volunteer.

**Keep the volume offset** (§ below): Pro is free in any season the club runs $50k+ of registrations through us. That converts the fee into a payments-adoption incentive.

### Team-count tiering (superseded by the per-team model above; retained for reference)

Bands set against how Canadian youth basketball clubs actually cluster, and priced *under* the incumbent's realistic total cost.

| Tier | Teams | Monthly | Annual | Who this is |
|---|---|---|---|---|
| **Free** | Unlimited | $0 | $0 | Everyone, forever. Full operations. |
| **Community** | 4–10 | $29 | **$290** | Single-site clubs, house leagues |
| **Club** | 11–25 | $59 | **$590** | Typical rep club |
| **Elite** | 26–60 | $119 | **$1,190** | Large rep programs |
| **Association** | 60+ | custom | ~$1,500–3,000 | Multi-site associations, school boards |

Notes:
- Tiers gate **Pro capabilities**, not team count. A 40-team club can stay free forever with full operations; it pays only when it wants a custom domain, sponsorship tools, or branded media.
- Team count sets the *price* of Pro, not the *right* to operate.
- **Founding-year free** (carried from v2) with visible "Pro" labels from day one, and grandfathering on **price** (e.g. 50% for life), never "free forever."

### Volume offset — the anti-quadruple-dip mechanism

The real risk: a club sees a subscription **and** a 1.5% payment fee **and** us monetizing their content **and** us upselling their parents, and concludes we are farming them. Fix it structurally:

> **Pro is free for any season in which the club runs ≥ $50,000 of registration volume through the platform.**

This removes the software line item from the club's budget conversation entirely, makes the payment rail extremely sticky, and converts "you charge me twice" into "the plan pays for itself." Most mid-size rep clubs clear $50k easily; the ones that don't are small enough that $290/yr is real money to us either way.

Second lever: **sponsorship revenue credits against the Pro fee** before it credits as cash. A club that sells one $500 local sponsor has effectively paid for Club tier.

### The strategic fork worth deciding consciously

| | Charge clubs (recommended) | Free for clubs forever (GameChanger play) |
|---|---|---|
| Revenue/club/yr | ~$1,955 | ~$1,365 |
| Club acquisition friction | Moderate | Near zero |
| Content volume | Good | Maximum |
| Defensibility | Contractual | Habit + archive |

**Recommendation: free through the founding year and the first full season, then introduce Pro.** Once a club has three seasons of history, rosters, media and parents on us, switching cost is enormous and Pro converts on value rather than coercion. Charging early kills the flywheel before it spins.

---

## 5. Should we charge the referees?

**Recommendation: no. Charging referees is strategically backwards — but the referee rail is still a revenue line.**

Officials in Ontario youth basketball make roughly $25–60 per game. Every league in the province is short officials. Taking a percentage off a $35 game fee will be felt, resented, and talked about in the officials' association group chat within a week. Referees are supply-side, exactly like leagues.

### The design: the payer pays

- **Referee pays nothing.** Ever. They get: assignment management, availability, same-week payment instead of a cheque in April, mileage tracking, and a year-end earnings summary they can hand to their accountant.
- **The league or club pays the platform fee on the payout** — a small flat amount (~$0.50–1.00 per payout) or ~1% capped. It sits inside the officials budget the league already runs, and it displaces the HorizonWebRef/Assignr subscription they're paying today. Net, the league's officiating admin cost goes *down*.
- **Ref Pro, an optional personal subscription (~$29/yr)**: consolidated multi-league schedule in one calendar, tax-ready earnings reports, certification/renewal tracking, availability sync, season-wrap card. Small revenue, disproportionate goodwill — and referees work across many leagues, so they become the people who tell four leagues about us.

**Why this matters more than the money:** whoever solves referee payment owns a relationship with the one group that touches every league in the province. That's a distribution asset, not a revenue line. Price it accordingly.

Wired against the existing gap in [[referee-payouts]] — fee is display-only today, no payout rail exists yet.

---

## 6. The family tiers — the actual business

### The principle

> **The network is free. The capabilities are metered.**

Following, feed, schedules, RSVP, chat, scores, safety — free forever, for everyone, no exceptions. What's metered is the *emotional artifact*: the clean photo, the highlight, the reel, the archive, the keepsake.

### Tier structure

| | **Free** | **Plus** | **Premium** |
|---|---|---|---|
| **Price** | $0 | **$7.99/mo · $59.99/yr** | **$14.99/mo · $119.99/yr** |
| Feed, follows, chat, schedules, RSVP | ✅ | ✅ | ✅ |
| Live scores, standings, box scores | ✅ | ✅ | ✅ |
| Safety, waivers, medical, consents | ✅ | ✅ | ✅ |
| Daily digest card | ✅ | ✅ | ✅ |
| Predictions, POTG voting, points, badges | ✅ | ✅ | ✅ |
| Share cards | Watermarked, basic | Premium templates, watermark-free | ✅ |
| Photo/clip downloads | Low-res, watermarked | **Full-res, clean** | ✅ |
| Moments archive | Last 30 days | **Full history** | ✅ |
| Extended stat history + splits | Season only | **Career** | ✅ |
| Game video / VOD replay | — | — | ✅ |
| Season highlight reel | — | — | ✅ |
| Mixtape editor | — | — | ✅ |
| Per-player auto-clips | — | — | ✅ |

Benchmarked directly against GameChanger ($39.99 / $99.99 / $179.99 annual) — we sit slightly above their Plus and below their family plan, with materially broader scope (they are baseball/softball-first for video).

### Lead with annual, not monthly

GameChanger's volume driver is the annual price. $59.99/yr reads as $5/mo and retains far better than a monthly plan a parent cancels in April when the season ends — which is the single biggest churn risk in a seasonal category. **Default the paywall to annual, offer monthly as the secondary option.**

### Family plan

A **$179.99/yr Family** covering up to 4 children / 2 guardian households. Multi-child families are our best customers and currently our worst-served — a parent with three kids in the program should not be asked for three subscriptions.

### Conversion expectations — be honest with ourselves

Consumer freemium converts at a median ~2.1% (RevenueCat 2026), 2–5% typical. We should convert *far* better than generic freemium because the trigger is a photograph of your own child, but plan conservatively:

- **Plan at 8%. Be pleased at 12%. Be worried below 5%.**
- The lever is not price, it is **trigger moments**. Rank-ordered by expected conversion:
  1. "Your kid was Player of the Game" → the card is watermarked → clean version costs $7.99
  2. Great photo from the weekend shooter appears, low-res → full-res is Plus
  3. Season-end → the reel exists, but it's Premium
  4. Free month ends mid-season, mid-habit
- **Every new family gets one free month of full Premium** (carried from v2). Start it at *registration*, not signup, so it overlaps the season's emotional peak.

---

## 6b. Exposure Pass — the highest-ARPU idea, omitted from the first draft

Carried from [[business-model]] Engine C, and it belongs here because it is the one family product that ties directly to the exposure-event world NPH lives in.

**EXPOSURE PASS, ~$149/yr:** verified player page, film room, recruiter visibility, creator highlights, showcase/combine history.

Why the number works: **NCSA's reported price is $1,500–$6,000+** with widespread cancellation complaints, and SportsRecruits Pro is $399/yr. At $149 we are villain-priced against NCSA while offering something neither has — a profile backed by *verified game data we actually hold*, not self-reported claims. NCSA and SportsRecruits sell hope; we can sell a box score.

Distribution follows the SportsRecruits lesson: **club-bundled below retail**, not sold direct to parents. The club adds it to fees through the obligation engine, which is also how [[business-model]] proposes selling Family Pass at $49/yr wholesale.

Context that makes this a real market rather than a hopeful one: one-day basketball showcases already charge families **$100–$300** for exposure, and event organizers already resell game film and highlights on top. Families in this segment are demonstrably willing to pay for exposure. The Exposure Pass converts a recurring purchase they already make into a subscription attached to a profile we own.

⚠️ Sequencing: this depends on `/p/handle` public player pages (white space #1 in §3c) and on the media-consent work in §7. It is a season-2/3 product, not a launch product — but it should shape the player-profile build now.

---

## 6c. THE COMPLETE PAYWALL SHEET — one table, every audience

What is free, what is paid, and what the upgrade trigger is. This is the answer to "what's the basic package and where do I upsell."

### The governing rules

1. **Never gate anything that reduces content on the platform.** Content is what family revenue is made of.
2. **Never gate safety.** Waivers, medical, concussion, background checks, incident reporting.
3. **Never gate the referee.** They are supply, and they carry us to other leagues.
4. **Gate the artifact, not the information.** A parent always sees that their kid scored 22. What costs money is the clean card, the full-res photo, the clip, the reel, the archive.

### The sheet

| Audience | **FREE forever** | **PAID** | Price | The upgrade trigger |
|---|---|---|---|---|
| **Player / kid** | Everything. Profile, stats, handle, feed, chat, their own game log | — | $0 | *Never charge a kid* |
| **Parent / family** | Feed, follows, chat, schedules, RSVP, live scores, standings, box scores, safety, daily digest, predictions, POTG voting, points, watermarked basic share cards | **Plus:** premium card templates, watermark-free + full-res photo/clip downloads, full Moments archive, career stat history, priority in POTG galleries | **$7.99/mo · $59.99/yr** | "Your kid was Player of the Game" → card is watermarked → clean version costs $7.99 |
| | | **Premium:** everything in Plus + game VOD replay, season highlight reel, mixtape editor, per-player auto-clips | **$14.99/mo · $119.99/yr** | Season ends → the reel exists → it's Premium |
| | | **Family:** up to 4 kids, 2 guardian households | **$179.99/yr** | Second child registers |
| | | **Exposure Pass** (Y2/Y3): verified player page, film room, recruiter visibility, showcase history | **~$149/yr** | Gr 10 → recruiting anxiety starts |
| **Club** | Unlimited teams/players/staff/seasons · registration + payments · scheduling, RSVP, attendance, practices · **live scoring + full stats** · messaging, announcements, polls · club page, rosters, standings · photo/video upload + feed posting · waivers, consents, medical, background checks · basic accounting · offline payment recording | **Pro:** custom domain + site builder + SEO · club-branded media coverage + full-res reuse rights · sponsorship module · accounting exports, aging, dunning, financial aid, installments · advanced analytics · tryouts/evaluations at scale · tournament + camp hosting · multi-admin seats, roles, audit log · priority support + migration | **$290 / $590 / $1,190/yr** by team band · **waived at $50k volume** | Board asks "why does our site look like this" · or the club wants the weekend shoot branded to them |
| **League** | Season 1 free as design partner (full LEAGUE MEDIA) | **Core:** scheduling, registration, rosters, standings, referee booking, live scoring console, live pages, app presence | **$19/team/season** | End of design-partner season |
| | | **Media:** + AI recaps, league news hub, covered posts, branded hub, sponsor slots | **$39/team/season** *(cap at ~1% of their own team fee)* | They want the content layer, which is the only reason they came |
| **Referee** | **Everything.** Assignments, availability, self-serve booking, digital sign-off, same-week payment, mileage, year-end earnings summary | **Ref Pro:** consolidated multi-league calendar, tax-ready reports, certification/renewal tracking, season-wrap card | **~$29/yr** | Second league on their schedule |
| **Sponsor / advertiser** | — | Club-sold local sponsor cards (club keeps majority) → later self-serve geo/interest slots | rev-share / CPM | After DAU proves the audience |

### Where the money actually comes from, ranked

1. **Families** — the only line with real upside and the only one nobody else in Canada is properly serving. Everything else exists to feed it.
2. **Payments** — but **e-transfer only** (§3e). We lose on cards.
3. **Club Pro** — real but capped by TeamLinkt's free core; expect low attach below 10 teams.
4. **League fees** — small by design, and at OBL scale deliberately near zero.
5. **Referee Pro / sponsorship** — rounding errors that buy distribution and goodwill.

### The competitive floors to price against

| Our tier | Who we're actually priced against | Their number |
|---|---|---|
| Plus $7.99/mo | **TeamLinkt Plus** | **CA$4.99/mo** |
| Plus $59.99/yr | **SWISH GOLD by NBN23** — a price point that exists in basketball; **no evidence of NPH uptake**, and NPH's own portal gives box scores away free | **$29.99/yr** |
| Plus / Premium annual | GameChanger | $39.99 / $99.99/yr |
| Premium $14.99/mo | BallerTV · Black Bear TV | $25–30/mo |
| Exposure Pass $149/yr | SportsRecruits Pro · NCSA | $399/yr · reported $1,500–6,000 |
| Club Pro $290–1,190/yr | RAMP software floor · TeamLinkt bundles | ~$680+ · $0–795 |
| League $19–39/team | Exposure Events | $2/team/event |

⚠️ **Two of these are uncomfortable and need a decision.** TeamLinkt Plus at $4.99 and SWISH GOLD at $29.99/yr both undercut our proposed Plus, and SWISH is *already on the phones of the exact families at our number-one target league*. Either we hold price and win on depth — full-res media, reels, archive, and a profile that follows the kid — or we meet them. That is decision 14.

---

## 7. Content rights — the honest version

This is the section the owner is most worried about, so it needs the clearest thinking.

### The good news: we are asking for less than the industry standard, in public

The owner's fear is that leagues will discover we intend to monetize content and revolt. The research says the opposite is likely: **this is already the open, published norm in the category.**

SportsEngine Play's public Terms of Use says, verbatim:

> "You hereby grant to SportsEngine the right to monetize the Content and any User-Generated Content (and such monetization may include selling or using commercial elements (e.g., pre-roll, mid-roll, post-roll, banner ads and dynamic advertising) on or within such Content or charging users a fee for access). SportsEngine shall retain any and all revenue from the sale or use of such commercial elements. **This Agreement does not entitle you to any payments.**"

Sideline HD goes further: content "becomes property of Diamond Kinetics." TeamSnap, GameChanger, Hudl and Veo all take broad distribution licences.

**Conclusion: we do not need to hide this. We need to normalize it.** A clause that matches what every competitor publishes is unremarkable. A clause that a league later discovers we tried to obscure is the thing that gets us banned.

### The one place I'd push back

Deliberately obscuring a material commercial term is the wrong instrument for the owner's goal, for two practical reasons rather than moral ones:

1. **Concealment makes the right weaker, not stronger.** Canadian courts read down onerous or unusual terms in standard-form contracts that weren't brought to the other side's attention (*Tilden Rent-A-Car v Clendenning*, and the consumer-protection regimes in Ontario and Quebec). A monetization right a league can plausibly say was buried is a *less* enforceable right than one on a plainly-worded page they clicked through.
2. **The discovered concealment causes the exact outcome we're insuring against.** Youth basketball in Ontario is a village of a few hundred people who all know each other. A commercial league that finds a hidden clause doesn't renegotiate — it leaves, loudly, and takes its peers with it.

**There is a real and legitimate distinction here, and it's the one to operate on:** not advertising that a term is negotiable is normal commercial practice and completely fine. Actively obscuring a material term is not. So — plain clause, standard placement, no hint of flexibility, no apology. Everything below is drafted that way.

### Use a licence, not an assignment

The owner's phrasing — "every piece of content uploaded belongs to the platform" — describes an **assignment**. That's the wrong instrument in Canada:

- **Copyright Act s.13(4):** no assignment or grant is valid unless it is *in writing signed by the owner*. A clickwrap checkbox is a contestable signature, and Canadian courts have been strict about the statutory writing requirement.
- **Minors can repudiate contracts.** A large share of our uploaders are children. Assignments from them are fragile in a way licences from their guardians are not.
- **Ownership imports liability.** If we *own* the content, we own its defamation, privacy and infringement exposure, and we surrender the "we are a host" posture that protects platforms.

**A perpetual, irrevocable, worldwide, royalty-free, fully paid-up, sublicensable and transferable licence gives us 100% of the commercial capability of ownership, with none of the fragility and much less of the liability.** It is also what every major competitor uses. Ask for the licence; don't ask to own it.

### Draft clause — platform Terms of Service (replaces §7 "Your content")

> **7. Your content**
>
> You keep ownership of what you post. By posting, uploading, or submitting content to the platform (including photos, video, audio, commentary, statistics, and profile information), you grant us a perpetual, irrevocable, worldwide, non-exclusive, royalty-free, fully paid-up, transferable and sublicensable licence to host, store, reproduce, adapt, edit, translate, create derivative works from, publish, publicly perform and display, distribute and otherwise use that content, in any media now known or later developed, for the purposes of operating, promoting and commercialising the platform and its services.
>
> **7.1 Commercialisation.** That licence includes the right to commercialise the content, including by displaying advertising or sponsorship alongside or within it, including it in paid or subscription features, and licensing it to third parties. We retain all revenue arising from that commercialisation. Posting content does not entitle you or any organisation to any payment or revenue share.
>
> **7.2 Name, image and likeness.** You grant us the same licence to use the name, image, likeness, voice, jersey number, statistics and performance information of any person appearing in content you post, to the extent you have the right to grant it. Where the person is a minor, only that child's parent or guardian may grant this, and they may do so or withhold it through the media-consent settings in their account.
>
> **7.3 Moral rights.** To the extent permitted by law, you waive your moral rights in content you post in favour of us and anyone we license it to.
>
> **7.4 Your own use.** You may continue to use anything you post however you like. Nothing here restricts your own rights in your own content.
>
> **7.5 Removal.** You may delete your content at any time and we will remove it from public surfaces promptly. Copies may remain in backups for a limited period, and content already incorporated into a compilation, highlight, broadcast or published work before deletion may remain in that work.

Clause 7.4 is the pressure valve and costs us nothing — a **non-exclusive** licence means the league and the club keep every right they had. Most of the objection evaporates the moment they realise we haven't taken anything away from them.

### Draft clause — League Partner Agreement

> **Content and coverage.** The League grants the Platform a perpetual, irrevocable, worldwide, non-exclusive, royalty-free, fully paid-up, transferable and sublicensable licence to capture, host, reproduce, adapt, publish, distribute, broadcast and commercialise: (a) all content submitted to the Platform by the League, its member clubs, teams, staff and participants; (b) game data, scores, statistics, standings and schedules relating to League competition; and (c) audio-visual and photographic coverage of League competition created by or for the Platform.
>
> The Platform retains all revenue arising from that commercialisation. The League is granted, at no charge, a perpetual worldwide licence to use all such content and coverage for its own promotional, archival and non-commercial purposes.
>
> **Survival.** The licences in this section survive expiry or termination of this Agreement in respect of all content and coverage created or submitted before that date.
>
> **Control.** The League may require removal of any specific item of content from public Platform surfaces on reasonable grounds, including safeguarding, privacy, accuracy or reputational concerns, by written notice.

**The survival clause is the single most commercially important sentence in the agreement.** If a league leaves in year three, the archive stays ours.

### The three structural protections worth more than any clause

1. **Build the business on content we author, not content they upload.** Nearly all of the monetizable content is *ours by authorship, with no licence needed from anyone*: score cards, POTG cards, milestone cards, standings graphics, previews, AI recaps, and — critically — everything our hired weekend shooter captures. The licence over their uploads is a backstop, not the engine. **This dissolves most of the risk.** A league cannot claim a share of content it did not create.
2. **Facts are not copyrightable.** Scores, standings, statistics, schedules and results are facts. No league owns them, and Canada has no sui-generis database right (*Tele-Direct*, *CCH*). A very large share of the content engine is rights-free by nature.
3. **Make the league a beneficiary, not a claimant.** Give leagues a sponsorship revenue share on league-branded surfaces where **they keep the majority**. When they eventually ask "what are you making off us," the answer is a cheque we already sent them. This converts the adversary into a partner and is worth more than any amount of drafting.

### The real legal exposure is minors, not leagues

The thing that can actually shut the content business down is not a league — it is a parent, a privacy commissioner, or a Quebec plaintiff.

- **Quebec** is the strict jurisdiction: Civil Code art. 36 plus *Aubry v Éditions Vice-Versa* (SCC, 1998) — publishing an identifiable person's image without consent is a fault in itself, and commercial use is the aggravating factor. The plaintiff in *Aubry* was 17. Quebec's Law 25 adds explicit-consent requirements and default-off profiling for under-14s.
- **Ontario/common law:** tort of appropriation of personality covers commercial use of likeness.
- **PIPEDA:** an identifiable image is personal information; commercial use requires meaningful consent, and for children that consent comes from the guardian (OPC treats under-13 as guardian-only).

**Required before any commercial content surface goes live:**
- Granular per-child media consent captured at registration, with real levels: *no media* / *team-internal only* / *club promotional* / *public platform and commercial*.
- Consent state enforced at render time on every surface, not just at upload.
- Guardian can revoke at any time, and revocation propagates.
- Quebec families default to the most restrictive level until explicit consent.
- No child's likeness in a paid advertisement or third-party licence without explicit commercial-level consent.

This is a **P0 gate**, ahead of monetization. It is also a genuine marketing asset — "we ask permission for every child, every level, and you can change it any time" is a claim no competitor makes.

---

## 8. Media coverage — the videographer as a product

The owner's idea (hire a videographer/photographer per weekend; make club tagging an upsell) is one of the strongest in this document. It deserves to be a named product line.

**Why it's strong:** our shooter's work is **our copyright outright**. No league licence, no parent upload, no rights ambiguity — the cleanest content we can possibly own, and the highest-quality content on the platform.

⚠️ **One hard requirement:** in Canada, an independent contractor owns the copyright in their own work unless it is assigned in writing and signed (s.13(3) makes the *employer* first owner for employees only). **Every shooter contract must contain a signed assignment of copyright plus a moral-rights waiver.** A handshake and an invoice leaves the copyright with the photographer. This is the single most common and most expensive mistake in this model.

### How it monetizes across all three audiences

| Audience | Free | Paid |
|---|---|---|
| **Platform** | — | Owns the archive outright; fuels feed, reels, sponsorship inventory |
| **Family** | Sees the photos, low-res, watermarked | **Plus/Premium**: full-res, clean, downloadable, in the reel |
| **Club** | Coverage appears on the platform, tagged to the game and players | **Pro**: coverage branded to the club, on the club's own feed, full-res assets, and the right to reuse in the club's website, ads and social |
| **Club (à la carte)** | — | **Book a shooter** for a tournament, tryout weekend or media day: $300–600/day |

The club upsell is clean precisely because it grants a genuine incremental right — reuse and branding — rather than holding anything hostage. The coverage exists either way; paying changes whose logo is on it and what the club may do with it.

### It also solves the cold-start problem

One shooter working a busy gym on a Saturday generates a weekend of feed content for six to eight clubs at once. That is the cheapest content-density lever available before scoring volume exists.

### Club media staff

Keep letting club media staff post — it is free content and free goodwill. Their content is club-branded and sits under the same §7 licence. Our shooter's work is the premium layer above it, not a replacement for it.

---

## 9. Payments — three rails, and the regulatory gate

### The rails

| Rail | Fee | Notes |
|---|---|---|
| **Offline** (cash, cheque, manual e-transfer) | **$0, forever** | Recorded, never guaranteed by us. Already covered in ToS §6. |
| **Interac e-Transfer (ours)** | **1.5%, capped at $9.95** | Cheapest automated option in the market |
| **Card (Stripe)** | Passthrough + 0.5% | For the families who want it |

**Sanity check on 1.5%:** LeagueApps charges 2.5–5.9% per registration; Spond 2.99% + fixed; cards 2.9% + 30¢ everywhere. At a $250 registration we earn $3.75 against an aggregator cost of roughly $0.50–1.50 — **~70–85% gross margin**, while being less than half the price of the nearest automated alternative. The number is right.

**Add the cap.** At 1.5% uncapped, a $2,000 elite program fee costs $30 and the club will notice and complain. A $9.95 cap barely costs us (it only binds above ~$663, and most fees are installment-split below that) and converts the objection into a marketing line: *"never more than $9.95 on any payment."*

**Add the fee-shift toggle — this is required, not optional.** The club chooses whether the family or the club absorbs the fee. TeamLinkt and Spond both do it and clubs expect it. Most clubs will pass it through, which makes our fee *free to the club* and removes the entire pricing objection from the sales conversation.

### ⚠️ Regulatory gate — the Retail Payment Activities Act

This is newer and more directly applicable than the FINTRAC/MSB question flagged in v2, and it is a genuine launch blocker.

The **RPAA** is now in force. Payment service providers performing any of the five defined payment functions must **register with the Bank of Canada before performing retail payment activities**, and since **8 September 2025** must maintain risk-management and **end-user funds-safeguarding** frameworks. First annual reports were due 31 March 2026.

Taking a percentage of a payment flow and instructing payouts plausibly puts us in scope. Two mitigations to confirm with counsel *before* the rail launches:
1. **Structure so the aggregator is the registered PSP of record** and holds funds in trust — we instruct, never custody. (This also preserves the FINTRAC/MSB avoidance already noted in v2 §8.)
2. **The "incidental" test** — a payment function that is incidental to a non-payment business may fall out of scope. Our position is that payments are incidental to club management software. That argument needs a lawyer's sign-off, not ours.

**Action: this question goes to counsel in the same conversation as the aggregator pricing calls, not after.**

### On the tax-reporting motive

Some clubs collect e-transfers manually in part to keep money off the books. We should not design for that. Our rail's honest pitch is the opposite: clean books, CRA-ready records, one statement, real receipts — which for a registered non-profit is a benefit. The clubs that want opacity won't adopt the rail, and that's fine: keep offline payments free and unrecorded-by-us (the ToS already disclaims them), and win the clubs that want clean books. **Their money is also the most reliable money on the platform.** Chasing the shadow-economy clubs buys low-quality revenue and real liability.

---

## 10. The league political strategy

The owner's fear — commercially-minded leagues turning on us once they sense the content is valuable — is legitimate and worth managing deliberately.

### Seven moves

1. **Language.** Never say "media rights." Say **coverage**. "We cover your league" invites partnership; "we hold rights to your league" invites a lawyer.
2. **Never publish per-league economics.** No public engagement-by-league leaderboard, no revenue disclosure, nothing that lets a league infer what it's worth to us.
3. **Lead with a visible free win they'd otherwise pay for** — officials assigning and settlements displaces a real HorizonWebRef/Assignr line item. Quantify it in the agreement so the value is on paper.
4. **Take non-exclusive rights, always.** Asking for exclusivity is the single loudest signal that the content is valuable. Non-exclusive is both safer and less alarming, and we lose nothing — we're not reselling to a broadcaster.
5. **Make them a beneficiary early.** Sponsorship revenue share on league-branded surfaces, majority to the league, offered *before* they ask.
6. **Multi-year term, auto-renew, and the survival clause** (§7). Get the archive locked before the relationship is ever tested.
7. **Move first and set the norm.** If the first five to ten leagues sign the standard agreement, later leagues inherit it as "how this works" rather than negotiating it.

### Have the concession ladder ready before it's needed

A commercially sophisticated league **will** eventually ask for a share. Deciding the answer in advance means not panic-conceding in the room:

| Rung | Concession | When |
|---|---|---|
| 1 | No share. Point to the free platform value and the sponsorship share they already have. | Default |
| 2 | Increase their share of sponsorship revenue on league-branded surfaces. | Real pressure |
| 3 | Revenue share on **league-branded streaming/broadcast only** — a narrow, definable slice. | A league we cannot afford to lose |
| 4 | Walk. | A league demanding a share of family subscriptions |

Rung 4 matters: **never share family subscription revenue.** That is the business. A league that demands a cut of it doesn't understand what it's asking for, and conceding it once sets the precedent for every league after.

---

## 11. Unit economics — one 12-team club, one season

> **Read the family line carefully — it is per CLUB, not per family.** $720 is what one 12-team club's *entire parent body* is worth to us in a year. The per-family numbers inside it are $75/yr from a **paying** family, and $6/yr averaged across **all** families in the club including the 92% who never pay a cent.

| Line | Assumption | Revenue |
|---|---|---|
| **Families** | 120 families × 8% conversion = ~10 payers × $75 blended | **$720** |
| **Payments** | 132 registrations × $500 × 50% rail adoption × 1.5% | **$495** |
| **Club Pro** | Club tier (11–25 teams) | **$590** |
| **Sponsorship** | 1 local sponsor × $500 × 30% platform cut | **$150** |
| **Total** | | **≈ $1,955/club/yr** |

**Where each input comes from, and how soft it is:**

| Input | Value | Confidence | Basis |
|---|---|---|---|
| Families per 12-team club | 120 | **High** | 12 × 11 players = 132, minus sibling households |
| Conversion to paid | 8% | **Low — the whole model pivots on this** | Consumer freemium median is 2.1% (RevenueCat 2026); we assume ~4× that on the strength of the "photo of your own child" trigger. Untested. |
| Blended annual price | $75 | **Medium** | Mix of Plus $59.99 and Premium $119.99 annual, weighted toward Plus |
| Rail adoption | 50% | **Low** | No basis yet; depends entirely on the fee-shift toggle and club sentiment |
| Sponsor cut | $150 | **Low** | Illustrative; the sponsorship module is a documented gap (§3c) |

**Sensitivity on the one that matters.** Conversion is the load-bearing assumption, so it is worth seeing the range rather than the point estimate:

| Conversion | Families revenue/club/yr | Total/club/yr |
|---|---|---|
| 2% (generic freemium median) | $180 | $1,415 |
| 5% | $450 | $1,685 |
| **8% (plan)** | **$720** | **$1,955** |
| 12% | $1,080 | $2,315 |
| 20% (GameChanger-class) | $1,800 | $3,035 |

Even at the pessimistic 2%, the club is worth $1,415/yr — because payments and Pro carry it. **The family line is the upside, not the floor.** That is the actual argument for building it.

Cross-check against [[business-model]] §4, which sketched year 1 as 400 households × $79 ≈ $32K — a *household-count* framing rather than a per-club one. At 8% conversion, 400 paying households implies ~5,000 families ≈ **42 clubs**. The two models agree; they are just counted from different ends.

**Only 30% of that is the club subscription.** Two-thirds comes from families and payments — which is precisely why the club free tier can afford to be more generous than anyone else's.

### At scale (Canada census: 1,178 clubs, 188 Ontario clubs already imported)

| Clubs on platform | Annual revenue |
|---|---|
| 50 | ~$98,000 |
| 200 | ~$391,000 |
| 500 | ~$978,000 |
| 1,000 | ~$1,955,000 |

**And none of it requires charging a league a single dollar.**

---

## 12. Sequencing

| When | Business track | Product track |
|---|---|---|
| **Now** | Aggregator pricing calls (VoPay / Zum Rails / Payper) · counsel on RPAA scope · draft League Partner Agreement | ToS §7 rewrite · granular per-child media consent (P0 gate) |
| **Pre-launch** | Founding-club terms · first 5 league agreements at standard terms | Free tier complete · fee-shift toggle · consent enforcement at render |
| **Launch season** | Everything free · Pro labels visible, unpriced | Content engine · weekend shooter pilot (with signed assignment) |
| **Season 2** | Pro billing on · e-transfer rail live · Plus/Premium paywall on | Volume-offset billing logic · Premium video |
| **Season 3** | Referee payout rail · sponsorship marketplace · league sponsorship shares | Streaming |

---

## 13. Open decisions for the owner

1. **Club pricing fork** — introduce Pro in season 2 (recommended) or stay free for clubs indefinitely and go pure GameChanger?
2. **Team-count bands and price points** — are $290 / $590 / $1,190 / custom the right ladder for Canadian clubs?
3. **Volume offset** — approve "$50k volume waives Pro"? What threshold?
4. **The e-transfer cap** — approve 1.5% capped at $9.95?
5. **Content clause posture** — approve the licence-not-assignment approach and the plainly-worded §7 above?
6. **Concession ladder** — approve rungs 1–4, and confirm rung 4 (never share family subscription revenue) as permanent?
7. **Family pricing** — $7.99/$14.99 monthly with $59.99/$119.99 annual and a $179.99 family plan?
8. **Weekend shooter pilot** — approve one shooter, one weekend, as a content and conversion test?
9. ⚠️ **Reconcile the two pricing models.** [[business-model]] §2 has clubs at $249/$649 per season with a **bps ladder** (2.0% → 1.25% → 0.75%, subscription buys down the take — the Shopify pattern) and leagues at $19/$39 per team per season. This doc proposed $290/$590/$1,190 annual with a flat 1.5% capped. **The bps ladder is the better mechanism** — it makes big clubs upgrade on arithmetic alone. Which structure ships?
10. **Event/tournament depth + NCAA certification** — do we build it to displace Exposure Events at NPH, or do we approach NPH as a *complement* to Exposure and take the season-league, content and family layers only? This decides the NPH pitch shape and a large chunk of roadmap.
11. **Exposure Pass** — approve the ~$149/yr recruiting tier as a season-2/3 target, so the `/p/handle` player-profile build is designed for it now?
12. ⚠️ **Research the Ontario `Software` column** (§3d) — our beachhead is the one province where we don't know what clubs run. Approve a short enrichment pass over the 621 Ontario clubs before pricing locks?
13. ⚠️ **Card markup** (§3e) — RAMP is under 2% all-in and TeamLinkt 2.7% + $0.30, while we land at 3.4–4.9%. Drop the card markup to **passthrough + 0** and take margin only on e-transfer? That buys "we never mark up your card fees," which nobody else in Canada can say.
14. **Plus price vs TeamLinkt Plus** — they are at CA$4.99/mo. Hold $7.99 and argue on depth, or meet them?
15. 🔴 **Is the operator console a moat, or a cost of entry?** New finding, 2026-08-18 ([[us-league-targets-2026-08]] §1): **CYO Brooklyn-Queens, a volunteer-staffed Catholic diocese with no software budget, built its own 50-entity league management system** ("CYO Connect") on Base44, the AI app-builder Wix acquired in 2025 — registration, rosters, divisions, pools, officials assignment, invoicing, waivers, forfeits, discipline, **scenario scheduling with a draft→publish layer**, venue-slot booking, brackets and standings. That is a large share of our operator workspace, including pieces we treat as differentiating, reproduced in one season on a vibe-coding tool.
    **What it does not have:** zero hits for play-by-play, box score, player stats, live scoring, highlights or MVP; a `Game` carries one final score; its roles are admin/coach/official/parent/referee, with **no player and no follower**. Same terminal shape as Exposure, ARC and RAMP.
    **The decision:** if admin tooling is now buildable by anyone with an AI app builder, then registration/scheduling/invoicing is table stakes, not defensible, and every pricing and positioning choice above should rest on the **consumer and media layer** — player record, box score, recap, card, audience — rather than on operator depth. Does that change the club Pro value proposition (decisions 1–3) and the NPH pitch shape (decision 10)?

---

## Sources

Competitor pricing and terms verified 2026-08-15: [TeamLinkt pricing](https://teamlinkt.com/pricing) · [Spond transaction fees](https://help.spond.com/club/en/articles/58192-what-is-the-transaction-fee-in-spond-club) · [LeagueApps pricing](https://leagueapps.com/pricing/) · [SportsEngine on Capterra](https://www.capterra.com/p/134125/SportsEngine/) · [Jersey Watch](https://www.capterra.com/p/178257/Jersey-Watch/) · [TeamSnap pricing](https://www.teamsnap.com/pricing) · [GameChanger subscriptions](https://help.gc.com/hc/en-us/articles/28521445314957-Individual-Subscription-FAQs) · [SportsEngine Play Terms of Use](https://discover.sportsengineplay.com/terms-of-use/) · [Youth sports streaming rights landscape](https://www.buyingsandlot.com/p/everyone-is-talking-about-youth-sports-streaming-rights) · [Copyright Act s.13](https://laws-lois.justice.gc.ca/eng/acts/C-42/section-13.html) · [Aubry v Éditions Vice-Versa](https://www.canlii.org/en/ca/scc/doc/1998/1998canlii817/1998canlii817.html) · [Bank of Canada retail payments supervision](https://www.bankofcanada.ca/regulatory-oversight/retail-payments/) · [RevenueCat State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps)

⬅ [[business-model-v2]] · [[project_prelaunch_build_ledger]] · [[_dashboard|Roadmap dashboard]]
