# Ontario youth basketball — market research master index (2026-07-06)

Everything from the July 2026 research sessions (three research passes + three
team-census passes). NOTHING in this folder should be edited destructively —
append updates with dates. Contact info is org-level only (info@/admissions@/
office phones from official sites or government listings). CASL: outreach
emails must identify us and carry unsubscribe language.

## Spreadsheets (open in Excel/Numbers/Sheets) — `sheets/`

| File | View | Rows |
|---|---|---|
| **ontario-basketball-research-2026-07.xlsx** | ALL views as one workbook, one sheet per view | — |
| `leagues.csv` | Every league/circuit: operator, kind, ages, region, 2025-26 entries, season, current software, fees, contact | 18 |
| `clubs.csv` | Every club: city, leagues, best contact, tenant match, censused team entries, census systems | 228 |
| `club_league_memberships.csv` | One row per club×league membership with entry counts + division detail | 275 |
| `team_entries.csv` | One row per individual team entry (club, league, division/entry name) | 558 |

Spreadsheets are GENERATED from the census docs by a build script (session
scratchpad `build_sheets.py`; regenerate by re-running against the census
markdown). Totals reconcile exactly: NJC 51, NSC 32, NPH 230, OSBA 94
(asserted), Coalition 151 itemized (54 member + 97 top-non-member entries;
remaining ~266 of the 417 are un-itemized "other programs" — the Exposure
teams page has them if ever needed).

## Documents

| File | Content |
|---|---|
| `club-segmentation-taxonomy.md` | The 5 segments (scholastic prep / independent prep / rep / hybrid / house league), level definitions, pricing axes |
| `team-census-2025-26.md` | Synthesis: 824 visible entries, club-size distribution, combined per-club totals, market sizing, **pricing model v1** |
| `unique-clubs-master.md` (+ .csv) | 183-club cross-league dedupe, 64 multi-league clubs, 78 tenant matches |
| `gta-league-landscape-2026.md` | League-by-league GTM map: OBL/Coalition/CYBL/Hoop City/OBSL/JUEL/ORBL/EOBA/CHC/KSL + pitch notes + dead leads |
| `nph-circuits-2025-26.md` | NPH ecosystem: operator structure (NPH ≠ NJC/NSC!), ~115 orgs w/ contacts, fees |
| `osba-2025-26.md` | OSBA: operator (Ontario Basketball, named staff w/ emails), 38 programs w/ contacts, stack (RAMP+Synergy+Pixellot) |
| `census-njc-nsc-2025-26.md` | RAW census: 83 entries, entry names, roster sizes (12.4 players/team, 1,027 players), API endpoints |
| `census-nph-2025-26.md` | RAW census: 230 entries w/ divisions, season-ID map, NPA/WNPA member lists, session-only entries |
| `census-osba-coalition-2025-26.md` | RAW census: OSBA 94-entry division matrix; Coalition 417 entries, member counts, age split |

## Headline numbers (2025-26 season)

- **824 team entries** visible across NPH (230) / NJC+NSC (83) / OSBA (94) /
  Coalition Summer (417); OBL adds ~1,200 claimed rep teams (not enumerable —
  Google Sheets). Ontario addressable ≈ 2,000+ team-seasons/yr, ~16,000 athletes.
- **~12.4 players/team** (NJC/NSC rosters, n=83 teams).
- Club-size distribution (NPH): 59% field 1 team; top 14 clubs (4+) = 1/3 of entries.
- Age split: OSBA = 0% middle-school; Coalition = 60% Gr4-8.
- Fee anchors clubs already pay per team: NPH SL $3,990/summer; NJC/NSC ~$5,150/season.

## Strategy state (2026-07-06)

Leagues-first, clubs-amplified. Target order: 1) NJC/NSC (small operator, one
venue, TeamLinkt) 2) Coalition (~380+ summer teams, media-hungry, Exposure)
3) Hoop City/ORBL 4) OBA/OBL (the prize; approach with proof) 5) NPH (biggest
multi-league operator in Canada — owner correction: NOT just media; pitch as
operator + content). Pricing v1 in team-census doc: league per-team-season
($15-30), club team-count bands (free ≤2 / ~$89 3-9 / ~$225 10+ + prep
Exposure add-on), payments margin (1-2% of $8-13M Ontario rep registrations),
Family Pass P3. Before mass club outreach: OB-002 claim trust model.
