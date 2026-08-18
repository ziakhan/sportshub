#!/usr/bin/env python3
"""
Consolidate every local club source into one deduped master + a human audit queue.

Reads only. Writes only to docs/research/consolidated/. Touches no schema, no DB.

    python3 scripts/research/consolidate-clubs.py

Sources (all local, all optional - missing ones are skipped with a warning):
  docs/research/canada-master-sheet.xlsx        All Clubs sheet (1,178 rows, all provinces)
  docs/research/raw/oba-find-a-club-kml-verified.json   OBA affiliated clubs (Ontario)
  docs/research/raw/ontario-community-layer.json        community/house-league sweep
  docs/research/raw/ontario-missing-leagues.json        per-league club+team harvest

Outputs:
  docs/research/consolidated/clubs-consolidated.csv  one row per distinct org + provenance
  docs/research/consolidated/audit-queue.csv         merge candidates for a human to rule on
  docs/research/consolidated/summary.json            counts by province/source/decision
"""

import csv
import difflib
import html
import json
import os
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "docs", "research", "consolidated")

# ---------------------------------------------------------------- xlsx reader

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def read_xlsx_sheet(path, sheet_name):
    z = zipfile.ZipFile(path)
    shared = []
    try:
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")):
            shared.append("".join(t.text or "" for t in si.iter(NS + "t")))
    except KeyError:
        pass
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    target = None
    for sh in wb.iter(NS + "sheet"):
        if sh.get("name") == sheet_name:
            target = rels[sh.get(RID)].lstrip("/")
            break
    if target is None:
        raise KeyError(f"{sheet_name} not in {path}")
    if not target.startswith("xl/"):
        target = "xl/" + target
    rows = []
    for row in ET.fromstring(z.read(target)).iter(NS + "row"):
        cells = {}
        for c in row.iter(NS + "c"):
            col = re.match(r"[A-Z]+", c.get("r")).group()
            v, inline = c.find(NS + "v"), c.find(NS + "is")
            if c.get("t") == "s" and v is not None:
                val = shared[int(v.text)]
            elif inline is not None:
                val = "".join(t.text or "" for t in inline.iter(NS + "t"))
            else:
                val = (v.text or "") if v is not None else ""
            cells[col] = val
        rows.append(cells)

    def idx(col):
        n = 0
        for ch in col:
            n = n * 26 + ord(ch) - 64
        return n - 1

    width = max((idx(k) for r in rows for k in r), default=0) + 1

    def name(i):
        return chr(65 + i) if i < 26 else chr(64 + i // 26) + chr(65 + i % 26)

    grid = [[r.get(name(i), "") for i in range(width)] for r in rows]
    header = [h.strip() for h in grid[0]]
    return [dict(zip(header, r)) for r in grid[1:]]


# ------------------------------------------------------- name normalisation

# Dropped when comparing names: they carry no identity signal on their own.
NOISE = {
    "basketball", "club", "association", "academy", "minor", "youth", "the",
    "of", "inc", "sports", "sport", "ba", "mba", "bball", "program", "programs",
    "athletics", "and", "society", "assoc", "organization", "org", "canada",
    "ontario", "league", "hoops", "group",
}

# Team-name debris to strip before we try to recover the parent club stem.
AGE_RE = re.compile(
    # includes OBL's "BU14"/"GU16" division shorthand and bare "U14 - " prefixes
    r"\b([bg] ?u ?\d{1,2}|u ?\d{1,2}|under ?\d{1,2}|\d{1,2}u|gr(?:ade)? ?\d{1,2}|"
    r"jr|sr|junior|senior|major|minor|midget|bantam|atom|novice|mini|juvenile|cadet|prep|varsity)\b",
    re.I,
)
GENDER_RE = re.compile(r"\b(boys?|girls?|mens?|womens?|male|female|mixed|coed)\b", re.I)
POOL_RE = re.compile(r"\[[^\]]*\]|\((?:host club|pool [a-z]|#\d+)\)", re.I)
# Birth-year cohorts ("Cooksville 2012 CKATT") and bracketed coach names
# ("SCNYB U14 Boys ( Krzywicki )") are team detail, never club identity.
BIRTHYEAR_RE = re.compile(r"\b(19|20)\d{2}\b")
PAREN_NAME_RE = re.compile(r"\(\s*[A-Z][A-Za-z'\-]+\s*\)")
# Trailing coach surname, as in "EY Eagles U14 Boys - Rozario". Whitespace on
# BOTH sides is required: without it this eats real names like "All-In" -> "All".
TRAIL_RE = re.compile(r"\s+[-–—]\s+[A-Z][a-z]+\s*$")
HASH_RE = re.compile(r"#\s*\d+")


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def club_stem(raw):
    """Best-effort parent-club name from a possibly team-level string."""
    # Scraped names arrive HTML-encoded: "Mississauga Monarchs - D &amp; Hemeng"
    # is one club written with an entity and a coach's name attached.
    s = html.unescape(raw or "")
    s = POOL_RE.sub(" ", s)
    s = HASH_RE.sub(" ", s)
    s = PAREN_NAME_RE.sub(" ", s)
    s = BIRTHYEAR_RE.sub(" ", s)
    s = AGE_RE.sub(" ", s)
    s = GENDER_RE.sub(" ", s)
    s = re.sub(r"\(\s*\)", " ", s)          # "( )" left after stripping a coach
    s = re.sub(r"\s+", " ", s).strip(" -–—,")
    prev = None
    while prev != s:
        prev = s
        s = TRAIL_RE.sub("", s).strip(" -–—,")
    s = s.strip()
    # Never let stripping shred a name down to a stub - if it did, the original
    # string was not really team-shaped and should be kept intact for review.
    raw_clean = (raw or "").strip()
    if len(s) < 4 and len(raw_clean) > len(s):
        return raw_clean
    return s or raw_clean


def norm_full(s):
    """Scoring key: accents folded and punctuation dropped, but ALL words kept.

    Noise words stay in on purpose. Stripping them makes 'Calgary Academy Hoops'
    and 'Calgary Basketball Academy' both collapse to 'calgary', and reduces
    'Ontario Basketball Club' to nothing at all.
    """
    s = strip_accents(html.unescape(s or "")).lower()
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    toks = s.split()
    if not toks:  # name was entirely punctuation - fall back to the raw string
        toks = re.sub(r"[^a-z0-9 ]", " ", strip_accents(s or "").lower()).split()
    return " ".join(toks)


def name_keys(s):
    """All comparison keys for one name: the full form and its base form.

    Clubs get written both as "Org (Qualifier)" and "Org - Qualifier". norm_full
    drops the parenthetical but keeps the dashed suffix, so the two spellings
    scored 0.72 and did not even reach the review queue. Emitting a base key -
    everything before the first bracket or dash - lets the two meet exactly.
    """
    full = norm_full(s)
    base = norm_full(re.split(r"[(\[|:]|\s[-–—]\s", s or "", maxsplit=1)[0])
    return {k for k in (full, base) if k}


def initials(key):
    """'markham unionville minor basketball association' -> 'mumba'."""
    toks = key.split()
    return "".join(t[0] for t in toks) if len(toks) > 1 else ""


def is_acronym_of(short, long_):
    """True when `short` is how people abbreviate `long_`.

    Half this dataset writes clubs both ways and string similarity cannot see
    it: MUMBA scores 0.11 against "Markham Unionville Minor Basketball
    Association" yet is exactly its initials, so three rows for one Markham club
    survived every other rule. Also handles the acronym appearing as a token,
    as in "SBA Blues" vs "Scarborough Basketball Association".
    """
    s, l = short.replace(" ", ""), long_
    if len(s) < 3:
        return False  # 2-letter "acronyms" collide constantly
    ini = initials(l)
    if not ini:
        return False
    if s == ini:
        return True
    # Initials of only the significant words: "markham unionville minor
    # basketball association" -> also try dropping generic tail words.
    sig = [t for t in l.split() if t not in NOISE]
    if len(sig) > 1 and s == "".join(t[0] for t in sig):
        return True
    return s in short.split() and s == ini


def same_org_name(a, b):
    """One organisation written two ways — including acronym vs expansion."""
    if difflib.SequenceMatcher(None, a, b).ratio() >= 0.94:
        return True
    if is_entity_suffix_variant(a, b):
        return True
    short, long_ = (a, b) if len(a) < len(b) else (b, a)
    if is_acronym_of(short, long_):
        return True
    # "Monarchs" vs "Monarchs Basketball": the general prefix rule needs two
    # tokens on each side, which excludes a one-word club name followed only by
    # generic words.
    ts, tl = short.split(), long_.split()
    if (
        len(ts) == 1
        and len(ts[0]) >= 4
        and tl[: len(ts)] == ts
        and all(t in ENTITY_SUFFIX for t in tl[len(ts):])
    ):
        return True
    return False


def contact_keys(rec):
    """Normalised email / phone for this record, as merge evidence.

    Two rows sharing a contact are usually one club written twice — which is
    exactly the pattern a human spots instantly and string matching cannot.
    Used ONLY together with a compatible city, because a single address also
    legitimately covers a branch network (nine IEM branches share one inbox,
    six Newfoundland clubs share their operator's) and those are separate clubs
    in separate towns.
    """
    keys = set()
    e = (rec.get("email") or "").strip().lower()
    if e and "@" in e:
        keys.add("e:" + e)
    d = re.sub(r"\D", "", rec.get("phone") or "")
    if len(d) >= 10:
        keys.add("p:" + d[-10:])
    # The club's own web domain. Two rows can carry different emails yet the same
    # site: Mississauga Monarchs and Mississauga Minor Basketball Association
    # both point at monarchsbasketball.ca, which is the clearest possible signal
    # that they are one organisation. Shared platforms are excluded - a facebook
    # page says nothing about which club you are.
    host = registrable_host(rec.get("website"))
    if host and host not in SHARED_WEB_HOSTS:
        keys.add("w:" + host)
    return keys


SHARED_WEB_HOSTS = {
    "facebook.com", "instagram.com", "x.com", "twitter.com", "linktr.ee",
    "youtube.com", "tiktok.com", "wixsite.com", "wix.com", "weebly.com",
    "squarespace.com", "wordpress.com", "blogspot.com", "godaddysites.com",
    "google.com", "sites.google.com", "sportsengine.com", "sportngin.com",
    "teamlinkt.com", "teamsnap.com", "leagueapps.com", "crossbar.org",
    "rampinteractive.com", "sportsavvy.com", "powerupsports.com",
    "uplifterinc.com", "teampages.com", "goalline.ca", "tourneymachine.com",
    "esportsdesk.com", "stacksports.com", "pointstreak.com", "eventbrite.com",
}


def registrable_host(url):
    """eTLD+1 of a URL, handling Canadian two-part suffixes like .on.ca."""
    u = re.sub(r"^https?://", "", (url or "").strip().lower()).split("/")[0].split(":")[0]
    u = u[4:] if u.startswith("www.") else u
    parts = [p for p in u.split(".") if p]
    if len(parts) < 2:
        return ""
    if len(parts) >= 3 and parts[-2] in {"co", "com", "org", "net", "gov", "ac"} and len(parts[-1]) == 2:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def is_name_prefix_variant(a, b):
    """True when one normalised name is the other plus a trailing qualifier.

    "Cambridge Basketball" vs "Cambridge Basketball Association Inc." is one club
    written two ways, but scores only 0.73 on raw similarity because the suffix
    is long. Organisations routinely appear with and without "Association",
    "Club", "Inc.", so token-prefix containment is a much better signal here than
    edit distance. Requires the shorter side to carry at least two tokens, so
    "Toronto" does not swallow every club in the city.
    """
    ta, tb = a.split(), b.split()
    if len(ta) < 2 or len(tb) < 2 or ta == tb:
        return False
    short, long_ = (ta, tb) if len(ta) < len(tb) else (tb, ta)
    return long_[: len(short)] == short


# Pure entity/legal suffixes. If the ONLY difference between two names is these,
# it is the same organisation written two ways - "Barrie Royals" / "Barrie
# Royals BC", "Cambridge Basketball" / "Cambridge Basketball Association Inc."
# Deliberately excludes "academy", "prep" and "elite": those can distinguish a
# club's prep program from the club itself, which is a real distinction.
ENTITY_SUFFIX = {
    "association", "assoc", "assn", "club", "inc", "incorporated", "ltd",
    "society", "organization", "org", "ba", "bc", "bball", "basketball",
    "the", "of",
}


# Words that turn a club name into a programme name. Safe to ignore ONLY when
# the base is a distinctive brand: "Dream Chaserzzz" and "Dream Chaserzzz
# Academy" are one club, but "Oakville Prep" and "Oakville Basketball" are not,
# because "Oakville" identifies a town rather than an organisation.
PROGRAM_SUFFIX = {"academy", "elite", "prep", "preparatory", "training",
                  "development", "program", "programme", "programs"}


def has_distinctive_token(key, places=None):
    """True when the name contains a word that is neither generic nor a place."""
    global _PLACE_TOKENS
    if _PLACE_TOKENS is None:
        _PLACE_TOKENS = set()
        for names in (load_municipalities() or {}).values():
            for n in names:
                for t in norm_full(n).split():
                    if len(t) > 2:
                        _PLACE_TOKENS.add(t)
    return any(
        t not in NOISE and t not in ENTITY_SUFFIX and t not in PROGRAM_SUFFIX
        and t not in _PLACE_TOKENS and len(t) > 2
        for t in key.split()
    )


_PLACE_TOKENS = None


def is_entity_suffix_variant(a, b):
    """Prefix variant whose extra tokens are only entity (or programme) words."""
    if not is_name_prefix_variant(a, b):
        return False
    ta, tb = a.split(), b.split()
    short, long_ = (ta, tb) if len(ta) < len(tb) else (tb, ta)
    extra = long_[len(short):]
    if not extra:
        return False
    if all(t in ENTITY_SUFFIX for t in extra):
        return True
    # "... Academy" / "... Elite" only collapses onto a real brand name.
    allowed = ENTITY_SUFFIX | PROGRAM_SUFFIX
    return all(t in allowed for t in extra) and has_distinctive_token(" ".join(short))


def norm_strict(s):
    """Blocking key only: noise words removed to group plausible candidates.

    Never used for scoring, and never allowed to be empty - an empty strict key
    would silently drop the record.
    """
    full = norm_full(s)
    toks = [t for t in full.split() if t not in NOISE]
    return " ".join(toks) if toks else full


def blocking_keys(name):
    """Every bucket a name should be searched in.

    A single prefix bucket never lets an abbreviation meet its expansion:
    'EY Eagles' buckets under 'ey e' while 'East York Basketball' buckets under
    'east', so they are never even compared. Clubs in this data are routinely
    written both ways (EY/East York, NT/North Toronto, SCNYB/Scarborough), so we
    also index by initials and by first token. Extra candidates are safe - the
    0.94 scoring threshold still decides what actually merges; widening the
    buckets mainly means the discoveries file can name a closest match instead
    of leaving the reviewer with nothing.
    """
    strict = norm_strict(name)
    toks = strict.split()
    keys = {strict[:4]} if strict else {"~"}
    # Initials of the FULL name, noise words included: MUMBA is the acronym of
    # "Markham Unionville Minor BASKETBALL ASSOCIATION", so dropping the generic
    # words first yields "mu" and the two spellings never share a bucket.
    full_toks = norm_full(name).split()
    if len(full_toks) > 1:
        keys.add("".join(t[0] for t in full_toks))
    if toks:
        keys.add(toks[0])
        if len(toks) > 1:
            keys.add("".join(t[0] for t in toks))  # initials, e.g. 'east york' -> 'ey'
    return {k for k in keys if k}


# Values written by harvesters when they could NOT determine a city. Storing
# these as if they were places silently corrupts every geographic analysis -
# "gta" and "york region" were being filed under "Other Ontario".
PLACEHOLDER_CITY = re.compile(
    r"^(unconfirmed|unknown|unresolved|not ?found|n/?a|none|tbd|various|multi(ple)?|"
    r"ontario|canada|multi-?site|city not published|.*not published.*|.*unpublished.*)$",
    re.I,
)
# Region-level answers: not a city, but real geography worth keeping as region.
REGION_AS_CITY = {
    "gta": "GTA", "gta on": "GTA", "greater toronto": "GTA",
    "greater toronto area": "GTA", "toronto area": "GTA",
    "york region": "York Region", "durham region": "Durham Region",
    "peel region": "Peel Region", "halton region": "Halton Region",
    "fraser valley": "Fraser Valley", "lower mainland": "Lower Mainland",
}

# A club is Quebec's if its own city says so. Circuit sources (NPH, NSC, prep
# leagues) carry Quebec teams, and loaders that hardcode province="Ontario"
# quietly inflate Ontario and understate Quebec.
QC_CITY_RE = re.compile(
    r"\b(qc|quebec|québec|montreal|montréal|laval|gatineau|longueuil|sherbrooke|"
    r"trois[- ]rivi|saguenay|levis|lévis|terrebonne|brossard|repentigny|alma|"
    r"outaouais|monteregie|montérégie|rive[- ]nord|rive[- ]sud)\b",
    re.I,
)


# A contact is only a contact if we could actually send to it. These strings all
# arrived in the email column and all counted as "claimable": "via website" (28
# clubs, from the original census CSV), "[email protected]" (the literal text
# Cloudflare renders in place of an obfuscated address), "(form only)",
# "(bot-blocked)", "(dm)". Sending a verification code to any of them goes
# nowhere, so they are worse than an empty field - they hide the gap.
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def clean_email(raw):
    e = (raw or "").strip().strip("<>").lower()
    if not e or not EMAIL_RE.match(e):
        return ""
    if e.startswith("email@") or "protected]" in e or e.startswith("noreply@"):
        return ""
    return e


def clean_phone_value(raw):
    """Keep the original formatting but require 10 real digits."""
    d = re.sub(r"\D", "", raw or "")
    if len(d) == 11 and d.startswith("1"):
        d = d[1:]
    return (raw or "").strip() if len(d) == 10 else ""


def clean_city(raw):
    """-> (city, region_hint). Placeholders become empty, regions become hints."""
    c = (raw or "").strip()
    if not c:
        return "", ""
    # "Unresolved (Montreal core)" - the placeholder is the head, the real
    # location is in the bracket, so try the bracket before giving up.
    head, _, tail = c.partition("(")
    head_key = " ".join(re.sub(r"[^a-z ]", " ", strip_accents(head).lower()).split())
    if tail and head_key and PLACEHOLDER_CITY.match(head_key):
        c = tail.rstrip(") ").strip()

    key = " ".join(re.sub(r"[^a-z ]", " ", strip_accents(c).lower()).split())
    if key in REGION_AS_CITY:
        return "", REGION_AS_CITY[key]
    if PLACEHOLDER_CITY.match(key):
        return "", ""
    # "Toronto (unconfirmed exact home gym)" -> "Toronto"
    c = re.sub(r"\s*\((?:[^)]*(?:unconfirmed|unpublished|not published)[^)]*)\)", "", c, flags=re.I)
    return c.strip(" ,;-"), ""


# French-institution prefixes. The national prep circuits (NPH-D1, NSC, NPA)
# carry Quebec schools, and loaders that default to Ontario keep misfiling them:
# Academie d'Alma, College Saint-Jean-Vianney, Ecole St-Gabriel, Seminaire
# Saint-Francois (SSF Blizzard) were all landing in Ontario.
QC_INSTITUTION_RE = re.compile(
    r"^\s*(l')?\s*(ecole|college|seminaire|academie|cegep|polyvalente|institut)\b", re.I
)


_MUNI_BY_PROVINCE = None


def municipality_province(city):
    """Which province a city name belongs to, per the StatCan census list.

    Authoritative beats hand-maintained: a curated Quebec-city regex missed
    Saint-Augustin-de-Desmaures and would keep missing others. Returns "" when
    the name is unknown or ambiguous across provinces.
    """
    global _MUNI_BY_PROVINCE
    if _MUNI_BY_PROVINCE is None:
        _MUNI_BY_PROVINCE = defaultdict(set)
        for prov, names in (load_municipalities() or {}).items():
            for n in names:
                _MUNI_BY_PROVINCE[city_key(n)].add(prov)
    hits = _MUNI_BY_PROVINCE.get(city_key(city), set())
    return next(iter(hits)) if len(hits) == 1 else ""


PROVINCE_LABEL = {"ontario": "Ontario", "quebec": "Quebec", "britishcolumbia": "British Columbia",
                  "alberta": "Alberta", "manitoba": "Manitoba", "saskatchewan": "Saskatchewan",
                  "novascotia": "Nova Scotia", "newbrunswick": "New Brunswick",
                  "newfoundland": "Newfoundland & Labrador", "princeedwardisland": "Prince Edward Island"}


def infer_province(city, website, default, name=""):
    """Trust the club's own evidence over a loader's hardcoded default."""
    if QC_CITY_RE.search(city or "") or (website or "").lower().rstrip("/").endswith(".qc.ca"):
        return "Quebec"
    # The city itself is the strongest evidence, when the census list knows it.
    by_city = PROVINCE_LABEL.get(province_key(municipality_province(city)), "")
    if by_city and by_city != default:
        return by_city
    if not (city or "").strip() and QC_INSTITUTION_RE.match(strip_accents(name or "")):
        return "Quebec"
    return default


def city_key(c):
    c = strip_accents(c or "").lower()
    c = re.sub(r"\([^)]*\)", " ", c)
    c = re.sub(r"[^a-z ]", " ", c)
    return " ".join(c.split())


def city_places(raw):
    """A city field as the SET of places it names.

    Clubs write their location every possible way: "Toronto (Scarborough)",
    "Scarborough", "Oshawa/Whitby/Ajax", "Berwick / Coldbrook". Discarding the
    parenthetical - as the old code did - threw away the very token that matched,
    so "Scarborough" and "Toronto (Scarborough)" looked like different towns and
    the same club stayed split in two.
    """
    s = strip_accents(raw or "").lower()
    s = re.sub(r"[()\[\]]", " / ", s)          # parenthetical is another place
    parts = re.split(r"[/,;&+]| and | et ", s)
    out = set()
    for p in parts:
        p = " ".join(re.sub(r"[^a-z \-]", " ", p).split())
        p = re.sub(r"\b(area|region|county|chapters?|and|the)\b", " ", p).strip()
        p = " ".join(p.split())
        if len(p) >= 3:
            out.add(p)
    return out


def cities_conflict(a, b):
    """True when two records name cities that are clearly different places.

    Blank on either side is not a conflict (most sources omit city). Substring
    matches are not a conflict either, so 'Ottawa' and 'Ottawa (Kanata)' pass.
    """
    pa, pb = city_places(a), city_places(b)
    if not pa or not pb:
        return False
    # Any shared place means these are compatible locations, not a conflict.
    if pa & pb:
        return False

    # ONE compatible pair is enough — these are sets of places, and a club
    # serving "Markham" is compatible with one serving "Markham / Thornhill /
    # Stouffville". The previous version, on finding any substring pair, then
    # compared min(pa) against max(pb) — arbitrary elements that were usually
    # unrelated ("markham on" vs "programs extend to thornhill"), so it declared
    # a conflict and kept three rows of one Markham club apart.
    for x in pa:
        for y in pb:
            if x == y or x in y or y in x:
                if not distinct_municipality(x, y):
                    return False
    return True


def distinct_municipality(x, y):
    """True when one place name contains the other yet they are different towns.

    "Port Coquitlam" is not "Coquitlam" and "North Vancouver" is not
    "Vancouver", but "Markham" inside "Markham / Thornhill" is the same place.
    """
    if x == y:
        return False
    longer, shorter = (y, x) if len(y) > len(x) else (x, y)
    if shorter not in longer:
        return True
    lead = longer[: longer.index(shorter)].strip()
    return lead in {
        "port", "north", "south", "east", "west", "new",
        "greater", "old", "upper", "lower",
    }


    if ka in kb or kb in ka:
        return False
    return difflib.SequenceMatcher(None, ka, kb).ratio() < 0.90


# ------------------------------------------------------------------ loaders


def load_master():
    path = os.path.join(ROOT, "docs", "research", "canada-master-sheet.xlsx")
    if not os.path.exists(path):
        print(f"  ! skip (missing): {path}", file=sys.stderr)
        return []
    out = []
    for r in read_xlsx_sheet(path, "All Clubs"):
        if not (r.get("Club Name") or "").strip():
            continue
        out.append({
            "name": r["Club Name"].strip(),
            "province": (r.get("Province") or "").strip(),
            "city": (r.get("City") or "").strip(),
            "region": (r.get("Region") or "").strip(),
            "website": (r.get("Website") or "").strip(),
            "email": (r.get("Email") or "").strip(),
            "phone": (r.get("Phone") or "").strip(),
            "leagues": (r.get("Leagues") or "").strip(),
            "type": (r.get("Type") or "").strip(),
            "source": "census-2026-07",
            "evidence_url": (r.get("Source") or "").strip(),
            "kind": "club",
        })
    return out


def load_kml():
    path = os.path.join(ROOT, "docs", "research", "raw", "oba-find-a-club-kml-verified.json")
    if not os.path.exists(path):
        print(f"  ! skip (missing): {path}", file=sys.stderr)
        return []
    d = json.load(open(path, encoding="utf-8"))
    return [{
        "name": c["name"].strip(),
        "province": "Ontario",
        "city": "",
        "region": c.get("oba_region", ""),
        "website": c.get("website", ""),
        "email": c.get("email", ""),
        "phone": "",
        "leagues": "OBL/OBA (affiliated)",
        "type": "",
        "source": "oba-kml",
        "evidence_url": d.get("source", ""),
        "kind": "club",
        "lat": c.get("lat", ""),
        "lon": c.get("lon", ""),
    } for c in d.get("clubs", []) if c.get("name")]


def load_community():
    path = os.path.join(ROOT, "docs", "research", "raw", "ontario-community-layer.json")
    if not os.path.exists(path):
        print(f"  ! skip (missing): {path}", file=sys.stderr)
        return []
    d = json.load(open(path, encoding="utf-8"))
    return [{
        "name": c["name"].strip(),
        "province": "Ontario",
        "city": c.get("city", ""),
        "region": c.get("region", ""),
        "website": c.get("website", ""),
        "email": c.get("email", ""),
        "phone": c.get("phone", ""),
        "leagues": "",
        "type": c.get("type", ""),
        "source": "community-sweep",
        "evidence_url": c.get("evidence_url", ""),
        "kind": "club",
    } for c in d.get("clubs", []) if c.get("name")]


def load_league_harvest():
    path = os.path.join(ROOT, "docs", "research", "raw", "ontario-missing-leagues.json")
    if not os.path.exists(path):
        print(f"  ! skip (missing): {path}", file=sys.stderr)
        return []
    d = json.load(open(path, encoding="utf-8"))
    out = []
    for lg in d.get("leagues", []):
        label = lg.get("league", "")
        for c in lg.get("clubs_found", []) or []:
            raw = (c.get("name") or "").strip()
            if not raw:
                continue
            stem = club_stem(raw)
            meta = league_meta(label)
            if meta["audience"] == "adult":
                continue
            # A name the stemmer had to strip is a TEAM entry, not a club:
            # "Mississauga Monarchs - D & Hemeng" names two coaches. Those get
            # the same discovery-only treatment as the OBL team sheets, so a
            # standings row can enrich a known club but never invent one.
            if norm_full(stem) != norm_full(raw):
                out.append({
                    "name": stem, "province": "Ontario", "city": c.get("city", ""),
                    "region": "", "website": "", "email": "", "phone": "",
                    "leagues": label, "type": "",
                    "source": "obl-teams",          # discovery-only
                    "evidence_url": c.get("evidence_url", ""),
                    "kind": "team-derived", "raw_name": raw,
                    "last_verified": meta["season"], "audience": meta["audience"],
                })
                continue
            out.append({
                "name": stem,
                "province": "Ontario",
                "city": c.get("city", ""),
                "region": "",
                "website": "",
                "email": "",
                "phone": "",
                "last_verified": meta["season"],
                "audience": meta["audience"],
                "leagues": label,
                "type": "",
                "source": "league-harvest",
                "evidence_url": c.get("evidence_url", ""),
                # a stem that differs from the raw string came off a team entry
                "kind": "club" if stem.lower() == raw.lower() else "team-derived",
                "raw_name": raw,
            })
    return out


def load_gap_fill():
    """Clubs found by targeted searches of municipalities that had none.

    Driven by coverage-gaps.csv: every entry is a real org in a town the census
    had recorded as empty, so these are genuine discoveries rather than
    re-confirmations.
    """
    path = os.path.join(ROOT, "docs", "research", "raw", "ontario-gap-fill.json")
    if not os.path.exists(path):
        print(f"  ! skip (missing): {path}", file=sys.stderr)
        return []
    d = json.load(open(path, encoding="utf-8"))
    out = []
    for m in d.get("municipalities", []):
        for c in m.get("clubs", []) or []:
            if not (c.get("name") or "").strip():
                continue
            out.append({
                "name": c["name"].strip(),
                "province": "Ontario",
                "city": (c.get("city") or m.get("municipality") or "").strip(),
                "region": "",
                "website": (c.get("website") or "").strip(),
                "email": (c.get("email") or "").strip(),
                "phone": (c.get("phone") or "").strip(),
                "leagues": "", "type": (c.get("type") or "").strip(),
                "source": "gap-fill",
                "evidence_url": (c.get("evidence_url") or "").strip(),
                "kind": "club",
                "social": (c.get("social") or "").strip(),
            })
    return out


def load_browser_sweep():
    """Clubs from JS-rendered league sites reached with a real browser.

    Jr. NBA Canada, EOBA (TeamSnap), Hoop City, Toronto Big League and Canada
    Hoops Circuit all returned nothing to plain HTTP but are fully public once
    rendered or called with the right headers.
    """
    path = os.path.join(ROOT, "docs", "research", "raw", "ontario-browser-sweep.json")
    if not os.path.exists(path):
        print(f"  ! skip (missing): {path}", file=sys.stderr)
        return []
    d = json.load(open(path, encoding="utf-8"))
    out = []
    for s in d.get("sources", []):
        for c in s.get("clubs", []) or []:
            name = (c.get("name") or "").strip()
            if not name:
                continue
            label = (c.get("league") or s.get("name", "")).strip()
            meta = league_meta(label or s.get("name", ""))
            if meta["audience"] == "adult":
                continue  # adult rec league - its teams are not youth clubs
            out.append({
                "name": club_stem(name),
                "province": "Ontario",
                "city": (c.get("city") or "").strip(),
                "region": "", "website": (c.get("website") or "").strip(),
                "email": (c.get("email") or "").strip(),
                "phone": (c.get("phone") or "").strip(),
                "leagues": label,
                "type": "",
                "source": "browser-sweep",
                "evidence_url": (c.get("evidence_url") or s.get("url", "")).strip(),
                "kind": "club",
                "raw_name": name,
                "last_verified": meta["season"],
                "audience": meta["audience"],
            })
    return out


def load_jrnba():
    """Jr. NBA Canada 2019-20 finder: contact + coordinates, NOT club existence.

    The payload is fully populated (144 phones, 141 emails, 144 lat/long) but
    every program date is 2019 or 2020. It is loaded DISCOVERY_ONLY so it can
    enrich clubs a current source confirms, while any club only this source
    knows about lands in discoveries.csv flagged with its 2019-20 vintage
    rather than being published as active.
    """
    path = os.path.join(ROOT, "docs", "research", "raw", "jrnba-canada-2019-20.json")
    if not os.path.exists(path):
        print(f"  ! skip (missing): {path}", file=sys.stderr)
        return []
    d = json.load(open(path, encoding="utf-8"))
    out = []
    for c in d.get("locations", []):
        if not (c.get("name") or "").strip():
            continue
        out.append({
            "name": c["name"].strip(), "province": "", "city": (c.get("city") or "").strip(),
            "region": "", "website": (c.get("website") or "").strip(),
            "email": (c.get("email") or "").strip(), "phone": (c.get("phone") or "").strip(),
            "leagues": "Jr. NBA Canada", "type": "",
            "source": "jrnba-2019", "evidence_url": d.get("source_page", ""),
            "kind": "club", "lat": c.get("lat", ""), "lon": c.get("lon", ""),
            "last_verified": c.get("year") or "2019-20", "audience": "youth",
        })
    return out


def load_directory_contacts():
    """Contacts from 211 Ontario / CIOC and municipal community directories.

    These directories index anything basketball-shaped, so each record is
    classified: adult rec leagues and referee associations are flagged rather
    than dropped, so a reviewer can see and overturn the call.
    """
    out = []
    for fname, src in (("ontario-211-cioc-contacts.json", "211-cioc"),
                       ("ontario-municipal-contacts.json", "municipal-directory")):
        path = os.path.join(ROOT, "docs", "research", "raw", fname)
        if not os.path.exists(path):
            print(f"  ! skip (missing): {path}", file=sys.stderr)
            continue
        d = json.load(open(path, encoding="utf-8"))
        for o in d.get("organizations", []):
            name = (o.get("name") or "").strip()
            if not name:
                continue
            out.append({
                "name": name,
                "province": "Ontario",
                "city": (o.get("city") or "").strip(),
                "region": "",
                "website": (o.get("website") or "").strip(),
                "email": (o.get("email") or "").strip(),
                "phone": (o.get("phone") or "").strip(),
                "address": (o.get("address") or "").strip(),
                "leagues": "", "type": "",
                "source": src,
                "evidence_url": (o.get("evidence_url") or "").strip(),
                "kind": "club",
                "audience": classify_audience(name, o.get("notes", "")),
                # A named president/registrar is the single most useful field for
                # club outreach and claim follow-up, so keep it.
                "contact_person": (o.get("contact_person") or "").strip(),
            })
    return out


# Explicit verdicts that a stored website is not this club's. Deliberately
# strict: researchers also write asides like "Note: there is another org with a
# similar name", which is a caveat, not a finding that the URL is wrong.
BAD_SITE_RE = re.compile(
    r"(website mismatch|data mismatch|bad source match|"
    r"(?:the )?input(?:'s)? website .{0,40}belongs to|"
    r"belongs to (?:a |an |the )?(?:different|unrelated|another)|"
    r"is not the ontario|no connection to (?:ontario|this)|confirmed non-match)",
    re.I,
)
DEAD_SITE_RE = re.compile(
    r"(dead domain|domain (?:is )?(?:dead|expired|parked)|expired/parked|"
    r"no longer resolves?|does ?n[o']?t resolve|ssl certificate has expired|"
    r"connection refused|unreachable from)",
    re.I,
)


def load_tier3_contacts():
    """Per-club contact search results (tier3-contacts-batch*.json).

    ENRICH_ONLY: every club here was drawn FROM the master, so these attach by
    exact name and never mint an org. Researcher caveats are carried through to
    contact_note - a phone that is really a shared facility line, or a club that
    has rebranded, is worth knowing before anyone sends it a verification code.
    """
    import glob
    out = []
    pattern = os.path.join(ROOT, "docs", "research", "raw", "tier3-contacts-batch*.json")
    for path in sorted(glob.glob(pattern)):
        try:
            d = json.load(open(path, encoding="utf-8"))
        except (ValueError, OSError) as e:
            print(f"  ! skip (unreadable): {os.path.basename(path)} - {e}", file=sys.stderr)
            continue
        for c in d.get("results", []):
            name = (c.get("club") or "").strip()
            if not name:
                continue
            note = (c.get("notes") or "").strip()
            # A "not found" record still carries findings worth keeping: the most
            # valuable ones say the stored website belongs to someone else, which
            # is exactly WHY no contact was found. Skipping them threw that away.
            if not c.get("found") and not (BAD_SITE_RE.search(note) or DEAD_SITE_RE.search(note)):
                continue
            # A mismatch note means the researcher found the listed site belongs
            # to a DIFFERENT organisation - never import contacts from those.
            if re.search(r"data mismatch|different org|not the ontario|no connection to", note, re.I):
                if not (c.get("email") or c.get("phone")):
                    continue
            # Record WHY a stored website should not be trusted. The value stays
            # (deleting it would lose the audit trail that caught the problem);
            # it is marked so nothing downstream treats it as the club's own.
            status = ""
            if BAD_SITE_RE.search(note):
                status = "belongs-to-other-org"
            elif DEAD_SITE_RE.search(note):
                status = "dead-or-expired"
            out.append({
                "name": name, "province": "Ontario",
                "city": "", "region": "",
                "website": (c.get("website") or "").strip(),
                "email": (c.get("email") or "").strip(),
                "phone": (c.get("phone") or "").strip(),
                "leagues": "", "type": "",
                "source": "tier3-search",
                "evidence_url": (c.get("evidence_url") or "").strip(),
                "kind": "club",
                "social": (c.get("social") or "").strip(),
                "contact_person": (c.get("contact_person") or "").strip(),
                "contact_note": note[:200],
                "website_status": status,
            })
    return out


def load_quebec_sweep():
    """Clubs from the Quebec deep sweep (private academies + local programs)."""
    path = os.path.join(ROOT, "docs", "research", "raw", "quebec-deep-sweep.json")
    if not os.path.exists(path):
        print(f"  ! skip (missing): {path}", file=sys.stderr)
        return []
    d = json.load(open(path, encoding="utf-8"))
    return [{
        "name": c["name"].strip(),
        "province": "Quebec",
        "city": (c.get("city") or "").split("(")[0].strip(),
        "region": (c.get("region") or "").strip(),
        "website": (c.get("website") or "").strip(),
        "email": (c.get("email") or "").strip(),
        "phone": (c.get("phone") or "").strip(),
        "leagues": (c.get("leagues") or "").strip(),
        "type": (c.get("type") or "").strip(),
        "source": "quebec-sweep",
        "evidence_url": (c.get("evidence_url") or "").strip(),
        "kind": "club",
    } for c in d.get("clubs", []) if (c.get("name") or "").strip()]


def load_geocoded():
    """Coordinates + Google's own province verdict for each club.

    ENRICH_ONLY: keyed to clubs already in the master. Google's resolved
    province is a better authority than a loader's hardcoded default - it
    caught five national-prep-circuit teams filed as Ontario that are really in
    Saskatchewan, Manitoba and Alberta, in towns too small to appear in the
    census list this script otherwise checks against.
    """
    path = os.path.join(ROOT, "docs", "research", "raw", "geocoded-clubs.json")
    if not os.path.exists(path):
        print(f"  ! skip (missing): {path}", file=sys.stderr)
        return []
    d = json.load(open(path, encoding="utf-8"))
    out = []
    for c in d.get("clubs", []):
        if not (c.get("club") or "").strip():
            continue
        out.append({
            "name": c["club"].strip(),
            # Trust Google's province, EXCEPT for the territories: it names the
            # specific one while our taxonomy buckets YT/NWT/NU together, and
            # switching would silently fork that bucket.
            "province": (c["province"] if is_territory(c.get("province"))
                         else canonical_province(c.get("resolved_province")) or c["province"]),
            "city": "", "region": "",
            "website": "", "email": "", "phone": "",
            "leagues": "", "type": "",
            "source": "geocode",
            "evidence_url": "https://maps.googleapis.com/maps/api/geocode/json",
            "kind": "club",
            "lat": str(c.get("lat", "")), "lon": str(c.get("lon", "")),
            # Google's formatted_address is DERIVED from the query we sent. Storing
            # it in `address` fed it back into the next geocode run, turning
            # "Camrose" into "Camrose, AB, Canada, Camrose, Alberta, Canada" and
            # invalidating 1,267 cache entries. Keep it separate from the
            # researcher-supplied street address.
            "formatted_address": c.get("formatted_address", ""),
            "postal_code": c.get("postal_code", ""),
            "place_id": c.get("place_id", ""),
            "geo_precision": c.get("location_type", ""),
        })
    return out


def is_territory(p):
    return "territor" in (p or "").lower() or (p or "").strip() in {
        "Yukon", "Northwest Territories", "Nunavut"}


def canonical_province(p):
    """Map Google's province name onto our label set, accents folded."""
    key = province_key(p)
    return PROVINCE_LABEL.get(key, "")


def load_website_contacts():
    """Contacts scraped off clubs' own websites by enrich-contacts.py.

    Derived from a previous run of this script, so every club here already
    exists and will match on name - this only fills in email/phone/social. Safe
    to re-run: the pipeline is consolidate -> enrich -> consolidate.
    """
    path = os.path.join(ROOT, "docs", "research", "raw", "website-contact-enrichment.json")
    if not os.path.exists(path):
        print(f"  ! skip (missing): {path}", file=sys.stderr)
        return []
    d = json.load(open(path, encoding="utf-8"))
    return [{
        "name": c["club"],
        "province": c.get("province", ""),
        "city": c.get("city", ""),
        "region": "",
        "website": c.get("website", ""),
        "email": c.get("email", ""),
        "phone": c.get("phone", ""),
        "leagues": "", "type": "",
        "source": "website-scrape",
        "evidence_url": c.get("evidence_url", ""),
        "kind": "club",
        "social": c.get("social", ""),
    } for c in d.get("clubs", []) if c.get("club")]


def load_obl_teams():
    """Clubs inferred from OBL division team entries.

    Lowest-trust source by design: these are stems recovered from team strings,
    so they confirm clubs we already know far more reliably than they discover
    new ones. Single-source rows from here get flagged by review_reason().
    """
    path = os.path.join(ROOT, "docs", "research", "raw", "obl-division-teams.json")
    if not os.path.exists(path):
        print(f"  ! skip (missing): {path}", file=sys.stderr)
        return []
    d = json.load(open(path, encoding="utf-8"))
    return [{
        "name": c["club"],
        "province": "Ontario",
        "city": "", "region": "", "website": "", "email": "", "phone": "",
        "leagues": "OBL", "type": "",
        "source": "obl-teams",
        "evidence_url": d.get("source_page", ""),
        "kind": "team-derived",
        "team_entries": c["team_entries"],
    } for c in d.get("clubs", []) if c.get("club")]


def _csv(path):
    if not os.path.exists(path):
        print(f"  ! skip (missing): {path}", file=sys.stderr)
        return []
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def load_ontario_csvs():
    """The Ontario-only lists that predate the master workbook.

    unique-clubs-master.csv and ontario-basketball-clubs.csv hold circuit clubs
    (e.g. CALI Prep Academy) that never made it into the workbook's All Clubs
    sheet, and contact_enrichment.csv is the only source of social handles.
    """
    out = []

    for r in _csv(os.path.join(ROOT, "docs", "research", "unique-clubs-master.csv")):
        name = (r.get("club") or "").strip()
        if not name:
            continue
        contact = (r.get("contact") or "").strip()
        emails = re.findall(r"[\w\.\-\+]+@[\w\.\-]+\.\w+", contact)
        phones = re.findall(r"\+?[\d][\d\-\(\)\s\.]{7,}\d", contact)
        city = (r.get("city") or "").split(",")[0].strip()
        out.append({
            "name": name, "province": "Ontario", "city": city, "region": "",
            "website": "", "email": emails[0] if emails else "",
            "phone": phones[0].strip() if phones else "",
            "leagues": (r.get("leagues") or "").strip(), "type": "",
            "source": "ontario-circuit-list", "evidence_url": "", "kind": "club",
        })

    for r in _csv(os.path.join(ROOT, "docs", "ontario-basketball-clubs.csv")):
        name = (r.get("Club Name") or "").strip()
        if not name:
            continue
        out.append({
            "name": name, "province": "Ontario", "city": (r.get("City") or "").strip(),
            "region": (r.get("Region") or "").strip(),
            "website": (r.get("Website") or "").strip(),
            "email": (r.get("Email") or "").strip(),
            "phone": (r.get("Phone") or "").strip(),
            "leagues": (r.get("Leagues") or "").strip(), "type": "",
            "source": "ontario-csv", "evidence_url": "", "kind": "club",
        })

    for r in _csv(os.path.join(ROOT, "docs", "research", "sheets", "contact_enrichment.csv")):
        name = (r.get("club") or "").strip()
        if not name:
            continue
        out.append({
            "name": name, "province": "Ontario",
            "city": (r.get("city") or "").split(",")[0].strip(), "region": "",
            "website": (r.get("website") or "").strip(),
            "email": (r.get("email") or "").strip(),
            "phone": (r.get("phone") or "").strip(),
            "leagues": "", "type": "",
            "source": "contact-enrichment", "evidence_url": "", "kind": "club",
            "social": (r.get("social") or "").strip(),
            "leader": (r.get("leader") or "").strip(),
        })

    return out


# ------------------------------------------------------------- consolidation

SOURCE_TRUST = {
    "oba-kml": 5, "census-2026-07": 4, "contact-enrichment": 4, "website-scrape": 4,
    "ontario-csv": 3, "community-sweep": 3, "gap-fill": 3, "quebec-sweep": 3, "211-cioc": 4, "municipal-directory": 4, "tier3-search": 4, "geocode": 5, "browser-sweep": 3, "jrnba-2019": 1, "ontario-circuit-list": 2,
    "league-harvest": 1, "obl-teams": 1,
}
AUTO_MERGE = 0.94   # >= this and same province -> merged without asking
REVIEW_LOW = 0.84   # between REVIEW_LOW and AUTO_MERGE -> audit queue


# Sources whose records may ENRICH an existing club but must never create a new
# one. Club names recovered from team strings are too noisy to mint orgs: OBA has
# ~187 affiliated clubs fielding ~1,200 teams, so treating every distinct stem as
# a club would triple the Ontario count with fragments. Unmatched rows are parked
# in discoveries.csv for a human to promote or discard.
# ------------------------------------------------------- source reliability
#
# Every club inherits the vintage and audience of the sources that found it.
# Two problems this exists to catch, both real and both found in this data:
#
#   STALE  Jr. NBA Canada's finder looks live but every program date in its
#          payload is 2019 or 2020. Importing it as-is would add 40 Ontario
#          "clubs" that may not have existed for five years.
#   ADULT  tcbl.ca reads like a youth league but is an adult recreational
#          pickup league. Its teams are not youth clubs at all.
#
# Keyed by league-name fragment, matched case-insensitively.
LEAGUE_META = {
    "jr. nba":              {"season": "2019-20", "audience": "youth", "stale": True},
    "jr nba":               {"season": "2019-20", "audience": "youth", "stale": True},
    # NOTE: do NOT put "tcbl" here. Two different organisations share that
    # acronym - "TCBL Basketball" is in Ontario Basketball's own affiliated-club
    # map (so, youth), while the Toronto Chinese Basketball Association is the
    # adult league. A league-name rule would delete the youth one. Adult orgs
    # are matched individually in ADULT_ORGS instead.
    "eoba":                 {"season": "2025-26", "audience": "youth", "stale": False},
    "hoop city":            {"season": "2026",    "audience": "youth", "stale": False},
    "toronto big league":   {"season": "2025-26", "audience": "youth", "stale": False},
    "canada hoops circuit": {"season": "2025-26", "audience": "youth", "stale": False},
    "cybl":                 {"season": "2025-26", "audience": "youth", "stale": False},
    "phoenix":              {"season": "2025-26", "audience": "youth", "stale": False},
    "orbl":                 {"season": "2025-26", "audience": "youth", "stale": False},
    "juel":                 {"season": "2025-26", "audience": "youth", "stale": False},
    "obl":                  {"season": "2025-26", "audience": "youth", "stale": False},
}
DEFAULT_META = {"season": "2026-07", "audience": "youth", "stale": False}
STALE_BEFORE = "2024"  # anything last verified before this is not evidence of an active club


# Specific organisations confirmed to be adult, matched on name AND the URL they
# were evidenced at, so an acronym collision cannot take a youth club with it.
# Flagged rather than deleted: a reviewer should be able to see and overturn it.
ADULT_ORGS = [
    ("toronto chinese basketball", "torontochinese"),
    ("tcbl", "tcbl.ca"),
]


def is_adult_org(name, evidence):
    n, e = (name or "").lower(), (evidence or "").lower()
    return any(nf in n and (not ef or ef in e) for nf, ef in ADULT_ORGS)


# Community-service directories list anything basketball-shaped, so they return
# adult rec leagues and referee associations alongside youth clubs.
ADULT_RE = re.compile(
    r"\b(men'?s|women'?s|ladies|adult|senior (?:ladies|men|women)|"
    r"pick[- ]?up|recreational league|22\+|18\+)\b", re.I
)
OFFICIALS_RE = re.compile(r"\b(officials?|referee|umpire)\b.*\bassociation\b|"
                          r"\bassociation of basketball officials\b", re.I)


def classify_audience(name, notes=""):
    """youth | adult | officials — 'officials' is not a club at all.

    Wheelchair basketball orgs deliberately classify as youth when their own
    description covers youth ages: they are real youth basketball organisations,
    just not able-bodied ones, and excluding them would be wrong.
    """
    blob = f"{name} {notes}"
    if OFFICIALS_RE.search(blob):
        return "officials"
    youth_signal = re.search(r"\b(youth|junior|minor|u\d{1,2}|ages? \d|4-18|8\+|"
                             r"developmental|grade|school)\b", blob, re.I)
    if ADULT_RE.search(blob) and not youth_signal:
        return "adult"
    return "youth"


def league_meta(label):
    key = (label or "").lower()
    for frag, meta in LEAGUE_META.items():
        if frag in key:
            return meta
    return DEFAULT_META


DISCOVERY_ONLY = {"obl-teams", "jrnba-2019"}

# Sources derived from a previous run of THIS script, keyed to clubs that already
# exist. They attach by exact name and nothing else: fuzzy scoring and the
# city-conflict guard are both wrong here, because a cluster that legitimately
# spans two city spellings would otherwise reject its own enrichment and dump it
# into discoveries as if it were a new club.
ENRICH_ONLY = {"website-scrape", "tier3-search", "geocode"}


def consolidate(records):
    clusters = []                      # list of {key, members[]}
    by_block = defaultdict(list)       # blocking key -> cluster indices
    audit = []
    discoveries = []

    # Seed clusters from trusted sources first so discovery/enrichment rows have
    # something to attach to regardless of input ordering.
    records = sorted(records, key=lambda r: r["source"] in (DISCOVERY_ONLY | ENRICH_ONLY))
    exact = {}  # norm_full key -> cluster index, for ENRICH_ONLY attachment
    by_contact = defaultdict(list)  # normalised email/phone -> cluster indices

    for rec in records:
        key = norm_full(rec["name"])
        if not key:
            continue
        rkeys = name_keys(rec["name"])

        if rec["source"] in ENRICH_ONLY:
            i = exact.get(key)
            if i is not None:
                clusters[i]["members"].append(rec)
            # No exact club to enrich: drop it rather than invent an org. These
            # rows are derived from the master, so a miss means the master moved.
            continue
        # The SAME key set is used for lookup and insert - if these ever diverge,
        # records get filed where they are never searched for and nothing merges.
        bkeys = blocking_keys(rec["name"])
        bucket = {i for k in bkeys for i in by_block[k]}
        ckeys = contact_keys(rec)
        # A shared email or phone is strong evidence, so those clusters are
        # considered even when the names look nothing alike.
        bucket |= {i for k in ckeys for i in by_contact[k]}
        best_i, best_score, best_conflict, best_prefix = None, 0.0, False, False
        for i in bucket:
            cl = clusters[i]
            if cl["province"] and rec["province"] and cl["province"] != rec["province"]:
                continue
            # Location disagreement is computed FIRST, because every scoring
            # boost below is conditional on it. It used to be computed inside
            # the "best so far" branch, which meant the boost read whatever
            # `conflict` was left over from the previous cluster in the loop.
            #
            # Only a positive disagreement blocks a merge: if nobody in the
            # cluster records a city there is nothing to disagree with, and
            # all([]) would otherwise read as "conflict" and block everything.
            known = [m.get("city") for m in cl["members"] if city_key(m.get("city"))]
            conflict = (
                bool(known)
                and bool(city_key(rec.get("city")))
                and all(cities_conflict(c, rec.get("city")) for c in known)
            )

            score = max(
                difflib.SequenceMatcher(None, rk, m_key).ratio()
                for m_key in cl["keys"] for rk in rkeys
            )
            # A trailing "Association"/"Inc." should not hide a duplicate.
            prefix_variant = any(
                is_name_prefix_variant(rk, m_key)
                for m_key in cl["keys"] for rk in rkeys
            )
            # Same organisation written another way (entity suffix, acronym,
            # one-word + generic tail). Gated on location so "SBA" in
            # Scarborough never absorbs "SBA" in Surrey.
            entity_variant = any(
                same_org_name(rk, m_key)
                for m_key in cl["keys"] for rk in rkeys
            )
            # Same contact AND a compatible location: one club, two spellings.
            shares_contact = bool(
                ckeys and any(ckeys & contact_keys(m) for m in cl["members"])
            )
            # The boost must be applied BEFORE ranking. MUMBA scores 0.11
            # against "Markham Unionville Minor Basketball Association" despite
            # being its exact acronym, so ranking on the raw ratio first let an
            # unrelated cluster win and the real duplicate was never merged.
            # Contact-only evidence needs the towns to positively agree, for the
            # same reason as the cluster pass: branches share an inbox.
            contact_ok = shares_contact and bool(known) and bool(city_key(rec.get("city")))
            if (entity_variant or contact_ok) and not conflict:
                score = max(score, AUTO_MERGE)
            elif prefix_variant:
                score = max(score, REVIEW_LOW + 0.01)  # force into the audit queue

            if score > best_score:
                best_i, best_score, best_conflict, best_prefix = i, score, conflict, prefix_variant

        if best_i is not None and best_score >= AUTO_MERGE and not best_conflict:
            clusters[best_i]["members"].append(rec)
            clusters[best_i]["keys"] |= rkeys
            exact.setdefault(key, best_i)
            for k in ckeys:
                if best_i not in by_contact[k]:
                    by_contact[k].append(best_i)
        elif rec["source"] in DISCOVERY_ONLY:
            # Did not match a known club: record it as a candidate, do not mint it.
            discoveries.append({
                "candidate": rec["name"],
                "province": rec["province"],
                "leagues": rec.get("leagues", ""),
                "team_entries": rec.get("team_entries", ""),
                "last_verified": rec.get("last_verified", ""),
                "source": rec["source"],
                "closest_known_club": clusters[best_i]["members"][0]["name"] if best_i is not None else "",
                "closest_score": round(best_score, 3) if best_i is not None else "",
                "evidence_url": rec.get("evidence_url", ""),
                "decision": "",        # human fills: new-club | alias-of-closest | not-a-club
                "reviewer": "",
                "notes": "",
            })
        else:
            # A city conflict on an otherwise-identical name is exactly the kind
            # of call a human with local knowledge should make, so queue it.
            if best_i is not None and (best_score >= REVIEW_LOW or best_conflict):
                audit.append({
                    "score": round(best_score, 3),
                    "reason": ("same-name-different-city" if best_conflict
                               else "name-prefix-variant" if best_prefix
                               else "near-duplicate-name"),
                    "province": rec["province"],
                    "name_a": clusters[best_i]["members"][0]["name"],
                    "sources_a": ",".join(sorted({m["source"] for m in clusters[best_i]["members"]})),
                    "city_a": next((m["city"] for m in clusters[best_i]["members"] if m["city"]), ""),
                    "name_b": rec["name"],
                    "sources_b": rec["source"],
                    "city_b": rec["city"],
                    "evidence_b": rec.get("evidence_url", ""),
                    "decision": "",          # human fills: merge | distinct | alias-of-a
                    "reviewer": "",
                    "notes": "",
                })
            clusters.append({
                "province": rec["province"],
                "keys": set(rkeys),
                "members": [rec],
            })
            for k in bkeys:
                by_block[k].append(len(clusters) - 1)
            exact.setdefault(key, len(clusters) - 1)
            for k in ckeys:
                by_contact[k].append(len(clusters) - 1)

    clusters = merge_equivalent_clusters(clusters)
    return clusters, audit, discoveries


def merge_equivalent_clusters(clusters):
    """Second pass: unify clusters that are the same organisation.

    The first pass only ever adds a RECORD to a cluster, so once duplicates land
    in two different clusters nothing reunites them and the outcome depends on
    input order. Markham Unionville Minor Basketball Association proved it: the
    MUMBA spelling carrying an email joined the "MBA" cluster (they share a
    contact) while the remaining MUMBA rows formed their own, leaving one club
    as two — which is exactly what a person notices immediately when browsing.

    Repeats until nothing changes, because merging A into B can make B match C.
    """
    for _ in range(5):  # converges in 1-2 rounds; bounded so a cycle cannot hang
        by_key = defaultdict(list)
        for i, cl in enumerate(clusters):
            if cl.get("dead"):
                continue
            for k in {b for m_ in cl["members"] for b in blocking_keys(m_["name"])}:
                by_key[k].append(i)
            for k in {c for m_ in cl["members"] for c in contact_keys(m_)}:
                by_key[k].append(i)

        merged_any = False
        for idxs in by_key.values():
            uniq = sorted(set(idxs))
            for a_i, b_i in [(a, b) for x, a in enumerate(uniq) for b in uniq[x + 1:]]:
                A, B = clusters[a_i], clusters[b_i]
                if A.get("dead") or B.get("dead"):
                    continue
                if A["province"] and B["province"] and A["province"] != B["province"]:
                    continue
                same_name = any(same_org_name(x, y) for x in A["keys"] for y in B["keys"])
                shared = bool(
                    {c for m_ in A["members"] for c in contact_keys(m_)}
                    & {c for m_ in B["members"] for c in contact_keys(m_)}
                )
                if not (same_name or shared):
                    continue

                acities = [m_.get("city") for m_ in A["members"] if city_key(m_.get("city"))]
                bcities = [m_.get("city") for m_ in B["members"] if city_key(m_.get("city"))]
                conflicting = bool(acities) and bool(bcities) and all(
                    cities_conflict(x, y) for x in acities for y in bcities
                )
                if conflicting:
                    continue  # genuinely different towns

                if not same_name:
                    # Contact alone proves a RELATIONSHIP, not identity. A branch
                    # network shares one inbox: nine IEM branches across Newmarket,
                    # Aurora and Bradford, and both Gators clubs, collapsed into
                    # single rows when a shared address was treated as proof.
                    # Demand that the towns positively agree, not merely fail to
                    # disagree — a blank city is not agreement.
                    if not (acities and bcities):
                        continue
                    if not any(not cities_conflict(x, y) for x in acities for y in bcities):
                        continue
                A["members"].extend(B["members"])
                A["keys"] |= B["keys"]
                B["dead"] = True
                merged_any = True
        clusters = [c for c in clusters if not c.get("dead")]
        if not merged_any:
            break
    return clusters


def pick(members, field):
    """Highest-trust non-empty value for a field."""
    best, best_trust = "", -1
    for m in members:
        v = (m.get(field) or "").strip()
        if v and SOURCE_TRUST.get(m["source"], 0) > best_trust:
            best, best_trust = v, SOURCE_TRUST.get(m["source"], 0)
    return best


def load_municipalities():
    """Province -> [municipality names], longest first, from the StatCan census list.

    Used to recover a city for records that carry none. The OBA KML, for one,
    gives coordinates and a region but no city at all, which would otherwise make
    187 real clubs invisible to any city-based coverage or search.
    """
    path = os.path.join(ROOT, "docs", "research", "raw", "canada-municipalities.json")
    if not os.path.exists(path):
        return {}
    d = json.load(open(path, encoding="utf-8"))
    by_prov = defaultdict(list)
    for m in d.get("municipalities", []):
        name = re.sub(r"\s*\([^)]*\)\s*$", "", m.get("name", "")).strip()
        # Very short names ("Ajax" is fine, "Hay" is not) match too loosely
        # against arbitrary club names, so keep a floor.
        if len(name) >= 5:
            by_prov[province_key(m.get("province"))].append(name)
    for p in by_prov:
        by_prov[p] = sorted(set(by_prov[p]), key=len, reverse=True)
    return dict(by_prov)


def province_key(p):
    """Province names differ between sources ('Newfoundland & Labrador' vs 'and')."""
    p = strip_accents(p or "").lower().replace("&", "and")
    p = re.sub(r"\(.*?\)", " ", p)
    p = re.sub(r"[^a-z]", "", p)
    return p.replace("newfoundlandandlabrador", "newfoundland")


def city_from_name(name, province, munis):
    """Recover a city by finding a municipality name inside the club's own name."""
    pool = munis.get(province_key(province), ())
    hay = " " + strip_accents(name or "").lower() + " "
    for m in pool:  # longest first, so 'Thunder Bay' beats any shorter substring
        if re.search(r"\b" + re.escape(strip_accents(m).lower()) + r"\b", hay):
            return m
    return ""


# Canadian place names that also name a well-known US city or region. A club in
# one of these, with a non-.ca site we found by search, is where a website can
# silently belong to a different organisation entirely - confirmed three times:
# Cambridge ON got a Massachusetts gym's site, Cambridge ON a Nova Scotia school
# program's, and North Bay ON a San Rafael, California org's.
AMBIGUOUS_PLACE = {
    "cambridge", "north bay", "london", "windsor", "hamilton", "waterloo",
    "kingston", "chatham", "paris", "delhi", "aurora", "newmarket", "richmond",
    "richmond hill", "markham", "milton", "oxford", "woodstock", "stratford",
    "dover", "essex", "kent", "york", "brantford", "peterborough", "orillia",
    "georgetown", "burlington", "oakville", "ajax", "bradford", "vaughan",
}
# Sources that are governing bodies or official directories: a website they
# publish for a club is authoritative in a way a search result is not.
AUTHORITATIVE_SOURCES = {"oba-kml", "211-cioc", "municipal-directory"}


def domain_claim_ok(website, website_sources, city):
    """Whether a club's website is trustworthy enough to verify ownership by
    email domain. Returns (ok, reason).

    Gates on the provenance of the WEBSITE, not of the club. Those differ, and
    the difference is the whole bug: Cambridge Basketball Association really is
    OBA-affiliated, but the URL on its record came from elsewhere and pointed at
    a Nova Scotia school program. Likewise "several sources know this club" says
    nothing - they can all repeat one wrong URL.

    website_sources is the set of sources that supplied THIS website value.
    """
    site = (website or "").strip().lower()
    if not site:
        return False, "no-website"
    host = re.sub(r"^https?://", "", site).split("/")[0].split(":")[0].removeprefix("www.")
    if any(s in AUTHORITATIVE_SOURCES for s in website_sources):
        return True, "website-from-governing-body"
    if host.endswith(".ca"):
        return True, "canadian-tld"
    if len(website_sources) >= 2:
        return True, "website-corroborated"
    if " ".join(re.sub(r"[^a-z ]", " ", (city or "").lower()).split()) in AMBIGUOUS_PLACE:
        return False, "ambiguous-place-single-source-non-ca"
    return False, "unverified-single-source-non-ca"


def sources_for_value(members, field, value):
    """Which sources actually supplied this exact field value."""
    if not value:
        return set()
    v = str(value).strip().lower()
    return {m["source"] for m in members if str(m.get(field) or "").strip().lower() == v}


def review_reason(members, srcs):
    """Why a human should look at this row before it is treated as a real club.

    League harvests yield team strings, so a short single-source name with no
    contact is as likely to be a fragment or an abbreviation as an actual org.
    """
    name = canonical_name(members)
    reasons = []
    if len(srcs) == 1 and srcs[0] in ("league-harvest", "obl-teams"):
        if len(name) < 12 or len(name.split()) < 2:
            reasons.append("short-name-single-league-source")
        if not any((m.get("email") or m.get("phone") or m.get("website")) for m in members):
            reasons.append("no-contact-unverified")
    if any(m.get("kind") == "team-derived" for m in members) and len(srcs) == 1:
        reasons.append("derived-from-team-name")
    if name.isupper() and len(name) <= 6:
        reasons.append("looks-like-abbreviation")
    return ";".join(sorted(set(reasons)))


# Words that mark a name as describing a PROGRAM or TEAM rather than the club
# that runs it. Basketball NWT merged correctly with its own development
# programme, but picking the longest name made the club appear in the directory
# as "U14 Futures Jr. High Performance Program".
PROGRAM_SHAPED = re.compile(
    r"\b(u\d{1,2}|\d{1,2}u|jr\.?|junior|senior|high performance|program(me)?|"
    r"development|futures|academy team|house league|rep team|division|squad|"
    r"boys|girls|mens|womens)\b",
    re.I,
)


def canonical_name(members):
    """The name that best identifies the ORGANISATION.

    Longest-from-the-most-trusted-source, but organisation-shaped names beat
    programme-shaped ones regardless of length: a directory entry should read
    "Basketball NWT", not "U14 Futures Jr. High Performance Program".
    """
    top = max(SOURCE_TRUST.get(m["source"], 0) for m in members)
    pool = [m["name"] for m in members if SOURCE_TRUST.get(m["source"], 0) == top]
    org_shaped = [n for n in pool if not PROGRAM_SHAPED.search(n)]
    return max(org_shaped or pool, key=len)


def main():
    os.makedirs(OUT, exist_ok=True)
    print("loading sources...")
    records = []
    for loader in (load_master, load_kml, load_community, load_league_harvest, load_ontario_csvs, load_obl_teams, load_gap_fill, load_directory_contacts, load_quebec_sweep, load_browser_sweep, load_jrnba, load_tier3_contacts, load_geocoded, load_website_contacts):
        got = loader()
        if got:
            print(f"  {got[0]['source']:16} {len(got):5d} rows")
        records += got
    print(f"  {'TOTAL':16} {len(records):5d} rows\n")

    # Google's verdict on which province a club is actually in, keyed by name.
    # Applied BEFORE clustering, not as an enrichment afterwards: clusters only
    # merge within a province, so correcting one spelling of a club's name after
    # the fact strands it in a different province from its own duplicate.
    geo_prov = {}
    gpath = os.path.join(ROOT, "docs", "research", "raw", "geocoded-clubs.json")
    if os.path.exists(gpath):
        for c in json.load(open(gpath, encoding="utf-8")).get("clubs", []):
            if is_territory(c.get("province")):
                continue          # our taxonomy buckets YT/NWT/NU deliberately
            label = canonical_province(c.get("resolved_province"))
            if label:
                geo_prov[norm_full(c.get("club", ""))] = label

    # Normalise centrally rather than in each loader, so every source - including
    # any added later - gets placeholder-city stripping and province inference.
    fixed_city = fixed_prov = fixed_email = 0
    for r in records:
        before_city, before_prov = r.get("city", ""), r.get("province", "")
        had_email = bool((r.get("email") or "").strip())
        r["email"] = clean_email(r.get("email"))
        r["phone"] = clean_phone_value(r.get("phone"))
        city, region_hint = clean_city(before_city)
        r["city"] = city
        if region_hint and not (r.get("region") or "").strip():
            r["region"] = region_hint
        # Google's geocoded province wins: it resolved real coordinates for the
        # club's own city, which beats a loader default or a census name lookup.
        r["province"] = geo_prov.get(norm_full(r.get("name", ""))) or infer_province(
            city, r.get("website"), before_prov, r.get("name")
        )
        if city != (before_city or "").strip():
            fixed_city += 1
        if r["province"] != before_prov:
            fixed_prov += 1
        if had_email and not r["email"]:
            fixed_email += 1
    dropped = sum(1 for r in records if not r.get("email"))
    print(f"  normalised: {fixed_city} placeholder/dirty cities cleared, "
          f"{fixed_prov} provinces corrected, "
          f"{fixed_email} unsendable 'emails' dropped\n")

    munis = load_municipalities()
    if not munis:
        print("  ! no municipality list - city backfill disabled", file=sys.stderr)
    print("consolidating...")
    clusters, audit, discoveries = consolidate(records)

    rows = []
    for cl in clusters:
        m = cl["members"]
        srcs = sorted({x["source"] for x in m})
        leagues = sorted({l.strip() for x in m for l in re.split(r"[;,+]", x.get("leagues") or "") if l.strip()})
        cname = canonical_name(m)
        _site = pick(m, "website")
        _dc = ((False, "website-flagged-" + pick(m, "website_status"))
               if pick(m, "website_status")
               else domain_claim_ok(_site, sources_for_value(m, "website", _site), pick(m, "city")))
        city = pick(m, "city")
        city_source = "source" if city else ""
        if not city:
            city = city_from_name(" ".join([cname] + [x["name"] for x in m]), cl["province"], munis)
            city_source = "inferred-from-name" if city else ""
        rows.append({
            "club_name": cname,
            "province": cl["province"],
            "city": city,
            "city_source": city_source,
            "region": pick(m, "region"),
            "website": pick(m, "website"),
            "email": pick(m, "email"),
            "phone": pick(m, "phone"),
            "leagues": "; ".join(leagues),
            "type": pick(m, "type"),
            "lat": pick(m, "lat"),
            "lon": pick(m, "lon"),
            "postal_code": pick(m, "postal_code"),
            "place_id": pick(m, "place_id"),
            "geo_precision": pick(m, "geo_precision"),
            "social": pick(m, "social"),
            "contact_person": pick(m, "contact_person"),
            "contact_note": pick(m, "contact_note"),
            "website_status": pick(m, "website_status"),
            "address": pick(m, "address"),
            "formatted_address": pick(m, "formatted_address"),
            "leader": pick(m, "leader"),
            "sources": ",".join(srcs),
            "source_count": len(srcs),
            "row_count": len(m),
            "oba_affiliated": "yes" if "oba-kml" in srcs else "",
            "team_derived": "yes" if any(x.get("kind") == "team-derived" for x in m) else "",
            "aliases": " | ".join(sorted({x["name"] for x in m} | {x.get("raw_name", "") for x in m} - {""})),
            "evidence_url": pick(m, "evidence_url"),
            "claimable": "yes" if (pick(m, "email") or pick(m, "phone")) else "",
            "domain_claim_ok": "yes" if _dc[0] else "",
            "domain_claim_reason": _dc[1],
            # Most recent season any source saw this club in. A club known ONLY
            # from a pre-2024 source is not evidence of an active organisation.
            "last_verified": max((x.get("last_verified") or "2026-07") for x in m),
            "stale": "yes" if max((x.get("last_verified") or "2026-07") for x in m) < STALE_BEFORE else "",
            "audience": next(
                (a for a in ("officials", "adult")
                 if any(x.get("audience") == a for x in m)
                 or (a == "adult" and any(is_adult_org(x["name"], x.get("evidence_url")) for x in m))),
                "youth",
            ),
            "needs_review": review_reason(m, srcs),
        })

    rows.sort(key=lambda r: (r["province"], r["club_name"].lower()))
    cons_path = os.path.join(OUT, "clubs-consolidated.csv")
    with open(cons_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    # Pre-resolve the mechanical cases so a human only sees real judgement calls.
    # Two clubs with the same name in two genuinely different municipalities are
    # two clubs - Panther Hoops in Coquitlam is not Panther Hoops in Port
    # Coquitlam. Keeping them separate is also the safe default for claiming:
    # two owners can claim two clubs, whereas an incorrect merge has to be
    # untangled after someone already owns the record.
    auto = 0
    for a in audit:
        if a["decision"]:
            continue
        if a["reason"] == "same-name-different-city":
            ca, cb = a.get("city_a", ""), a.get("city_b", "")
            pa, pb = municipality_province(ca), municipality_province(cb)
            if ca and cb and cities_conflict(ca, cb) and pa and pb:
                a["decision"] = "distinct"
                a["reviewer"] = "auto-rule"
                a["notes"] = (f"both are census municipalities ({ca} / {cb}); "
                              "kept separate - override if they are one club")
                auto += 1
    print(f"  audit auto-resolved  {auto} of {len(audit)} "
          f"({len(audit) - auto} need a human)")

    audit.sort(key=lambda a: -a["score"])
    audit_path = os.path.join(OUT, "audit-queue.csv")
    with open(audit_path, "w", newline="", encoding="utf-8") as f:
        cols = ["score", "reason", "province", "name_a", "city_a", "sources_a",
                "name_b", "city_b", "sources_b", "evidence_b",
                "decision", "reviewer", "notes"]
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(audit)

    disc_path = os.path.join(OUT, "discoveries.csv")
    with open(disc_path, "w", newline="", encoding="utf-8") as f:
        cols = ["candidate", "province", "leagues", "team_entries",
                "last_verified", "source", "closest_known_club", "closest_score",
                "evidence_url", "decision", "reviewer", "notes"]
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(sorted(discoveries, key=lambda d: -(d["team_entries"] or 0)))

    by_prov = Counter(r["province"] for r in rows)
    summary = {
        "generated": "2026-08-14",
        "input_rows": len(records),
        "distinct_orgs": len(rows),
        "collapsed_by_dedupe": len(records) - len(rows),
        "audit_queue": len(audit),
        "discoveries_pending": len(discoveries),
        "by_province": dict(by_prov.most_common()),
        "by_source_combo": dict(Counter(r["sources"] for r in rows).most_common()),
        "claimable_now": sum(1 for r in rows if r["claimable"]),
        "with_coordinates": sum(1 for r in rows if r["lat"].strip()),
        "stale_only": sum(1 for r in rows if r["stale"]),
        "adult_orgs_flagged": sum(1 for r in rows if r["audience"] == "adult"),
        "domain_claim_eligible": sum(1 for r in rows if r["domain_claim_ok"]),
        "websites_flagged_bad": sum(1 for r in rows if r["website_status"]),
        "domain_claim_blocked": sum(1 for r in rows if r["website"] and not r["domain_claim_ok"]),
        "publishable": sum(1 for r in rows if not r["stale"] and r["audience"] == "youth"),
        "no_contact": sum(1 for r in rows if not r["claimable"]),
        "oba_affiliated": sum(1 for r in rows if r["oba_affiliated"]),
        "team_derived_only": sum(1 for r in rows if r["team_derived"] and r["source_count"] == 1),
    }
    json.dump(summary, open(os.path.join(OUT, "summary.json"), "w"), indent=1)

    print(f"\n  distinct orgs      {summary['distinct_orgs']}")
    print(f"  collapsed by dedupe {summary['collapsed_by_dedupe']}")
    print(f"  audit queue         {summary['audit_queue']}")
    print(f"  discoveries pending {summary['discoveries_pending']}")
    print(f"  claimable now       {summary['claimable_now']} / {summary['distinct_orgs']}")
    print("\n  by province:")
    for p, n in by_prov.most_common():
        print(f"    {n:5d}  {p}")
    print(f"\nwrote {cons_path}")
    print(f"wrote {audit_path}")
    print(f"wrote {disc_path}")
    print(f"wrote {os.path.join(OUT, 'summary.json')}")


if __name__ == "__main__":
    main()
