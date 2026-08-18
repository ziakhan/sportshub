#!/usr/bin/env python3
"""
Geocode clubs that have no coordinates, using the Google Geocoding API.

    export GOOGLE_GEOCODING_API_KEY=...        # or put it in apps/web/.env.local
    python3 scripts/research/geocode-clubs.py [--limit N] [--dry-run]

The key MUST be a server-side key: create a separate credential with the
Geocoding API enabled and Application restrictions set to "None" or "IP
addresses". A browser key with HTTP-referrer restrictions returns
REQUEST_DENIED ("API keys with referer restrictions cannot be used with this
API") - that is what the existing NEXT_PUBLIC_GOOGLE_PLACES_API_KEY does.

Every response is cached in docs/research/raw/geocode-cache.json keyed by the
query string, so re-runs cost nothing and an interrupted run resumes. Results
land in docs/research/raw/geocoded-clubs.json, which the consolidation script
reads as an enrichment source.

Google bills per request (~$5/1000), so the cache is not an optimisation - it is
the thing that stops a re-run from spending money twice.
"""

import argparse
import csv
import json
import os
import re
import signal
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "docs", "research", "consolidated", "clubs-consolidated.csv")
RAW = os.path.join(ROOT, "docs", "research", "raw")
CACHE = os.path.join(RAW, "geocode-cache.json")
OUT = os.path.join(RAW, "geocoded-clubs.json")

ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json"

# Google returns a result for almost any string; these types mean it fell back to
# something too coarse to place a club on a map.
TOO_COARSE = {"country", "administrative_area_level_1", "political"}


def load_key():
    key = os.environ.get("GOOGLE_GEOCODING_API_KEY", "").strip()
    if key:
        return key
    envfile = os.path.join(ROOT, "apps", "web", ".env.local")
    if os.path.exists(envfile):
        for line in open(envfile, encoding="utf-8"):
            if line.startswith("GOOGLE_GEOCODING_API_KEY"):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def clean_place(value):
    """Strip the editorial notes researchers leave inside city fields.

    A parenthetical is a note, not part of the address, and feeding it to the
    geocoder actively misleads: "HAMILTON ON (not Toronto)" resolved to downtown
    Toronto because Google matched the word inside the brackets. Multi-town
    clubs write "Oshawa/Whitby/Ajax" - geocode the first named place.
    """
    v = re.sub(r"\([^)]*\)", " ", value or "")
    v = re.split(r"[/,;&+]| and ", v)[0]
    return " ".join(v.split()).strip(" -,")


def build_query(row):
    """Most specific location string we can form for this club."""
    address = (row.get("address") or "").strip()
    city = clean_place(row.get("city", ""))
    bits = [b for b in (address, city) if b]
    if not bits:
        return ""  # nothing to geocode - a name alone is not a location
    prov = row.get("province", "").strip()
    return ", ".join(bits + ([prov] if prov else []) + ["Canada"])


def geocode(query, key, timeout=20):
    url = f"{ENDPOINT}?{urllib.parse.urlencode({'address': query, 'key': key, 'region': 'ca'})}"
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.load(r)


