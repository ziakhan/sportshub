#!/usr/bin/env python3
"""
Coverage diagnostics: how complete is the club census, and where is it thin?

Reads only. Writes to docs/research/consolidated/.

    python3 scripts/research/coverage-report.py

Produces three things:

  league-matrix.csv    one row per league: enumeration route, access, clubs found
  source-diversity.csv per province: how many independent sources it rests on
  coverage-gaps.csv    municipalities with population but no club (needs
                       docs/research/raw/canada-municipalities.json; skipped if absent)

The source-diversity report is the "mirror-image check". Ontario's census was
built circuit-first and missed the entire community layer. The inverse risk is
that provinces censused purely from their provincial sport organisation's member
registry miss the INDEPENDENT prep/academy layer, because private academies are
usually not PSO members. A province resting on one or two registry URLs is a
province we have not really verified.
"""

import csv
import json
import os
import re
import sys
from collections import Counter, defaultdict
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "docs", "research", "consolidated")
RAW = os.path.join(ROOT, "docs", "research", "raw")

sys.path.insert(0, HERE)
from importlib import util as _util

_spec = _util.spec_from_file_location("consolidate", os.path.join(HERE, "consolidate-clubs.py"))
_c = _util.module_from_spec(_spec)
_spec.loader.exec_module(_c)


def load_json(name):
    p = os.path.join(RAW, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else None


# --------------------------------------------------------------- league matrix

def norm_league(name):
    """Loose key for matching the same league across two investigation passes."""
    n = _c.strip_accents(name or "").lower()
    n = re.sub(r"\(.*?\)", " ", n)
    n = re.sub(r"[^a-z ]", " ", n)
    drop = {"the", "basketball", "league", "association", "ontario", "of", "and",
            "via", "season", "spring", "summer", "winter", "fall", "competitive"}
    return " ".join(t for t in n.split() if t not in drop)[:28]


def league_matrix():
    rows = []

    kml = load_json("oba-find-a-club-kml-verified.json")
    if kml:
        rows.append({
            "league": "OBL / OBA affiliated clubs", "operator": "Ontario Basketball (OBA)",
            "province": "Ontario", "route": kml["source"], "route_type": "Google My Maps KML",
            "access": "public", "clubs_found": kml["count"], "status": "CLOSED",
            "notes": "Single unauthenticated GET, all 8 OBA regions, incl. website/email/coords",
        })

    obl = load_json("obl-division-teams.json")
    if obl:
        rows.append({
            "league": "OBL division schedules (team level)", "operator": "Ontario Basketball (OBA)",
            "province": "Ontario", "route": obl["source_page"], "route_type": "Google Sheets CSV export",
            "access": "public", "clubs_found": obl["distinct_club_stems"], "status": "PARTIAL",
            "notes": f"{obl['team_entries']} team entries over {obl['divisions_fetched']} divisions; "
                     "U15 Boys + U15 Girls sheets return 401 (not publicly shared, NOT bypassed); "
                     "club stems are noisy and land in discoveries.csv for review",
        })

    # The browser sweep re-investigated several leagues the earlier HTTP-only
    # pass had recorded as blocked or dead. Where both cover the same league,
    # the browser result wins - otherwise the matrix would still report Hoop
    # City as blocked with 3 clubs when a rendered fetch returned 32.
    browser = load_json("ontario-browser-sweep.json") or {}
    browser_leagues = {}
    for s in browser.get("sources", []):
        rows.append({
            "league": s.get("name", ""), "operator": "", "province": "Ontario",
            "route": s.get("url", ""), "route_type": s.get("render_method", "playwright"),
            "access": s.get("access", ""), "clubs_found": len(s.get("clubs") or []),
            "status": "CLOSED" if (s.get("clubs") or []) else
                      ("DEAD" if s.get("access") in ("dead", "not_found") else "OPEN"),
            "notes": (s.get("notes") or "")[:220],
        })
        key = norm_league(s.get("name", ""))
        if key:
            browser_leagues[key] = len(s.get("clubs") or [])

    missing = load_json("ontario-missing-leagues.json")
    for lg in (missing or {}).get("leagues", []):
        found = len(lg.get("clubs_found") or [])
        access = lg.get("access", "unknown")
        superseded_by = next(
            (n for k, n in browser_leagues.items()
             if k and (k in norm_league(lg.get("league", "")) or norm_league(lg.get("league", "")) in k)),
            None,
        )
        if superseded_by is not None and superseded_by >= found:
            continue  # the browser sweep row above already covers this league
        rows.append({
            "league": lg.get("league", ""), "operator": lg.get("operator", ""),
            "province": "Ontario", "route": lg.get("club_list_url") or lg.get("website", ""),
            "route_type": "league site / Exposure / social",
            "access": access, "clubs_found": found,
            "status": "CLOSED" if (access == "public" and found) else
                      ("OPEN" if found == 0 else "PARTIAL"),
            "notes": (lg.get("notes") or "")[:220],
        })

    # Directories that a later route solved by another means. The community sweep
    # recorded find-a-club as yielding 0 because it is JS-rendered, but the KML
    # route above IS that directory - leaving it as OPEN would misreport it.
    SUPERSEDED = {
        "basketball.on.ca/find-a-club": "solved via the Google My Maps KML route (187 clubs)",
    }

    comm = load_json("ontario-community-layer.json")
    for d in (comm or {}).get("directories", []):
        url = d.get("url", "")
        superseded = next((v for k, v in SUPERSEDED.items() if k in url), None)
        rows.append({
            "league": f"[directory] {d.get('name','')}", "operator": "", "province": "Ontario",
            "route": url, "route_type": "directory",
            "access": d.get("access", ""), "clubs_found": d.get("yields_count", 0),
            "status": "CLOSED" if (d.get("yields_count") or superseded) else "OPEN",
            "notes": (f"SUPERSEDED: {superseded}. " if superseded else "") + (d.get("notes") or "")[:180],
        })

    rows.sort(key=lambda r: (r["status"] != "OPEN", -(r["clubs_found"] or 0)))
    path = os.path.join(OUT, "league-matrix.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["league", "operator", "province", "route", "route_type",
                                          "access", "clubs_found", "status", "notes"])
        w.writeheader()
        w.writerows(rows)

    print(f"league matrix: {len(rows)} routes  "
          f"({sum(1 for r in rows if r['status']=='OPEN')} still OPEN, "
          f"{sum(1 for r in rows if r['status']=='PARTIAL')} partial)")
    return rows, path


