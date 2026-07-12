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


# ============================================================================
# V2 — LEAGUE-ANCHORED ADOPTION (owner correction 2026-07-12)
# A league win puts 100% of its teams on-platform (shells entered manually at
# session one). Clubs then ACTIVATE (claim + run registrations) over seasons.
# Adoption unit = league deals; clubs/families derive from them.
# ============================================================================
LEAGUES_WON = {1: 2, 2: 4, 3: 8, 4: 14}
CLUBS_PER_LEAGUE = 45          # census: 183 unique clubs across 4 operators ≈ 46/league
LEAGUE_TEAMS_PER_CLUB = 3.3    # of a shell club, only its league entries are on-platform
ACTIVATION_SHARE = {1: 0.15, 2: 0.30, 3: 0.45, 4: 0.55}  # cumulative: shells -> activated
DIRECT_ACTIVATED = {1: 4, 2: 12, 3: 25, 4: 45}           # clubs signing up outside leagues
FAMILY_ATTACH_SHELL = 0.04     # shell-club families see league scores/content only
FAMILY_ATTACH_ACTIVE = 0.07    # activated-club families live in the app daily

def run_league_anchored(cfg, leagues_by_year=LEAGUES_WON):
    rows = []
    for y in (1, 2, 3, 4):
        n_leagues = leagues_by_year[y]
        shells = min(TAM_CLUBS[y], int(n_leagues * CLUBS_PER_LEAGUE))
        activated = min(shells, int(shells * ACTIVATION_SHARE[y]) + DIRECT_ACTIVATED[y])
        passive = shells - activated

        # families: passive clubs contribute only league-team families;
        # activated clubs contribute their whole organization
        fam_passive = passive * LEAGUE_TEAMS_PER_CLUB * FAMILIES_PER_TEAM
        fam_active = activated * TEAMS_PER_CLUB * FAMILIES_PER_TEAM
        fp_price, _ = cfg["family"]
        fam_rev = (fam_passive * FAMILY_ATTACH_SHELL + fam_active * FAMILY_ATTACH_ACTIVE) * fp_price

        # payments: activation IS the payments attach (claiming = running money)
        gmv = activated * TEAMS_PER_CLUB * FAMILIES_PER_TEAM * AVG_ANNUAL_FEES * WALLET_SHARE
        sub_rev = sum(price * attach * activated for price, attach in cfg["sub"])
        paid_share = min(1.0, sum(a for _, a in cfg["sub"]))
        blended_bps = cfg["bps"]["paid"] * paid_share + cfg["bps"]["free"] * (1 - paid_share)
        take_rev = gmv * blended_bps / 10000

        lg_rev = n_leagues * TEAMS_PER_LEAGUE * SEASONS_PER_YEAR * cfg["league_fee"]
        stream_rev = STREAM_GAMES[y] * STREAM_NET_PER_GAME
        total = sub_rev + take_rev + fam_rev + lg_rev + stream_rev
        profit = total - opex(y, shells) - CAMERA_CAPEX[y]
        rows.append((y, n_leagues, shells, activated, gmv, take_rev, fam_rev, lg_rev, stream_rev, sub_rev, total, profit))
    return rows

print("\n" + "=" * 118)
print("V2 LEAGUE-ANCHORED — Variant D pricing. Shells = clubs on-platform via league (100% coverage); Activated = claimed+paying rails.")
print("=" * 118)
cfgD = VARIANTS["D  Hybrid rails+relationship (recommended)"]
print(f"{'Yr':<3}{'Lgs':>4}{'Shells':>7}{'Actv':>6}{'GMV':>13}{'Take':>11}{'Family':>11}{'Leagues':>10}{'Stream':>10}{'Subs':>9}{'REVENUE':>12}{'PROFIT':>12}")
cum = 0
for r in run_league_anchored(cfgD):
    y, lg, sh, act, gmv, take, fam, lgr, st, sub, total, profit = r
    cum += profit
    print(f"{y:<3}{lg:>4}{sh:>7}{act:>6}{money(gmv):>13}{money(take):>11}{money(fam):>11}{money(lgr):>10}{money(st):>10}{money(sub):>9}{money(total):>12}{money(profit):>12}")
print(f"{'':>95}4-yr cumulative profit: {money(cum)}")

print("\nLEAGUE-DEAL SENSITIVITY — Year-4 revenue by number of league operators won:")
for lgs4 in (6, 10, 14, 20):
    scaled = {1: max(1, lgs4 // 7), 2: max(2, lgs4 // 3), 3: max(4, int(lgs4 * 0.6)), 4: lgs4}
    y4 = run_league_anchored(cfgD, leagues_by_year=scaled)[3]
    print(f"  {lgs4:>2} leagues by Y4  ->  revenue {money(y4[10])}   (shells {y4[2]}, activated {y4[3]})")

print("\nWHAT ONE LEAGUE DEAL IS WORTH (steady state, Variant D):")
one_shells = CLUBS_PER_LEAGUE
one_act = int(one_shells * 0.45)
one_fam_rev = ((one_shells - one_act) * LEAGUE_TEAMS_PER_CLUB * FAMILIES_PER_TEAM * FAMILY_ATTACH_SHELL
               + one_act * TEAMS_PER_CLUB * FAMILIES_PER_TEAM * FAMILY_ATTACH_ACTIVE) * 79
one_gmv = one_act * TEAMS_PER_CLUB * FAMILIES_PER_TEAM * AVG_ANNUAL_FEES * WALLET_SHARE
one_take = one_gmv * 0.018
one_lg = TEAMS_PER_LEAGUE * SEASONS_PER_YEAR * 39
print(f"  media fee {money(one_lg)} + take {money(one_take)} + family {money(one_fam_rev)}"
      f"  =  {money(one_lg + one_take + one_fam_rev)} / year per league")
