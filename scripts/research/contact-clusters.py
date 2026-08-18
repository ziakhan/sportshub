#!/usr/bin/env python3
"""
Find clubs that share a contact, and work out WHY.

    python3 scripts/research/contact-clusters.py

Name matching cannot see that "Gators Elite" and "Durham Gators Basketball" are
related. A shared email can. But a shared email means one of three quite
different things, and they need opposite handling before anyone claims a club:

  DUPLICATE       one club written several ways ("Brantford CYO Hawks",
                  "Brantford CYO Boys", "Brantford Hawks"). MUST merge - if an
                  owner claims one, the others linger as orphan listings.

  BRANCH-NETWORK  one operator running city-branded branches (IEM Newmarket /
                  Aurora / Bradford ..., Gators / Durham Gators). Must NOT merge
                  - they are real, separately-named organisations - but whoever
                  holds that address can legitimately claim all of them.

  SHARED-OPERATOR unrelated clubs administered by one person or umbrella (six
                  Newfoundland clubs on jon@rocksports.ca). Must NOT merge, and
                  one claimant taking all of them is worth a human look.

Writes docs/research/consolidated/contact-clusters.csv.
"""

import csv
import difflib
import os
import re
import sys
from collections import defaultdict
from importlib import util as _util

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "docs", "research", "consolidated")

_spec = _util.spec_from_file_location("consolidate", os.path.join(HERE, "consolidate-clubs.py"))
_c = _util.module_from_spec(_spec)
_spec.loader.exec_module(_c)

# Generic words that do not make two club names "the same brand".
GENERIC = _c.NOISE | {"elite", "prep", "academy", "select", "basketball", "bball"}


def brand_tokens(name):
    return {t for t in _c.norm_full(name).split() if t not in GENERIC and len(t) > 2}


def initials(key):
    """'york north basketball association' -> 'ynba'."""
    toks = key.split()
    return "".join(t[0] for t in toks) if len(toks) > 1 else ""


def same_org_name(a, b):
    """One club written two ways - including acronym vs expansion.

    String similarity cannot see that YNBA is York North Basketball
    Association, or SBA is Scarborough Basketball Association, so those kept
    landing in SHARED-OPERATOR. Acronyms are how half this dataset writes club
    names, so they need an explicit rule.
    """
    if difflib.SequenceMatcher(None, a, b).ratio() >= 0.72:
        return True
    if _c.is_name_prefix_variant(a, b):
        return True
    # "YNBA" vs "YNBA Basketball". The general prefix rule needs two tokens on
    # both sides so a bare city name cannot swallow every club in it, but a
    # 4+ character acronym followed only by generic words is unambiguous.
    ta, tb = a.split(), b.split()
    short, long_ = (ta, tb) if len(ta) < len(tb) else (tb, ta)
    if (len(short) == 1 and len(short[0]) >= 4 and long_[:1] == short
            and all(t in GENERIC for t in long_[1:])):
        return True
    ia, ib = initials(a), initials(b)
    # One side IS the other's initials, or both reduce to the same acronym.
    if ia and (ia == b.replace(" ", "") or ia == ib):
        return True
    if ib and ib == a.replace(" ", ""):
        return True
    # An acronym appearing as a token in the other name: "SBA Blues" vs
    # "Scarborough Basketball Association".
    if ia and ia in b.split():
        return True
    if ib and ib in a.split():
        return True
    return False


def classify(names):
    """DUPLICATE | BRANCH-NETWORK | SHARED-OPERATOR for a set of club names."""
    keys = [_c.norm_full(n) for n in names]

    # Most pairs reading as the same organisation is enough. Demanding EVERY
    # pair match let a single odd member veto the whole group: the five YNBA
    # spellings were classed as unrelated because "York Region" sat among them.
    pairs = [(a, b) for i, a in enumerate(keys) for b in keys[i + 1:]]
    if pairs:
        agree = sum(1 for a, b in pairs if same_org_name(a, b)) / len(pairs)
        if agree >= 0.6:
            return "DUPLICATE"

    # A shared distinctive brand token across all of them, but names differing
    # (usually by city) -> branches of one operator.
    common = set.intersection(*[brand_tokens(n) for n in names]) if names else set()
    if common:
        return "BRANCH-NETWORK"

    return "SHARED-OPERATOR"


def main():
    src = os.path.join(OUT, "clubs-consolidated.csv")
    rows = list(csv.DictReader(open(src, encoding="utf-8")))

    def phone_key(p):
        d = re.sub(r"\D", "", p or "")
        return d[-10:] if len(d) >= 10 else ""

    groups = defaultdict(list)
    for r in rows:
        if r["email"].strip():
            groups[("email", r["email"].strip().lower())].append(r)
        pk = phone_key(r["phone"])
        if pk:
            groups[("phone", pk)].append(r)

    out, seen_signature = [], set()
    for (kind, value), members in groups.items():
        if len(members) < 2:
            continue
        names = [m["club_name"] for m in members]
        sig = (tuple(sorted(names)),)
        if sig in seen_signature:      # same set found by both email and phone
            continue
        seen_signature.add(sig)
        verdict = classify(names)
        cities = sorted({m["city"] for m in members if m["city"].strip()})
        out.append({
            "verdict": verdict,
            "shared_via": kind,
            "shared_value": value,
            "n_clubs": len(members),
            "clubs": " | ".join(names),
            "cities": " | ".join(cities),
            "provinces": " | ".join(sorted({m["province"] for m in members})),
            "multi_city": "yes" if len(cities) > 1 else "",
            "decision": "",       # human: merge | keep-separate | not-related
            "reviewer": "",
            "notes": "",
        })

    order = {"DUPLICATE": 0, "BRANCH-NETWORK": 1, "SHARED-OPERATOR": 2}
    out.sort(key=lambda x: (order[x["verdict"]], -x["n_clubs"]))

    path = os.path.join(OUT, "contact-clusters.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0].keys()))
        w.writeheader()
        w.writerows(out)

    counts = defaultdict(lambda: [0, 0])
    for o in out:
        counts[o["verdict"]][0] += 1
        counts[o["verdict"]][1] += o["n_clubs"]
    print(f"groups sharing a contact: {len(out)}\n")
    for v in ("DUPLICATE", "BRANCH-NETWORK", "SHARED-OPERATOR"):
        g, n = counts[v]
        print(f"  {v:16} {g:>4} groups  {n:>4} clubs")
    print(f"\n  multi-city groups: {sum(1 for o in out if o['multi_city'])}")
    print(f"\nwrote {path}")

    for v in ("DUPLICATE", "BRANCH-NETWORK", "SHARED-OPERATOR"):
        ex = [o for o in out if o["verdict"] == v][:4]
        if ex:
            print(f"\n{v}:")
            for o in ex:
                print(f"   {o['n_clubs']}x {o['clubs'][:88]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