# ------------------------------------------------- source diversity / mirror check

REGISTRY_HINT = re.compile(
    r"basketball\.(bc|nb|on|qc)\.ca|abbasketball|basketballsask|basketballmanitoba|"
    r"basketballnovascotia|basketballpei|newfoundlandlabradorbasketball|basketball\.qc",
    re.I,
)


def source_diversity():
    master = _c.load_master()
    by_prov = defaultdict(list)
    for r in master:
        by_prov[r["province"]].append(r)

    rows = []
    for prov, lst in sorted(by_prov.items(), key=lambda x: -len(x[1])):
        domains = Counter()
        registry_backed = 0
        for r in lst:
            src = r.get("evidence_url") or ""
            for tok in re.split(r"[;,\s]+", src):
                if tok.startswith("http"):
                    host = (urlparse(tok).hostname or "").replace("www.", "")
                    if host:
                        domains[host] += 1
                    if REGISTRY_HINT.search(tok):
                        registry_backed += 1
                    break
        typed = Counter((r.get("type") or "").lower() for r in lst)
        academy = sum(v for k, v in typed.items() if "academy" in k or "private" in k or "prep" in k)
        top_share = (domains.most_common(1)[0][1] / len(lst)) if domains else 0.0

        # A province is under-verified if nearly everything traces to one host,
        # or if it has no independent (non-registry) sourcing at all.
        risk = []
        if len(domains) <= 2:
            risk.append("single-source")
        if top_share >= 0.5:
            risk.append("dominated-by-one-host")
        if len(lst) and academy / len(lst) < 0.15:
            risk.append("thin-academy-layer")
        if not domains:
            risk.append("no-per-row-provenance")

        rows.append({
            "province": prov,
            "clubs": len(lst),
            "distinct_source_hosts": len(domains),
            "top_host": domains.most_common(1)[0][0] if domains else "",
            "top_host_share": f"{top_share:.0%}" if domains else "",
            "registry_backed_rows": registry_backed,
            "academy_or_private": academy,
            "academy_share": f"{academy/len(lst):.0%}" if lst else "",
            "risk_flags": ";".join(risk),
        })

    path = os.path.join(OUT, "source-diversity.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    print(f"\nsource diversity / mirror-image check -> {path}")
    print(f"  {'province':26} {'clubs':>6} {'hosts':>6} {'acad%':>6}  risk")
    for r in rows:
        print(f"  {r['province'][:26]:26} {r['clubs']:>6} {r['distinct_source_hosts']:>6} "
              f"{r['academy_share']:>6}  {r['risk_flags']}")
    return rows, path


# ------------------------------------------------------------- coverage gaps

def coverage_gaps():
    muni = load_json("canada-municipalities.json")
    if not muni:
        print("\ncoverage gaps: SKIPPED (docs/research/raw/canada-municipalities.json not present yet)")
        return None

    path_in = os.path.join(OUT, "clubs-consolidated.csv")
    clubs = list(csv.DictReader(open(path_in, encoding="utf-8")))

    # A municipality counts as covered if a club records it as its city OR names
    # it in the club/alias name. Canadian clubs are overwhelmingly named for their
    # town ("Thunder Bay Blaze"), and 147 rows still carry no city at all, so a
    # city-only test reports gaps that are really just missing metadata.
    have = defaultdict(set)
    name_blob = defaultdict(str)
    for c in clubs:
        if c["city"].strip():
            have[c["province"]].add(_c.city_key(c["city"]))
        name_blob[c["province"]] += " " + _c.strip_accents(
            f"{c['club_name']} {c.get('aliases','')} {c.get('region','')}"
        ).lower()

    # Province naming differs slightly between sources; normalise both sides.
    def pkey(p):
        p = (p or "").lower()
        p = p.replace("&", "and").replace("newfoundland and labrador", "newfoundland")
        p = re.sub(r"\(.*?\)", "", p)
        return re.sub(r"[^a-z]", "", p)

    have_by_pkey = defaultdict(set)
    for prov, cities in have.items():
        have_by_pkey[pkey(prov)] |= cities
    blob_by_pkey = defaultdict(str)
    for prov, blob in name_blob.items():
        blob_by_pkey[pkey(prov)] += blob

    gaps = []
    for m in muni.get("municipalities", []):
        pk = pkey(m.get("province"))
        ck = _c.city_key(m.get("name"))
        if not ck:
            continue
        pool = have_by_pkey.get(pk, set())
        hit = ck in pool or any(ck in h or h in ck for h in pool)
        if not hit and len(ck) >= 5:
            hit = re.search(r"\b" + re.escape(ck) + r"\b", blob_by_pkey.get(pk, "")) is not None
        if not hit:
            gaps.append({
                "municipality": m["name"],
                "province": m["province"],
                "population": m.get("population", 0),
                "clubs_found": 0,
                "priority": "high" if (m.get("population") or 0) >= 25000 else "medium",
            })

    gaps.sort(key=lambda g: -(g["population"] or 0))
    path = os.path.join(OUT, "coverage-gaps.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["municipality", "province", "population",
                                          "clubs_found", "priority"])
        w.writeheader()
        w.writerows(gaps)

    covered = len(muni["municipalities"]) - len(gaps)
    print(f"\ncoverage gaps -> {path}")
    print(f"  municipalities checked : {len(muni['municipalities'])}")
    print(f"  with >=1 club          : {covered} ({covered*100//max(len(muni['municipalities']),1)}%)")
    print(f"  ZERO clubs             : {len(gaps)}")
    print(f"  of those, pop >= 25k   : {sum(1 for g in gaps if g['population'] >= 25000)}")
    print("\n  largest municipalities with no club at all:")
    for g in gaps[:15]:
        print(f"    {g['population']:>8,}  {g['municipality']}, {g['province']}")
    return path


def main():
    os.makedirs(OUT, exist_ok=True)
    league_matrix()
    source_diversity()
    coverage_gaps()


if __name__ == "__main__":
    main()
