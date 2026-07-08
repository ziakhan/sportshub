---
theme: [research, gtm]
type: research
status: reference
updated: 2026-07-06
tags: [theme/research, theme/gtm, type/research, status/reference]
---

# Unique clubs master list — cross-league dedupe (2026-07-06)

Full data: [unique-clubs-master.csv](unique-clubs-master.csv) — one row per unique
club: club, city, leagues (union), n_leagues, best contact, matching tenant slug.

## Headline numbers

- **183 unique clubs/programs** across NJC, NSC, NPH Showcase League, NPH D1,
  OSBA, Coalition (full member list), OBL (published examples only — the full
  ~175-club OBA list isn't public), and JUEL (confirmed franchises).
- **64 clubs (35%) compete in 2+ leagues** — their data is scattered across
  TeamLinkt (NJC/NSC), NPH's stats site, RAMP (OSBA), Exposure (Coalition), and
  Google Sheets (OBL). One club identity across leagues is the pitch.
- **78 clubs already exist as tenants** in our platform (from the 188-club
  Ontario import) — for these, outreach = "claim your page", not "sign up".

## The most-connected clubs (best first outreach targets among clubs)

| Club | Leagues | Already a tenant? |
|---|---|---|
| Brampton City Prep | NJC+NSC+OSBA+NPH-D1 | ✅ brampton-city-prep |
| Monarchs (Mississauga) | Coalition+OBL+NSC+NPH-SL | ✅ monarchs-basketball-rep-aau |
| ONL-X (Ottawa Next Level) | NJC+NSC+NPH-SL+NPH-D1 | ✅ onl-x-basketball |
| SC Academy Prep | NJC+NSC+NPH-SL+NPH-D1 | ✅ sc-academy |
| Westfield Prep | NJC+NSC+NPH-SL+NPH-D1 | — |
| FEIA (Fort Erie) | OSBA+NPH-SL+NPH-D1 | — |
| Royal Crown | OSBA+NPH-SL+NPH-D1 | ✅ royal-crown-school |
| Full Circle Basketball Academy | NJC+NSC+OSBA | — |
| Future Hope Academy | NJC+OSBA+NPH-D1 | — |
| Simcoe United Spartans | NJC+NSC+NPH-SL | ✅ simcoe-united |
| St. Michael's College School | OSBA+NPH-SL+NPH-D1 | — |
| Toronto Lords | NSC+NPH-SL+NPH-D1 | ✅ toronto-lords-basketball |
| Tri-City Prep | NJC+OSBA+NPH-D1 | — |
| Vanguard North Prep | NJC+NSC+NPH-SL | ✅ vanguard-north |

## Operator correction (owner, 2026-07-06)

NPH is **not just a media company** — it is likely the biggest multi-league youth
basketball operator in Canada: NPA & WNPA (the country's top prep leagues), the
NPH Showcase League (club circuit, ~85 clubs), the NPH D1 League, CNIT
tournaments, Western Canada Showcase, and a Dubai property. Treat NPH as a
first-class league-operator prospect (they built a home-grown stats platform —
they value this product area enough to build it; the pitch is upgrading it, plus
the club-facing experience their stack doesn't offer).

## Coverage caveats

- OBL clubs: only the handful OBA publishes as examples are counted; the real
  membership is ~175 clubs (our 188-club import likely IS most of it — that CSV
  came from Ontario Basketball's affiliate data).
- Hoop City and CYBL publish no club lists (sites gated) — 0 clubs counted.
- Name matching is normalized + alias-mapped; a handful of IG-only orgs may still
  be duplicates under different names. Treat n_leagues as a floor, not a ceiling.
