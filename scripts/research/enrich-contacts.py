#!/usr/bin/env python3
"""
Pull contact details off club websites we already know about.

Reads docs/research/consolidated/clubs-consolidated.csv, fetches the site of any
club missing an email or phone, and extracts mailto:/tel:/social links from the
homepage plus a few conventional contact paths.

    python3 scripts/research/enrich-contacts.py [--limit N] [--workers N]

Every fetch is cached in docs/research/raw/website-contact-cache.json, so re-runs
cost nothing and a interrupted run resumes where it stopped. Results are written
to docs/research/raw/website-contact-enrichment.json; the consolidation script
picks them up as another source.

Deliberately polite: modest concurrency, short timeouts, one retry, and a real
User-Agent identifying the crawler.
"""

import argparse
import csv
import json
import os
import re
import signal
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "docs", "research", "consolidated", "clubs-consolidated.csv")
RAW = os.path.join(ROOT, "docs", "research", "raw")
CACHE = os.path.join(RAW, "website-contact-cache.json")
OUT = os.path.join(RAW, "website-contact-enrichment.json")

UA = "SportsHubResearchBot/1.0 (club directory research; contact via ysportshub.com)"
CONTACT_PATHS = ["", "/contact", "/contact-us", "/contactus", "/about", "/about-us"]

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
TEL_RE = re.compile(r"tel:\+?([0-9\-\.\s\(\)]{7,})", re.I)
# The leading (?<![\d.]) matters: without it this matches the digits after the
# decimal point in CSS values like `line-height:1.4285714286`, which yields a
# 10-digit string with a valid area code and no way to reject it downstream.
PHONE_RE = re.compile(
    r"(?<![\d.])(?:\+?1[\s\-\.]?)?\(?([2-9]\d{2})\)?[\s\-\.]?(\d{3})[\s\-\.]?(\d{4})(?![\d.])"
)
SOCIAL_RE = re.compile(
    r"https?://(?:www\.)?(instagram\.com|facebook\.com|x\.com|twitter\.com)/([A-Za-z0-9_.\-]{2,40})", re.I
)

# Addresses that are never a club's own contact point.
JUNK_EMAIL = re.compile(
    r"(sentry|wixpress|example\.|\.png|\.jpg|\.jpeg|\.gif|\.svg|\.webp|\.css|\.js|"
    r"@sentry|godaddy|squarespace|@2x|domain\.com|email\.com|yourdomain)", re.I
)

# Facebook/Instagram URL segments that are site plumbing, not a club's handle.
JUNK_HANDLE = {
    "sharer", "share", "home", "pages", "profile", "profile.php", "tr", "plugins",
    "dialog", "about", "ad_campaign", "permalink.php", "groups", "events", "login",
    "help", "privacy", "policies", "settings", "watch", "reel", "story.php",
    "hashtag", "search", "explore", "accounts", "legal", "business", "developers",
    "careers", "lite", "reg", "cookie", "cookies", "terms", "media", "video",
    "photo", "photos", "notes", "posts", "people", "marketplace", "gaming",
}


# Every Canadian area code. Page source is full of 10-digit numbers that are not
# phone numbers at all - CSS transform matrices and easing constants gave us
# 9396926208 (sin 70 degrees), 6865234375 and 9013671875 (power-of-two
# fractions), 4285714286 (3/7). Checking the area code against the real NANP
# assignments for Canada rejects all of them, where digit-pattern heuristics did
# not. A wrong number here would send a club's verification code to a stranger,
# so a US-numbered Canadian club is an acceptable loss.
CANADIAN_AREA_CODES = {
    "204", "226", "236", "249", "250", "263", "289", "306", "343", "354", "365",
    "367", "368", "382", "387", "403", "416", "418", "428", "431", "437", "438",
    "450", "468", "474", "506", "514", "519", "548", "579", "581", "584", "587",
    "604", "613", "639", "647", "672", "683", "705", "709", "742", "753", "778",
    "780", "782", "807", "819", "825", "867", "873", "902", "905",
}


# Cloudflare's email-protection obfuscation. The rendered page shows
# "[email protected]" but the HTML carries the address hex-encoded, XORed against
# the first byte. Without decoding this we silently miss every email on a
# Cloudflare-protected site - one club alone had 7 role addresses hidden here.
CFEMAIL_RE = re.compile(r'data-cfemail="([0-9a-fA-F]+)"')


