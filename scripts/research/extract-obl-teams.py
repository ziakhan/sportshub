#!/usr/bin/env python3
"""
Extract OBL team entries from the per-division Google Sheets and reduce them to
parent clubs.

The OBA "Ontario Basketball League Schedule" page links one public Google Sheet
per division. Each sheet lays teams out in columns under "Pool A/B/C..." headers,
so every non-empty cell below a pool header is a team entry. Sheets are fetched
with the public CSV export endpoint:

    https://docs.google.com/spreadsheets/d/<ID>/export?format=csv

Usage:
    python3 scripts/research/extract-obl-teams.py <dir-of-division-csvs>

Writes docs/research/raw/obl-division-teams.json — every team entry, the club
stem derived from it, and the division it played in.
"""

import csv
import json
import os
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from importlib import util as _util

_spec = _util.spec_from_file_location("consolidate", os.path.join(HERE, "consolidate-clubs.py"))
_mod = _util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
club_stem, norm_full = _mod.club_stem, _mod.norm_full

POOL_HEADER = re.compile(r"^\s*(pool|group|division|conference)\b", re.I)
# Cells that are structure or notes, never a team.
NOT_A_TEAM = re.compile(
    r"^\s*(bye|tbd|tba|n/?a|team|teams|home|away|date|time|court|gym|venue|"
    r"week \d+|game \d+|round \d+|schedule|standings|notes?|updated.*)\s*$",
    re.I,
)


def looks_like_team(cell):
    c = (cell or "").strip()
    if len(c) < 3 or len(c) > 90:
        return False
    if POOL_HEADER.match(c) or NOT_A_TEAM.match(c):
        return False
    if not re.search(r"[A-Za-z]{2}", c):
        return False
    # Pure dates/scores/times are schedule debris.
    if re.match(r"^[\d\s:/\-\.apm]+$", c, re.I):
        return False
    # Spreadsheet formulas and embedded links leak through as cell text
    # (e.g. 'I("http...")' from a HYPERLINK call) - never team names.
    if re.search(r"https?://|www\.|^[=+@]|\b(HYPERLINK|IMPORTRANGE|VLOOKUP)\b", c, re.I):
        return False
    if c.count('"') >= 2 or c.count("(") != c.count(")"):
        return False
    return True


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "."
    files = sorted(f for f in os.listdir(src) if f.endswith(".csv"))
    if not files:
        print(f"no CSVs in {src}", file=sys.stderr)
        return 1

    entries = []
    per_division = {}
    for fn in files:
        division = os.path.splitext(fn)[0].replace("_", " ")
        seen = set()
        with open(os.path.join(src, fn), encoding="utf-8", errors="replace") as f:
            for row in csv.reader(f):
                for cell in row:
                    if looks_like_team(cell):
                        t = cell.strip()
                        if t not in seen:
                            seen.add(t)
                            entries.append({
                                "team": t,
                                "club_stem": club_stem(t),
                                "division": division,
                            })
        per_division[division] = len(seen)

    clubs = defaultdict(list)
    for e in entries:
        key = norm_full(e["club_stem"])
        if key:
            clubs[key].append(e)

    out = {
        "source": "OBA OBL division schedule Google Sheets (public CSV export)",
        "source_page": "https://basketball.on.ca/competitions/obl/ontario-basketball-league-schedule-2/",
        "fetched": "2026-08-14",
        "divisions_fetched": len(files),
        "team_entries": len(entries),
        "distinct_club_stems": len(clubs),
        "per_division_team_counts": per_division,
        "clubs": sorted(
            (
                {
                    "club": Counter(e["club_stem"] for e in v).most_common(1)[0][0],
                    "team_entries": len(v),
                    "divisions": sorted({e["division"] for e in v}),
                    "teams": sorted({e["team"] for e in v}),
                }
                for v in clubs.values()
            ),
            key=lambda c: -c["team_entries"],
        ),
    }

    dest = os.path.join(ROOT, "docs", "research", "raw", "obl-division-teams.json")
    json.dump(out, open(dest, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    print(f"divisions      {len(files)}")
    print(f"team entries   {len(entries)}")
    print(f"distinct clubs {len(clubs)}")
    print(f"\nwrote {dest}")
    print("\ntop clubs by team entries:")
    for c in out["clubs"][:15]:
        print(f"   {c['team_entries']:3d}  {c['club']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
