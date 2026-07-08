---
theme: [research, gtm]
type: research
status: reference
updated: 2026-07-06
tags: [theme/research, theme/gtm, type/research, status/reference]
---

# Club & program taxonomy — segmentation for the business model (2026-07-06)

The market is NOT "clubs" as one thing. Five distinct operating models exist, and
they buy differently. Definitions below, then how each maps to our schema and
pricing. Team counts per club: see club-team-counts (companion doc, in progress).

## The five segments

### 1. Scholastic prep programs (the OSBA model)
- **What:** all players are ENROLLED STUDENTS at one school/academy. The school
  operates the basketball program; basketball is part of tuition or a program fee
  (often $10k–$30k+/yr incl. academics). Games happen under a sanctioned
  scholastic league — in Ontario that's **OSBA** (Ontario Basketball-owned).
- **Examples:** Royal Crown, Crestwood Prep, Ridley College, Orangeville Prep
  (Athlete Institute), FEIA, King's Christian, Lincoln Prep.
- **Levels:** Gr 9–12 (some run D-League for Gr 9–10 = their "junior varsity").
- **Teams per org:** low (2–6 entries: varsity M/W + D-League + Trillium second
  teams).
- **Buying:** school admin/athletic director decides; budget exists (they pay
  Synergy/Pixellot today); care about RECRUITMENT EXPOSURE — player pages, stats,
  film, streaming.

### 2. Independent prep circuits & programs (NPH / NJC / NSC — "prep outside the scholastic circuit")
- **What:** prep-BRANDED programs whose players may attend different schools (or
  the org is a school that isn't in OSBA). They compete in independent circuits:
  **NPA/WNPA** (NPH's national school-based prep league), **NJC** (Gr 9–10),
  **NSC** (Gr 11–12), **NPH D1**. Pay per-team circuit fees ($950/session NJC,
  ~$5k/season; NPH Showcase $3,990/team/summer).
- **Examples:** Brampton City Prep, Westfield Prep, SC Academy, Vanguard North,
  Wiggins Elite, Canada Topflight.
- **Levels:** Gr 9–12 (junior + senior prep).
- **Teams per org:** 1–5 circuit entries, often across multiple circuits at once.
- **Buying:** program director (often the founder-coach); spends thousands per
  team on circuit entry already; cares about exposure + looking professional.

### 3. Rep clubs (the volume segment — OBL / Coalition / Hoop City / CYBL)
- **What:** community clubs with TRYOUT-BASED age-group teams; kids attend many
  different schools. One club = MANY teams: U9→U19 (Gr 4→12), boys + girls, at
  A/AA/AAA levels — this is where "middle school kids in rep leagues AND high
  school kids in rep leagues" lives, inside ONE org.
- **Examples:** Vaughan Panthers, Monarchs, East York (31 rep teams), SBA,
  YNBA, TPG, Markham Gators, Brampton Warriors.
- **Levels:** U9–U19 = middle school AND high school under one roof.
- **Teams per org:** 10–40+. THE key fact for pricing.
- **Buying:** volunteer boards or owner-operators; price-sensitive; feel
  registration/tryout/payment pain (our club-ops suite) as much as game-day pain.

### 4. Hybrid organizations (club + prep under one brand)
- **What:** rep clubs that ALSO run a prep program, or prep programs that also
  field rep/Showcase age-group teams. Their data is the most fragmented today.
- **Examples:** Brampton City Prep (OSBA + NJC ×2 + NSC + D1), Monarchs (OBL +
  Coalition rep + NSC prep entry), Royal Crown (OSBA school + NPH Showcase club
  teams down to Gr 9), ONL-X (NJC+NSC+SL+D1 + Ottawa rep).
- **Why they matter:** highest willingness to pay (multiple budgets), most teams,
  and the strongest resonance with "one club identity across every league."

### 5. House-league / community orgs
- **What:** recreational, no tryouts, often church/community-based; some also run
  rep (East York: Saturday house league + 31 rep teams).
- **Examples:** Blessed Sacrament, King Nation (Pickering), Kanata Youth.
- **Buying:** cheapest tier; volume of players is high, ops budget near zero.
  Registration/payments is the wedge, not live scoring.

## Level definitions (use these consistently in product + pricing)

| Level | Ages/Grades | Where they play |
|---|---|---|
| **Youth / middle school** | U9–U14 ≈ Gr 4–8 | Rep leagues (OBL, Coalition, Hoop City, CYBL), NPH Showcase Gr 5–8 |
| **Junior high school** | U15–U16 ≈ Gr 9–10 | Rep leagues, NJC, NPH Showcase Gr 9–10, OSBA D-League |
| **Senior high school / prep** | U17–U19 ≈ Gr 11–12 | Rep leagues, NSC, NPH Showcase Gr 11–12, OSBA/Trillium, NPA |

Key structural fact: **a "club" is a container of teams that spans levels and
leagues.** Our schema already models this correctly (Tenant → Teams; League/
Season/Division separate; a team submits into a league season). No schema change
needed for the taxonomy — it needs a `Tenant.segment` classification (or derived
tag) + accurate team counts.

## Pricing model options (to finalize with team-count data)

| Model | Wins | Loses | Fit |
|---|---|---|---|
| **Per club flat** | Simple; loved by big rep clubs | Massively underprices a 40-team club vs a 3-team prep | Bad as the only axis |
| **Per team / season** | Scales with value; matches how circuits already charge clubs ($950–$4k/team ENTRY fees make a $10–20/team/mo software fee look trivial) | Adds friction for the biggest clubs; needs volume discounts | Strong primary axis |
| **Per league (operator pays)** | One deal covers all clubs' game-day features; enforcement comes free | League budgets are thin except OBA/NPH | Right for the LEAGUE product (scoring, standings, scoresheets) |
| **Per player (registration cut)** | Aligns with club revenue; invisible to club budget | Only monetizes registration flows | Right for payments (we already take this shape via Stripe fees) |
| **Family subscriptions (Family Pass)** | Parents pay, clubs don't | Needs content density first | Already planned P3 (§12) |

**Working hypothesis (validate with counts):** three-axis model —
1. **League operators**: per-team-per-season platform fee (they already think in
   per-team entry fees) for scoring/standings/scoresheets/content.
2. **Clubs**: freemium claim → paid club tier priced by TEAM COUNT BANDS
   (e.g., ≤5 teams / 6–15 / 16+), covering registration, tryouts, offers,
   payments, branded pages. Bands avoid per-team nickel-and-diming while still
   scaling with the 40-team clubs.
3. **Families**: Family Pass (planned) on top of the free record.

Segment-fit: scholastic/prep orgs (segments 1–2) skew small-team-count but high
budget → band floors + recruitment/exposure features justify a premium tier.
Rep clubs (segment 3) hit the higher bands → most revenue per logo. House league
(segment 5) = free/cheap registration tier, funnel for everything else.