def decode_cfemail(hexstr):
    try:
        key = int(hexstr[:2], 16)
        return "".join(chr(int(hexstr[i:i + 2], 16) ^ key) for i in range(2, len(hexstr), 2))
    except (ValueError, IndexError):
        return ""


# Club-management vendors. A dead club site often redirects to its vendor's
# marketing page, and scraping that attributes the VENDOR's social accounts and
# contact details to the club - two clubs ended up with "FB @StackSports".
VENDOR_HOSTS = re.compile(
    r"(stacksports|pointstreak|sportngin|sportsengine|teamsnap|leagueapps|crossbar|"
    r"powerupsports|uplifterinc|teampages|goalline|rampinteractive|sportsavvy)"
    r"\.(com|ca|org)",
    re.I,
)
VENDOR_HANDLE = re.compile(
    r"^(stacksports|pointstreak|sportngin|sportsengine|teamsnap|leagueapps|crossbar|"
    r"powerupsports|uplifter|teampages|goalline|ramp|sportsavvy|wix|squarespace|godaddy)",
    re.I,
)


def is_vendor_root(url):
    """True only for a vendor's own marketing site, not a club hosted on one.

    stacksports.com  -> True  (dead club sites redirect here; scraping it gave
                               two clubs the handle "FB @StackSports")
    lmba.powerupsports.com -> False (that IS the club's real page)
    """
    host = re.sub(r"^https?://", "", (url or "").strip().lower()).split("/")[0].split(":")[0]
    host = host.removeprefix("www.")
    return bool(VENDOR_HOSTS.fullmatch(host))


def clean_phone(raw):
    """Normalise to 10 digits, or return '' if it is not a real Canadian number."""
    d = re.sub(r"\D", "", raw or "")
    if len(d) == 11 and d.startswith("1"):
        d = d[1:]
    if len(d) != 10:
        return ""
    if d[:3] not in CANADIAN_AREA_CODES:
        return ""
    if d[3] in "01":                       # invalid NANP exchange code
        return ""
    if len(set(d)) <= 2:                   # 1111111111, 1212121212
        return ""
    if re.search(r"(\d)\1{4}", d):         # 5+ identical digits in a row
        return ""
    return d


def fetch(url, timeout=12):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-CA,en;q=0.9,fr-CA;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        ct = (r.headers.get("Content-Type") or "").lower()
        if "html" not in ct and "text" not in ct:
            return "", r.geturl()
        return r.read(400_000).decode("utf-8", errors="replace"), r.geturl()


def normalise_site(site):
    s = (site or "").strip()
    if not s:
        return ""
    if not s.startswith("http"):
        s = "https://" + s
    return s.rstrip("/")


