#!/usr/bin/env python3
"""
SportsHub 4-year revenue model — compares pricing-model variants.
All figures CAD. Assumptions are grounded in:
  - docs/research/ census: Ontario basketball = 183 clubs / 824 league team
    entries; NPH collects ~$3,990/team/season.
  - docs/business-model.md competitor sweep: GameChanger family $99.99USD/yr,
    Spond CA take 5%+$0.50, SportsEngine $58/mo + 3.75%+$1.75, Hudl
    $400-1600/team/yr, Exposure $2/team-event.
Run: python3 scripts/research/revenue-model.py
"""

# ---------------- market assumptions (base case) ----------------
# Ontario basketball is the beachhead; volleyball (owner's second sport) and
# rest-of-Canada expand the TAM in Y3-Y4.
TAM_CLUBS = {1: 183, 2: 320, 3: 640, 4: 950}  # reachable clubs (ON bb -> +ON vb -> +national)
ACTIVE_CLUBS = {  # adoption scenarios: (low, base, high)
    1: (12, 25, 40),
    2: (40, 70, 110),
    3: (90, 160, 260),
    4: (170, 340, 520),
}
TEAMS_PER_CLUB = 8           # blended (house-league orgs pull avg above census's league-entry count)
FAMILIES_PER_TEAM = 11
AVG_ANNUAL_FEES = 1400       # blended rep ($2.5-3.5K) + house league ($350-600) per family
PAYMENTS_ATTACH = 0.70       # share of active clubs running registrations through us
WALLET_SHARE = 0.80          # share of an attached club's fees processed on-platform
STRIPE_COGS_ON_FLAT = 0.30   # our $0.30 flat is roughly pass-through; bps are margin

LEAGUES = {1: 2, 2: 4, 3: 8, 4: 14}       # league operators live (NPH first)
TEAMS_PER_LEAGUE = 180
SEASONS_PER_YEAR = 2

# AI-camera / stream engine (Y2 pilot, scales with venues)
STREAM_GAMES = {1: 0, 2: 600, 3: 3000, 4: 9000}
STREAM_NET_PER_GAME = 14.0   # viewer revenue ~$22 (PPV/subs blend) - $6 QA labor - $2 infra
CAMERA_CAPEX = {1: 0, 2: 9000, 3: 28000, 4: 52000}  # ~$1.5K/court, expensed

# Cost side (lean, automation-first per owner)
def opex(year, clubs):
    infra = 6000 + clubs * 60          # hosting, sockets, push, backups
    llm = clubs * TEAMS_PER_CLUB * 30 * 0.03  # recaps ~30 games/team/yr
    support = {1: 0, 2: 40000, 3: 90000, 4: 150000}[year]  # contractors; founders excluded
    return infra + llm + support

# ---------------- pricing-model variants ----------------
# Each: how clubs pay (sub tiers + attach), take-rate bps by tier,
# family pass price + attach, league fees.
VARIANTS = {
    "A  Rails-led (free software, tax the rails)": dict(
        sub=[(399, 0.15), (999, 0.05)],       # (annual price, attach among active clubs)
        bps={"free": 250, "paid": 100},
        family=(79, 0.04),
        league_fee=29, club_caps=False,
    ),
    "B  SaaS-led (caps force the upgrade)": dict(
        sub=[(399, 0.45), (999, 0.15)],
        bps={"free": 75, "paid": 75},
        family=(79, 0.04),
        league_fee=29, club_caps=True,        # 3-team cap on free -> adoption haircut
    ),
    "C  Consumer-led (GameChanger clone)": dict(
        sub=[],                                # club software 100% free
        bps={"free": 100, "paid": 100},
        family=(99, 0.08),                     # harder family gating -> higher attach+price
        league_fee=19, club_caps=False,
    ),
    "D  Hybrid rails+relationship (recommended)": dict(
        sub=[(599, 0.20)],                     # single 'Pro ops' tier: analytics+marketing+priority
        bps={"free": 200, "paid": 100},
        family=(79, 0.06),
        league_fee=39, club_caps=False,
    ),
}
CAP_ADOPTION_HAIRCUT = 0.80  # variant B: free-tier caps slow word-of-mouth adoption
CAP_CHURN_EXTRA = 0.05