def pick_result(payload):
    """-> dict or None. Rejects results too coarse to be useful."""
    if payload.get("status") != "OK" or not payload.get("results"):
        return None
    res = payload["results"][0]
    types = set(res.get("types", []))
    if types and types <= TOO_COARSE:
        return None
    loc = res["geometry"]["location"]
    comp = {c["types"][0]: c["long_name"] for c in res.get("address_components", []) if c.get("types")}
    return {
        "lat": loc["lat"],
        "lon": loc["lng"],
        "formatted_address": res.get("formatted_address", ""),
        "place_id": res.get("place_id", ""),
        "location_type": res["geometry"].get("location_type", ""),
        "postal_code": comp.get("postal_code", ""),
        "resolved_city": comp.get("locality") or comp.get("administrative_area_level_2", ""),
        "resolved_province": comp.get("administrative_area_level_1", ""),
        "types": sorted(types),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--dry-run", action="store_true",
                    help="report how many would be geocoded and the cost, call nothing")
    ap.add_argument("--qps", type=float, default=10.0, help="requests per second")
    ap.add_argument("--refresh", action="store_true",
                    help="also re-geocode clubs whose query string has changed")
    args = ap.parse_args()

    rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
    cache_peek = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    targets = []
    skipped_no_location = 0
    for r in rows:
        # --refresh re-geocodes a club that already has coordinates IF the query
        # we would now send differs from anything cached. Used after fixing how
        # queries are built: stripping "(not Toronto)"-style notes from cities
        # changed 151 queries, and those clubs were holding wrong coordinates.
        if r.get("lat", "").strip():
            if not (args.refresh and build_query(r) and build_query(r) not in cache_peek):
                continue                  # already has coordinates (e.g. OBA KML)
        q = build_query(r)
        if not q:
            skipped_no_location += 1
            continue
        targets.append((r, q))
    if args.limit:
        targets = targets[: args.limit]

    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    todo = [(r, q) for r, q in targets if q not in cache]

    print(f"clubs without coordinates : {sum(1 for r in rows if not r.get('lat','').strip())}")
    print(f"  no address AND no city  : {skipped_no_location}  (nothing to geocode)")
    print(f"  geocodable              : {len(targets)}")
    print(f"  already cached          : {len(targets) - len(todo)}")
    print(f"  TO FETCH                : {len(todo)}   (~${len(todo) * 0.005:.2f})")

    if args.dry_run:
        print("\ndry run - no API calls made")
        for r, q in todo[:5]:
            print(f"   {r['club_name'][:34]:34} -> {q}")
        return 0

    key = load_key()
    if not key:
        print("\nNo GOOGLE_GEOCODING_API_KEY found (env or apps/web/.env.local).", file=sys.stderr)
        print("This needs a SERVER-SIDE key: Geocoding API enabled, application", file=sys.stderr)
        print("restrictions None or IP - a referrer-restricted browser key is refused.", file=sys.stderr)
        return 2

    def save():
        json.dump(cache, open(CACHE, "w", encoding="utf-8"), indent=0)

    signal.signal(signal.SIGINT, lambda *_: (save(), sys.exit(130)))

    delay = 1.0 / max(args.qps, 0.1)
    done = denied = 0
    for r, q in todo:
        try:
            payload = geocode(q, key)
        except (urllib.error.URLError, OSError, ValueError) as e:
            cache[q] = {"error": f"{type(e).__name__}: {str(e)[:80]}"}
            done += 1
            continue
        status = payload.get("status")
        if status == "REQUEST_DENIED":
            # Wrong key type or API not enabled - stop rather than burn the list.
            print(f"\nREQUEST_DENIED: {payload.get('error_message','')}", file=sys.stderr)
            save()
            return 2
        if status == "OVER_QUERY_LIMIT":
            print("\nOVER_QUERY_LIMIT - backing off 5s", file=sys.stderr)
            time.sleep(5)
            continue
        got = pick_result(payload)
        cache[q] = got or {"error": f"no usable result ({status})"}
        if not got:
            denied += 1
        done += 1
        if done % 50 == 0:
            print(f"  {done}/{len(todo)}")
            save()
        time.sleep(delay)
    save()

    out = []
    for r, q in targets:
        got = cache.get(q)
        if not got or got.get("error"):
            continue
        out.append({
            "club": r["club_name"], "province": r["province"], "city": r["city"],
            "query": q, **{k: got[k] for k in
                           ("lat", "lon", "formatted_address", "place_id",
                            "postal_code", "location_type", "resolved_city",
                            "resolved_province")},
        })
    json.dump({"fetched_with": "google-geocoding-api", "count": len(out), "clubs": out},
              open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    mismatched = sum(1 for o in out
                     if o["resolved_province"] and o["province"]
                     and o["resolved_province"][:3].lower() not in o["province"][:3].lower())
    print(f"\ngeocoded            {len(out)}")
    print(f"no usable result    {denied}")
    print(f"province mismatch   {mismatched}  <- worth reviewing: Google placed these "
          f"in a different province than we recorded")
    print(f"\nwrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