def harvest(site):
    """Return {emails, phones, socials, pages_ok, error} for one club site."""
    base = normalise_site(site)
    if not base:
        return None
    emails, phones, socials, ok = set(), set(), set(), 0
    err = ""
    for path in CONTACT_PATHS:
        try:
            html, final_url = fetch(base + path)
        except (urllib.error.URLError, urllib.error.HTTPError, OSError, ValueError) as e:
            err = err or f"{type(e).__name__}: {str(e)[:70]}"
            continue
        if not html:
            continue
        # A redirect onto a vendor's ROOT marketing site is not this club. A
        # club's own tenant ON a vendor (lmba.powerupsports.com) is legitimate
        # and common - rejecting those cost ~100 clubs their contacts.
        if is_vendor_root(final_url) and not is_vendor_root(base):
            err = err or f"redirects to vendor marketing site: {final_url[:60]}"
            continue
        ok += 1
        for enc in CFEMAIL_RE.findall(html):
            dec = decode_cfemail(enc)
            if dec and EMAIL_RE.fullmatch(dec) and not JUNK_EMAIL.search(dec):
                emails.add(dec.lower())
        for m in EMAIL_RE.findall(html):
            if not JUNK_EMAIL.search(m) and len(m) < 90:
                emails.add(m.lower())
        for m in TEL_RE.findall(html):
            p = clean_phone(m)
            if p:
                phones.add(p)
        # Body-text numbers only count when they sit near a phone label. A bare
        # 10-digit regex over page source also matches CSS/JS constants that
        # happen to carry a valid area code (4285714286 is 3/7, and 428 is a
        # real New Brunswick code, so digit checks alone cannot reject it).
        for m in PHONE_RE.finditer(html):
            p = clean_phone("".join(m.groups()))
            if not p:
                continue
            ctx = html[max(0, m.start() - 200):m.end() + 60].lower()
            if re.search(r"phone|tel\b|telephone|call us|contact us|mobile|cell|fax", ctx):
                phones.add(p)
        for host, handle in SOCIAL_RE.findall(html):
            h = handle.lower().rstrip(".")
            if (h not in JUNK_HANDLE and not h.endswith(".php") and len(h) >= 3
                    and not VENDOR_HANDLE.match(h)):
                socials.add(f"{'IG' if 'insta' in host.lower() else 'FB'} @{handle}")
        # Homepage alone is usually enough; stop early once we have both.
        if emails and phones:
            break
    return {
        "emails": sorted(emails)[:5],
        "phones": sorted(phones)[:3],
        "socials": sorted(socials)[:4],
        "pages_ok": ok,
        "error": "" if ok else err,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--retry-failed", action="store_true",
                    help="re-fetch only sites whose cached result has no successful page")
    args = ap.parse_args()

    rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
    targets = [
        r for r in rows
        if r["website"].strip() and not (r["email"].strip() and r["phone"].strip())
    ]
    if args.limit:
        targets = targets[: args.limit]

    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}

    # Never clear this cache to "start fresh": a failed fetch is often the site
    # throttling us, and re-crawling everything repeatedly makes it worse (three
    # back-to-back full runs took reachable sites from 496 down to 441). Retry
    # only what failed, so successes are preserved and hosts get a rest.
    def cached_ok(site):
        got = cache.get(normalise_site(site))
        return bool(got and got.get("pages_ok"))

    if args.retry_failed:
        todo = [r for r in targets if not cached_ok(r["website"])]
        print(f"retrying {len(todo)} previously-failed sites (successes kept)")
    else:
        todo = [r for r in targets if normalise_site(r["website"]) not in cache]
    print(f"targets {len(targets)}  cached {len(targets)-len(todo)}  to fetch {len(todo)}")

    def save():
        json.dump(cache, open(CACHE, "w", encoding="utf-8"), indent=0)

    # Persist whatever we have if the run is interrupted.
    signal.signal(signal.SIGINT, lambda *_: (save(), sys.exit(130)))

    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(harvest, r["website"]): r for r in todo}
        for fut in as_completed(futs):
            r = futs[fut]
            key = normalise_site(r["website"])
            try:
                cache[key] = fut.result()
            except Exception as e:  # a single bad site must not kill the run
                cache[key] = {"emails": [], "phones": [], "socials": [], "pages_ok": 0,
                              "error": f"{type(e).__name__}: {str(e)[:70]}"}
            done += 1
            if done % 25 == 0:
                print(f"  {done}/{len(todo)}")
                save()
    save()

    # Emit for EVERY club whose site we have ever fetched, not just this run's
    # targets. A club that gained both an email and a phone stops being a target,
    # and if the output only covered targets it would drop out of this file - and
    # since consolidation rebuilds from source every time, the contact the scrape
    # supplied would silently vanish on the next run.
    enriched = []
    for r in [x for x in rows if x["website"].strip()]:
        got = cache.get(normalise_site(r["website"]))
        if not got or not (got["emails"] or got["phones"] or got["socials"]):
            continue
        enriched.append({
            "club": r["club_name"],
            "province": r["province"],
            "city": r["city"],
            "website": r["website"],
            "email": got["emails"][0] if got["emails"] and not r["email"].strip() else r["email"],
            "phone": got["phones"][0] if got["phones"] and not r["phone"].strip() else r["phone"],
            "all_emails": got["emails"],
            "social": "; ".join(got["socials"]),
            "evidence_url": normalise_site(r["website"]),
        })

    json.dump({
        "fetched": "2026-08-14",
        "method": "homepage + conventional contact paths, mailto:/tel:/social extraction",
        "sites_attempted_this_run": len(targets),
        "sites_in_cache": len(cache),
        "sites_reachable": sum(1 for k in cache.values() if k.get("pages_ok")),
        "clubs_enriched": len(enriched),
        "clubs": enriched,
    }, open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    newmail = sum(1 for e in enriched if e["email"])
    newphone = sum(1 for e in enriched if e["phone"])
    newsocial = sum(1 for e in enriched if e["social"])
    print(f"\nsites attempted   {len(targets)}")
    print(f"sites reachable   {sum(1 for k in cache.values() if k.get('pages_ok'))}")
    print(f"clubs enriched    {len(enriched)}   (email {newmail}, phone {newphone}, social {newsocial})")
    print(f"\nwrote {OUT}")


if __name__ == "__main__":
    main()