def run(variant, cfg, scenario_ix=1, years=(1, 2, 3, 4)):
    rows = []
    for y in years:
        clubs = ACTIVE_CLUBS[y][scenario_ix]
        if cfg["club_caps"]:
            clubs = int(clubs * CAP_ADOPTION_HAIRCUT)
        families = clubs * TEAMS_PER_CLUB * FAMILIES_PER_TEAM

        # 1) club subscriptions
        sub_rev = sum(price * attach * clubs for price, attach in cfg["sub"])
        paid_share = min(1.0, sum(a for _, a in cfg["sub"]))

        # 2) payments take (bps are margin; flat ~passes through Stripe)
        gmv = clubs * PAYMENTS_ATTACH * TEAMS_PER_CLUB * FAMILIES_PER_TEAM \
              * AVG_ANNUAL_FEES * WALLET_SHARE
        blended_bps = cfg["bps"]["paid"] * paid_share + cfg["bps"]["free"] * (1 - paid_share)
        take_rev = gmv * blended_bps / 10000

        # 3) family pass
        fp_price, fp_attach = cfg["family"]
        fam_rev = families * fp_attach * fp_price

        # 4) leagues
        lg_rev = LEAGUES[y] * TEAMS_PER_LEAGUE * SEASONS_PER_YEAR * cfg["league_fee"]

        # 5) AI-stream engine (same product all variants; family base drives it a bit)
        stream_rev = STREAM_GAMES[y] * STREAM_NET_PER_GAME
        capex = CAMERA_CAPEX[y]

        total = sub_rev + take_rev + fam_rev + lg_rev + stream_rev
        profit = total - opex(y, clubs) - capex
        rows.append((y, clubs, gmv, sub_rev, take_rev, fam_rev, lg_rev, stream_rev, total, profit))
    return rows

def money(x): return f"${x:>10,.0f}"

print("=" * 112)
print("SPORTSHUB 4-YEAR MODEL — BASE adoption scenario (CAD). GMV = registrations processed on-platform.")
print("=" * 112)
for name, cfg in VARIANTS.items():
    print(f"\n### Variant {name}")
    print(f"{'Yr':<3}{'Clubs':>6}{'GMV':>13}{'ClubSubs':>11}{'Take':>11}{'FamilyPass':>12}{'Leagues':>10}{'AIStream':>11}{'REVENUE':>12}{'PROFIT':>12}")
    cum = 0
    for y, clubs, gmv, sub, take, fam, lg, st, total, profit in run(name, cfg):
        cum += profit
        print(f"{y:<3}{clubs:>6}{money(gmv):>13}{money(sub):>11}{money(take):>11}{money(fam):>12}{money(lg):>10}{money(st):>11}{money(total):>12}{money(profit):>12}")
    print(f"{'':>89}4-yr cumulative profit: {money(cum)}")

print("\n" + "=" * 112)
print("ADOPTION SENSITIVITY — Year-4 total revenue by variant (low / base / high club adoption)")
print("=" * 112)
for name, cfg in VARIANTS.items():
    vals = []
    for ix in (0, 1, 2):
        y4 = run(name, cfg, scenario_ix=ix, years=(4,))[0]
        vals.append(y4[8])
    print(f"{name:<48}{money(vals[0])}{money(vals[1])}{money(vals[2])}")

print("\n" + "=" * 112)
print("LEVER SENSITIVITY on Variant D — Year-3 revenue")
print("=" * 112)
base = VARIANTS["D  Hybrid rails+relationship (recommended)"]
print("Family-pass attach:   ", end="")
for att in (0.02, 0.04, 0.06, 0.08, 0.10):
    cfg = dict(base); cfg["family"] = (79, att)
    print(f"{att:.0%}={run('D', cfg, years=(3,))[0][8]:,.0f}  ", end="")
print("\nFree-tier take (bps): ", end="")
for bps in (100, 150, 200, 250, 300):
    cfg = dict(base); cfg["bps"] = {"free": bps, "paid": 100}
    print(f"{bps}={run('D', cfg, years=(3,))[0][8]:,.0f}  ", end="")
print("\nFamily price @6% att: ", end="")
for price in (59, 79, 99, 119):
    cfg = dict(base); cfg["family"] = (price, 0.06)
    print(f"${price}={run('D', cfg, years=(3,))[0][8]:,.0f}  ", end="")
print()
