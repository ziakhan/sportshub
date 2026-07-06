#!/usr/bin/env python3
"""Build the research spreadsheets from the saved census docs.
Views: leagues.csv, clubs.csv, club_league_memberships.csv, team_entries.csv
(+ combined .xlsx if openpyxl is available)."""
import csv, re, os, sys

D = "/Users/ziakhan/zia/personal/sportshub/docs/research"
S = os.path.join(D, "sheets")
os.makedirs(S, exist_ok=True)

# ---------------- leagues view (hand-curated from the league research) --------
LEAGUES = [
    # name, operator, kind, ages, region, entries_2025_26, orgs, season, software, fee_per_team, contact
    ["OSBA (Ontario Scholastic Basketball Association)", "Ontario Basketball (OBA)", "Scholastic prep league", "Gr9-12 (D-League=Gr9-10)", "Ontario", "94", "38", "Sep-Mar (champs Mar 5-8)", "RAMP + Synergy + Pixellot/SportsCanada.TV", "unpublished (application)", "info@basketball.on.ca; jdawkins@basketball.on.ca; 416-477-8075"],
    ["NPA (National Preparatory Association)", "North Pole Hoops", "School-based prep league (national)", "Sr prep", "Canada", "14", "14", "Fall-winter, Season 7", "stats.northpolehoops.com (in-house)", "unpublished", "info@northpolehoops.com"],
    ["WNPA", "North Pole Hoops", "Girls school-based prep league", "Sr prep", "Canada", "10", "10", "Season 2", "stats.northpolehoops.com (in-house)", "unpublished", "info@northpolehoops.com"],
    ["NPH Showcase League (F/W)", "North Pole Hoops", "Independent club circuit", "Gr5-12 + JrGirls", "Ontario (Durham to K-W/Niagara)", "146", "~100", "Oct-Mar", "stats.northpolehoops.com (in-house)", "$3,990+tax (Summer 2026 published)", "info@northpolehoops.com"],
    ["NPH D1 League", "North Pole Hoops", "Independent prep/academy circuit", "Jr/Sr boys+girls", "Ontario+QC", "60", "~45", "Oct-Mar", "stats.northpolehoops.com (in-house)", "unpublished", "info@northpolehoops.com"],
    ["CNIT tournaments", "North Pole Hoops", "Tournament series", "11U-19U", "Canada", "", "", "Spring 2026 (ssn 32-41)", "stats portal + Exposure", "per event", "info@northpolehoops.com"],
    ["NJC (National Junior Circuit)", "Tony House (Canada Topflight, Ottawa)", "Independent prep circuit", "Gr9-10", "ON/QC/NB (games at Six Park East, Oshawa)", "51", "44", "Oct 10-Mar 15 + champs", "TeamLinkt", "$950/session; ~$5,150 full", "nationaljuniorcircuit@gmail.com"],
    ["NSC (National Senior Circuit)", "Tony House (Canada Topflight, Ottawa)", "Independent prep circuit", "Gr11-12/Sr prep", "ON/QC/BC", "32", "29", "Oct 10-Mar 15 + champs", "TeamLinkt", "$950/session; ~$5,150 full", "nationalseniorcircuit@gmail.com"],
    ["OBL (Ontario Basketball League) + Ontario Cup", "Ontario Basketball (OBA)", "Rep club league (sanctioned)", "U9-U19 B&G, A/AA/AAA/OBLX", "Province-wide", "~1,200 rep teams claimed (not enumerable)", "~175 clubs", "Oct-May (5 weekends) + spring cup", "RAMP + SportsAvvy + Google Sheets links", "entry fees via OBA", "obl@basketball.on.ca; 416-477-8075"],
    ["OBSL (Ontario Basketball Super League)", "OBA + CYBL + Hoop City", "Meta-championship (top-4 merge U10-U14)", "U10-U14", "Ontario", "12/age group", "", "Mid-season merge", "parent leagues' stacks", "n/a", "via OBA"],
    ["Coalition Basketball League (TCL/X/Elite + Summer)", "Coalition of member clubs", "Rep club league", "Gr4-Senior B&G", "GTA + southern ON", "417 (Summer 2025 open event)", "~175 orgs in summer; 19 members", "Winter Aug-Apr; Summer Jun-Aug", "Exposure Events + app; YouTube broadcasts", "typ $600-900/team (unpublished)", "info@coalitionbasketballleague.com"],
    ["CYBL (Canadian Youth Basketball League)", "CYBL (independent, OBSL partner)", "Rep club league", "Gr5-8 F/W + U15-U19 spring/summer premier", "Toronto/GTA", "not published", "", "Fall/winter + Apr-Jul premier", "SportsEngine (public pages 403) + Exposure (disabled)", "unpublished", "cybl.ca contact page"],
    ["Hoop City Basketball League", "Hoop City (OBA-sanctioned)", "Rep club league + weekend circuits", "U10-U19 B&G", "GTA", "not published", "", "Winter + Summer", "LeagueApps + Wix", "unpublished", "hoopcitybasketballleague@gmail.com; 519-358-6263"],
    ["JUEL / JUEL Prep / JUEL Academy", "Canadian Basketball Alliance", "Elite girls franchise league", "Gr8-12", "Province-wide (12 franchises)", "12/division", "12", "Dec-May, finals mid-May", "SportsEngine microsites; franchises TeamLinkt/club sites", "unpublished", "info@juel.ca"],
    ["ORBL (Ontario Regional Basketball League)", "IEM Basketball", "Rep league", "U10-U16 boys A/AA/AAA", "York Region/north GTA", "19 teams", "", "F/W + Spring + Summer", "in-house PHP", "unpublished", "info@iembasketball.com; 905-836-6195"],
    ["EOBA (Eastern Ontario Basketball Association)", "EOBA", "Rec + competitive", "U12-U19 B&G", "Ottawa/Eastern ON", "not published", "", "Fall/winter", "TeamSnap", "unpublished", "eobahoops.com"],
    ["Canada Hoops Circuit", "Multi-operator (F.O.R.M., CanElite-4QT, Windsor Suns, ACE); Porter sponsor", "Showcase circuit", "U15-U19", "6 summits + Toronto Nationals", "8 spots/division at Nationals", "", "Summits -> Jul 17-20 Nationals", "own-site registration", "unpublished", "site form"],
    ["Kingdom Summer League", "Independent (Toronto)", "Summer exposure league", "youth-senior", "Toronto", "unpublished", "", "Summer", "Instagram/Facebook only", "unpublished", "IG @kingdomsummerleague"],
]

