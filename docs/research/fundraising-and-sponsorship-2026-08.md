---
updated: 2026-08-21
tags: [theme/research, theme/product, theme/monetization, type/analysis, status/first-pass]
---

# Fundraising and sponsorship: what exists, and the shape that fits us

Research at the owner's request, 2026-08-21. Nothing here is built or approved.

---

## 1. The market, and the number that matters

| Platform | Model | What they take |
|---|---|---|
| **[Snap! Raise](https://www.snapraise.com/)** | Email/text campaign, individual athlete pages | **~20% of funds raised** (no upfront fee) |
| **[99Pledges](https://99pledges.com/sports-team-fundraising/)** | A-thon style, per-participant pages | Platform free, **3.49% + $0.49** processing |
| **[TeamSnap](https://www.teamsnap.com/for-business/features/sponsorship)** | Sponsor matching with regional/national brands | Bundled into their subscription |

**Snap! Raise taking a fifth of the money is the whole opening.** A team that
raises $10,000 hands over $2,000. Our payments rail already runs at roughly
processor cost (business model v3 treats payments as a utility margin, not a
profit centre). Running a fundraiser at 2% + $0.30 instead of 20% is not a
feature improvement, it is a different category of offer.

**What teams actually raise**, from the same sources:

- Sponsor-a-player letters plus a local banner: **$3,000 to $20,000** for one
  team of 10 to 20 kids
- Title sponsorships: **$500 to $2,000+**; small local tiers **$100 to $500**
- TeamSnap's programme averages **$2,500+** per organisation, up to $15,000

---

## 2. The owner's question, answered

> "What's the point of fundraising from the same people that are actually
> living in the ecosystem?"

**It is the right question and it exposes the mistake most platforms make.**
Fundraising aimed at the families already paying fees is just a second
invoice. It is regressive, it annoys the payer, and it raises little.

The value is that **the platform already holds the graph that reaches
outward.** A club has 300 players. Each of those has grandparents, aunts,
neighbours, a parent's employer, a family friend who played. That second ring
is where youth sports money actually comes from, and it is **outside** the
ecosystem, unreachable by any tool the club currently owns.

So the rule for design:

> **Fundraising points outward, never inward. The platform's job is to turn a
> roster into reach, not to bill the same family twice.**

Concretely: a player gets a share link, that link opens their own page with
their team, their season and their photo, and it is shareable to people who
have never heard of us. The person who donates is not a user, needs no
account, and pays in under a minute.

---

## 3. Sponsorship: the part nobody else can do

This is where the research points somewhere genuinely differentiated.

A local business sponsoring a youth team today buys a **banner in a gym and a
logo on a jersey**, and receives **no evidence anyone saw it**. Renewal is a
favour, not a decision. Every sponsorship platform found sells the same
unmeasurable thing.

**We hold inventory nobody else in this market holds.** The consumer layer
already produces, per game, automatically:

- a live game page families watch in real time
- a box score
- an AI recap with a headline
- a Player of the Game card
- player pages that accumulate a season

That is **impression inventory with a measurable audience**, and it is
generated whether or not anyone sells it. A sponsor placed against a team's
recaps can be told, truthfully, how many people opened them.

**This is also the strategic fit.** [[us-league-targets-2026-08]] concluded
that the operator console is commoditizing and that defensibility has to be
the consumer and media layer. Sponsorship is the way that layer *earns*. It
turns the moat into revenue instead of leaving it as a differentiator we
merely talk about.

### Sponsors as platform members

Give the sponsor a login and the model changes:

- They see placements, reach and duration, not a thank-you email
- They renew against numbers
- They can discover teams to sponsor rather than waiting to be asked
- Multi-team or league-wide packages become a self-serve product

A sponsor who can see what they bought is a sponsor who buys again. That
sentence is the entire pitch.

---

## 4. Out-of-the-box ideas that fit this product specifically

Ranked by how much they use something we already have and nobody else does.

1. **Sponsored recaps.** "This recap brought to you by [local business]."
   Auto-generated after every game, so inventory scales with the season with
   zero labour. The strongest idea here.
2. **Player card sponsorship.** The POTG card is already shared to social by
   families. A small sponsor mark on a card a parent posts themselves is
   worth more than a gym banner and costs nothing to produce.
3. **Sponsor-a-player, from the player's own page.** The page exists, the
   roster exists, the payment rail exists. This is mostly assembly.
4. **Milestone fundraisers driven by real stats.** Pledge per point, per
   rebound, per win. We are the only ones with live authoritative stats, so
   the totals compute themselves and the donor gets a notification when the
   kid actually scores. Nobody else can do this at all.
5. **Team travel funds with a public goal thermometer** on the team page,
   fed by the same payments rail as fees.
6. **Season-long jersey sponsorship sold through the platform**, with the
   logo rendering on the team page and in the card art, so the sponsor sees
   their placement everywhere the team appears.
7. **Club-wide sponsor tiers** priced off real audience numbers rather than
   guesses, because we have the numbers.

---

## 5. What this would need

**Already built and reusable:** payments and the Stripe rail, offers,
per-team pages, player pages, recaps, POTG cards, the activity beacon (real
view counts), notifications, uploads and storage.

**Needs building:** a `Sponsor` entity and a sponsor role, placement
inventory and a way to attach a sponsor to a team, club, league or content
type, a public donate flow that requires no account, campaign goals and
progress, and reporting a sponsor can log in and read.

**The regulatory bit that must not be skipped:** money raised on behalf of
minors, charitable receipting (many Canadian clubs are non-profits and some
issue receipts), and provincial rules on raffles. **Raffles and 50/50 draws
are licensed gaming in every Canadian province.** The owner mentioned raffles
specifically; those cannot ship without a licensing story, and that is a
legal question rather than an engineering one.

---

## 6. Recommendation

**Sponsorship before fundraising**, which inverts the way the question was
asked.

Fundraising is a crowded category where the incumbent's only real weakness is
price, and price alone is a weak wedge that a funded competitor can match.
Sponsorship against our own media inventory is something **no competitor can
copy without first building the consumer layer**, which the research says
none of them have.

Sequenced:

1. **Sponsor entity + placement on team pages and recaps.** Smallest build,
   uses existing inventory, immediately differentiated.
2. **Sponsor login with real reach numbers.** The renewal engine.
3. **Sponsor-a-player donate flow.** Assembly of existing parts.
4. **Stat-linked pledge campaigns.** The one nobody else can do. Build it
   when live scoring is proven at scale.
5. **Raffles.** Only after a legal answer, if ever.

---

## 7. Open questions

- Do we take a percentage of funds raised, or is this a retention feature
  that runs at cost? Business model v3 says payments are a utility margin,
  which argues for at cost, but sponsorship is closer to advertising and may
  deserve a rate card.
- Who owns the sponsor relationship, the club or us? A club-owned sponsor is
  a retention feature; a platform-owned sponsor marketplace is a revenue line
  and a much bigger build.
- Charitable receipting: in or out of scope?
- Does a sponsor logo on a minor's card create a consent problem? Likely yes
  for some parents. Needs the same care as media consent.
