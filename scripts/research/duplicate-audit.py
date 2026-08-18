#!/usr/bin/env python3
"""
Estimate how many duplicate clubs are LEFT, and list them for spot-checking.

    python3 scripts/research/duplicate-audit.py

Deduplication has no ground truth, so "it worked" is only defensible if the
remaining suspects can be counted and eyeballed. This applies a duplicate test
close to what a person uses — a shared DISTINCTIVE word plus a compatible
town — and writes every hit to a file you can scan.

The distinctive part matters. A naive "share a significant word" rule flags
"Oakville Basketball Club" against "Oakville Panthers", because the town name is
in both; it produced 699 false hits. Place names and generic basketball words
carry no identity, so they are excluded and only the real brand word counts.
"""

import csv
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "docs", "research", "consolidated")
SRC = os.path.join(OUT, "clubs-consolidated.csv")
MUNI = os.path.join(ROOT, "docs", "research", "raw", "canada-municipalities.json")

GENERIC = {
    "basketball", "club", "association", "academy", "minor", "youth", "the", "of",
    "inc", "sports", "sport", "ba", "bc", "bball", "program", "programs", "athletics",
    "and", "society", "assoc", "organization", "org", "canada", "ontario", "league",
    "hoops", "group", "elite", "prep", "select", "rep", "house", "community",
    "recreation", "recreational", "centre", "center", "school", "high", "junior",
    "senior", "boys", "girls", "team", "teams", "national", "regional", "district",
    "county", "region", "north", "south", "east", "west", "central", "st", "saint",
}


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def norm(s):
    s = strip_accents((s or "").replace("&amp;", "&")).lower()
    s = re.sub(r"\([^)]*\)", " ", s)
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", s).split())


def load_places():
    """Municipality names, so a town in a club's name is not mistaken for its brand."""
    places = set()
    if os.path.exists(MUNI):
        for m in json.load(open(MUNI, encoding="utf-8")).get("municipalities", []):
            for tok in norm(m.get("name", "")).split():
                if len(tok) > 2:
                    places.add(tok)
    return places


def main():
    places = load_places()
    rows = [r for r in csv.DictReader(open(SRC, encoding="utf-8"))]

    def brand(name):
        return {
            t for t in norm(name).split()
            if len(t) > 2 and t not in GENERIC and t not in places
        }

    def city_places(v):
        v = re.sub(r"\([^)]*\)", " ", v or "")
        return {norm(x) for x in re.split(r"[/,;&+]| and ", v) if len(norm(x)) >= 3}

    def cities_ok(a, b):
        pa, pb = city_places(a), city_places(b)
        if not pa or not pb:
            return True  # unknown is not a disagreement
        return any(x == y or x in y or y in x for x in pa for y in pb)

    by_prov = defaultdict(list)
    for r in rows:
        by_prov[r["province"]].append(r)

    suspects = []
    for prov, lst in by_prov.items():
        for i in range(len(lst)):
            for j in range(i + 1, len(lst)):
                a, b = lst[i], lst[j]
                ba, bb = brand(a["club_name"]), brand(b["club_name"])
                if not ba or not bb:
                    continue
                shared = ba & bb
                if not shared:
                    continue
                # Every distinctive word of the shorter name appears in the longer
                # one: "Monarchs" inside "Monarchs Basketball", not merely an
                # overlap like "Elite Storm" vs "Storm Elite Academy".
                short, long_ = (ba, bb) if len(ba) <= len(bb) else (bb, ba)
                if not short <= long_:
                    continue
                if not cities_ok(a["city"], b["city"]):
                    continue
                # One side holding contact details the other lacks is the pattern
                # a person spots instantly: the same club, entered twice.
                a_has = bool(a["email"].strip() or a["phone"].strip())
                b_has = bool(b["email"].strip() or b["phone"].strip())
                suspects.append({
                    "province": prov,
                    "club_a": a["club_name"], "city_a": a["city"],
                    "contact_a": a["email"] or a["phone"] or "",
                    "club_b": b["club_name"], "city_b": b["city"],
                    "contact_b": b["email"] or b["phone"] or "",
                    "shared_words": " ".join(sorted(shared)),
                    "complementary": "yes" if a_has != b_has else "",
                    "same_contact": "yes" if (a_has and b_has and
                                              (a["email"] or "!").lower() == (b["email"] or "?").lower()) else "",
                    "verdict": "", "reviewer": "", "notes": "",
                })

    suspects.sort(key=lambda s: (not s["same_contact"], not s["complementary"], s["club_a"]))
    path = os.path.join(OUT, "duplicate-suspects.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(suspects[0].keys()))
        w.writeheader()
        w.writerows(suspects)

    total = len(rows)
    involved = len({s["club_a"] for s in suspects} | {s["club_b"] for s in suspects})
    print(f"clubs in the census        {total}")
    print(f"suspect duplicate pairs    {len(suspects)}")
    print(f"clubs involved in a pair   {involved}  ({100*involved//max(total,1)}% of the file)")
    print(f"  of those pairs, sharing a contact   {sum(1 for s in suspects if s['same_contact'])}")
    print(f"  one has contact, other does not     {sum(1 for s in suspects if s['complementary'])}")
    print(f"\nby province: "
          + ", ".join(f"{p}:{n}" for p, n in Counter(s['province'] for s in suspects).most_common(6)))
    print(f"\nwrote {path} — every pair, for spot-checking")
    print("\ntop suspects:")
    for s in suspects[:12]:
        print(f"   [{s['shared_words'][:14]:14}] {s['club_a'][:30]:30} @{s['city_a'][:12]:12}"
              f" VS {s['club_b'][:30]:30} @{s['city_b'][:12]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