with open(f"{S}/leagues.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["league","operator","kind","ages","region","team_entries_2025_26","orgs","season","current_software","fee_per_team","public_contact"])
    w.writerows(LEAGUES)

# ---------------- parse census docs -> memberships + team entries -------------
memberships = []   # club, league, entries, detail
entries = []       # club, league, division/entry detail

def read(p):
    with open(os.path.join(D, p)) as f:
        return f.read()

# --- NJC/NSC ---
txt = read("census-njc-nsc-2025-26.md")
sec = txt.split("## Team entries by club/program")[1].split("## Summary")[0]
njc_total = nsc_total = 0
for line in sec.splitlines():
    if not line.startswith("| ") or line.startswith("| Club") or line.startswith("|---"):
        continue
    c = [x.strip() for x in line.strip().strip("|").split("|")]
    if len(c) < 4: continue
    club, njc, nsc, names = c[0], int(c[1]), int(c[2]), c[3]
    njc_total += njc; nsc_total += nsc
    # entry names: "NJC: a, b · NSC: c"
    parts = {}
    for seg in names.split("·"):
        seg = seg.strip()
        m = re.match(r"(NJC \+ NSC|NJC|NSC):\s*(.*)", seg)
        if m:
            for lg in (["NJC","NSC"] if "+" in m.group(1) else [m.group(1)]):
                parts.setdefault(lg, []).extend([x.strip() for x in m.group(2).split(",")])
    for lg, n in (("NJC", njc), ("NSC", nsc)):
        if n == 0: continue
        det = parts.get(lg, [])
        memberships.append([club, lg, n, "; ".join(det)])
        det = det if len(det) == n else (det + [""] * n)[:n]
        for e in det:
            entries.append([club, lg, e or "(entry)"])
assert njc_total == 51 and nsc_total == 32, (njc_total, nsc_total)

# --- NPH multi-entry table ---
txt = read("census-nph-2025-26.md")
multi = txt.split("## Multi-entry clubs")[1].split("## Single-entry clubs")[0]
nph_count = 0
def expand_divisions(divtext, n):
    out = []
    for seg in [s.strip() for s in divtext.split(";") if s.strip()]:
        m = re.search(r"×(\d+)", seg)
        k = int(m.group(1)) if m else 1
        base = re.sub(r"\s*×\d+", "", seg).strip()
        out.extend([base] * k)
    if len(out) != n:
        out = (out + ["(entry)"] * n)[:n]
    return out

for line in multi.splitlines():
    if not line.startswith("| ") or line.startswith("| Club") or line.startswith("|---"):
        continue
    c = [x.strip() for x in line.strip().strip("|").split("|")]
    if len(c) < 4: continue
    club, lgs, n, divs = c[0], c[1], int(c[2]), c[3]
    nph_count += n
    memberships.append([club, f"NPH ({lgs})", n, divs])
    for d in expand_divisions(divs, n):
        lg = "NPA" if d == "NPA" else "WNPA" if d == "WNPA" else ("NPH-D1" if d.startswith("D1") else "NPH-SL")
        entries.append([club, lg, d])

# --- NPH single-entry list ---
singles = txt.split("## Single-entry clubs (71)")[1].split("\\* registered")[0]
singles = singles.replace("\n", " ")
items = [x.strip() for x in singles.split("·") if x.strip()]
for it in items:
    m = re.match(r"(.+?)\s*\(([^)]+)\)\s*\*?$", it)
    if not m: continue
    club, d = m.group(1).strip(), m.group(2).strip()
    lg = "NPA" if d == "NPA" else "WNPA" if d == "WNPA" else ("NPH-D1" if d.startswith("D1") else "NPH-SL")
    memberships.append([club, lg, 1, d])
    entries.append([club, lg, d])
    nph_count += 1
assert nph_count == 230, nph_count

# --- OSBA matrix ---
txt = read("census-osba-coalition-2025-26.md")
osba = txt.split("## A) OSBA")[1].split("Attribution assumptions")[0]
DIVS = ["OSBA Men's", "OSBA Women's", "Trillium Men's", "D-League Boys", "D-League Girls"]
osba_total = 0
for line in osba.splitlines():
    if not line.startswith("| ") or line.startswith("| Organization") or line.startswith("|---") or line.startswith("| **Total**"):
        continue
    c = [x.strip() for x in line.strip().strip("|").split("|")]
    if len(c) < 7: continue
    org = c[0]
    counts = [0 if v in ("–", "-", "") else int(v) for v in c[1:6]]
    tot = int(c[6])
    assert sum(counts) == tot, (org, counts, tot)
    osba_total += tot
    memberships.append([org, "OSBA", tot, "; ".join(f"{d}:{n}" for d, n in zip(DIVS, counts) if n)])
    for d, n in zip(DIVS, counts):
        for i in range(n):
            entries.append([org, "OSBA", d + (f" (entry {i+1})" if n > 1 else "")])
assert osba_total == 94, osba_total

# --- Coalition members + top non-members ---
coal = txt.split("Member-club counts")[1].split("## Cross-system summary")[0]
for line in coal.splitlines():
    if not line.startswith("| ") or line.startswith("| Member") or line.startswith("|---") or "subtotal" in line or "other programs" in line:
        continue
    c = [x.strip() for x in line.strip().strip("|").split("|")]
    if len(c) < 3: continue
    club, n, ages = c[0], c[1], c[2]
    m = re.match(r"(\d+)", n)
    if not m or int(m.group(1)) == 0: continue
    memberships.append([club, "Coalition (Summer 2025)", int(m.group(1)), ages])
    for i in range(int(m.group(1))):
        entries.append([club, "Coalition (Summer 2025)", f"{ages} (entry {i+1})"])
TOP_NONMEMBERS = [("The MUMBA Mentality", 18), ("YvY", 12), ("Eurostep", 11), ("Burloak", 10),
    ("iDream by BOA", 9), ("Born 2 Stand Out", 9), ("Durham Blues", 8), ("City Above", 7),
    ("Toronto Lords", 7), ("Hoopzone Knights", 7)]
for club, n in TOP_NONMEMBERS:
    memberships.append([club, "Coalition (Summer 2025, non-member)", n, "Gr4-Senior"])
    for i in range(n):
        entries.append([club, "Coalition (Summer 2025)", f"(entry {i+1})"])

# --- OBL / JUEL known participants (membership only, counts unknown) ---
for club, city in [("JUMP Basketball","Mississauga"),("Monarchs Basketball","Mississauga"),
    ("TPG Basketball","Brampton"),("Markham Gators","Markham"),("Vaughan Panthers","Vaughan"),
    ("SBA Blues","Scarborough"),("East York Basketball","Toronto"),("YNBA","Aurora-Newmarket"),
    ("Ontario Elite",""),("North Bay Basketball Academy","North Bay")]:
    memberships.append([club, "OBL (example member; full list not public)", "", city])
for club in ["SBA Blues","YNBA","Oakville Vytis","Pelham Panthers","Tri-County Soldiers",
             "Kingston Impact","St. Lawrence Lightning","Ottawa Capitals"]:
    memberships.append([club, "JUEL (confirmed franchise)", "", ""])

with open(f"{S}/club_league_memberships.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["club","league","team_entries","detail"])
    w.writerows(memberships)

with open(f"{S}/team_entries.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["club","league","entry_detail"])
    w.writerows(entries)

# ---------------- clubs view: master + census totals --------------------------
CLUB_ALIASES = {
    "scarborough blues sba": "sba premier scarborough association",
    "sba blues": "sba premier scarborough association",
    "east york eagles": "east york",
    "milton stags": "stags",
    "etobicoke thunder": "etobicoke",
    "mumba mba likely mumba markham verify": "mumba mentality",
    "mba likely mumba markham verify": "mba",
}

def norm(name):
    n = name.lower()
    n = re.sub(r"\(.*?\)", "", n)
    n = re.sub(r"—.*$", "", n)
    n = re.sub(r"[^a-z0-9 ]", " ", n)
    n = re.sub(r"\b(the|of|basketball|academy|prep|elite|school|club)\b", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return CLUB_ALIASES.get(n, n)

totals = {}
for club, lg, n, det in [(m[0], m[1], m[2], m[3]) for m in memberships]:
    if not isinstance(n, int): continue
    k = norm(club)
    totals.setdefault(k, {"name": club, "n": 0, "leagues": set()})
    totals[k]["n"] += n
    totals[k]["leagues"].add(lg.split(" (")[0])

rows = []
seen = set()
with open(f"{D}/unique-clubs-master.csv") as f:
    for r in csv.DictReader(f):
        k = norm(r["club"])
        t = totals.get(k)
        rows.append([r["club"], r["city"], r["leagues"], r["contact"], r["tenant"],
                     t["n"] if t else "", "+".join(sorted(t["leagues"])) if t else ""])
        seen.add(k)
for k, t in sorted(totals.items()):
    if k not in seen:
        rows.append([t["name"], "", "", "", "", t["n"], "+".join(sorted(t["leagues"]))])

rows.sort(key=lambda r: (-(int(r[5]) if str(r[5]).isdigit() else 0), r[0].lower()))
with open(f"{S}/clubs.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["club","city","leagues_from_master","best_contact","tenant_slug","team_entries_censused","census_systems"])
    w.writerows(rows)

print(f"leagues: {len(LEAGUES)}")
print(f"memberships: {len(memberships)}")
print(f"team entries: {len(entries)} (NJC/NSC 83 + NPH 230 + OSBA 94 + Coalition {len(entries)-83-230-94})")
print(f"clubs: {len(rows)} ({len(rows)-len(seen)} census-only additions)")

# ---------------- optional xlsx ------------------------------------------------
try:
    from openpyxl import Workbook
    wb = Workbook()
    def sheet(name, path, first=False):
        ws = wb.active if first else wb.create_sheet()
        ws.title = name
        with open(path) as f:
            for row in csv.reader(f):
                ws.append(row)
    sheet("Leagues", f"{S}/leagues.csv", first=True)
    sheet("Clubs", f"{S}/clubs.csv")
    sheet("Club-League memberships", f"{S}/club_league_memberships.csv")
    sheet("Team entries", f"{S}/team_entries.csv")
    wb.save(f"{S}/ontario-basketball-research-2026-07.xlsx")
    print("xlsx: written")
except ImportError:
    print("xlsx: openpyxl not available — CSVs only")
