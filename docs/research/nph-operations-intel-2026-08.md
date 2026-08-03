---
updated: 2026-08-01
tags: [theme/research, type/research, status/reference]
---

# NPH Operations Intel — scoring, distribution, venues (Aug 2026 sweep)

> Companion to census-nph-2025-26.md. Sources: stats.northpolehoops.com JSON
> (game records incl. gm_Venue/gm_VenueLoc), nbn23.com/swish-nph, NPH site,
> BallerTV, Instagram surface read.

## Scoring stack
- **SWISH by NBN23** (FIBA-endorsed digital scoresheet) — stats partner since
  Feb 2023, active 2025-26; replaced paper stats. NBN23's "InGame" is the
  likely courtside capture app. Stats portal (stats.northpolehoops.com) looks
  BESPOKE (index.php?json&ssn_ID pattern), fed by SWISH data — no vendor
  branding in the portal HTML itself.
- Game schema: gm_Venue + gm_VenueLoc (street address), boxscore +
  play-by-play flags, official id, championship/in-season-tournament flags.

## Distribution
- Marketing pages (no venues named) → stats portal ("time @ venue", box
  scores, standings) → **Exposure Events** for Showcase League (per-game
  venue/directions, THEIR app, BallerTV watch links). Email newsletter only;
  NO push, NO iCal, no WhatsApp, own /calendar/ widget abandoned ~2022.
- Streaming: BallerTV (Nov 2024 partner) + NPH-run YouTube broadcast sold to
  teams at $2,000/team.

## Venues by division (real game counts from the portal)
- **Six Park East, Oshawa (1000 Thornton Rd S) — Courts 1–6 (SIX courts
  confirmed)** and **The Playground Burlington (952 Century Dr) — Courts
  1–3** are the two hub venues.
- SL Gr10 (169 games): Six Park ~73 · Playground ~21 · satellites: Complexe
  NDL Longueuil QC, Lisgar CI + Carleton U Raven's Nest (Ottawa), St Francis
  Xavier CSS (Milton), Turner Fenton (Brampton) — 19 venue/court combos.
- SL Gr12 (186 games): Playground 113 · Six Park 71 · Carleton 2 — a whole
  season on effectively TWO venues (real-world venue-commitment pattern).
- Summer 2026 (66 games, July 23-26): Playground 56 + **Haber Recreation
  Centre** Burlington 10 — all-Burlington footprint.
- "Six Points" does not exist — the real name is Six Park East.

## Instagram (@northpolehoops, 47.1K)
Recaps, highlight reels, partnership announcements (Montverde → WNPA, new
prep schools 2026-27, BAA pipeline). No schedule/score-graphic cadence
verifiable (post-level = low confidence). Sub-accounts: @nphshowcase,
@npacanada, @cnit_tournament, @nphscouting.

## Implications for SportsHub
- Owner's "Six Park has six courts" CONFIRMED by real data; feasibility sims
  used the right shape (146-game SL weekend fits Six Park + one 3-court gym).
- NPH already lives the venue-commitment pattern (Gr12 = 2 venues) — our
  planned pass automates what they do by hand.
- Their gaps vs us: no owned family app/notifications/iCal (they rent
  Exposure Events), third-party scoring, $2k/team streaming upsell. Our
  platform = schedule + scoring + notifications in one.

## Cross-league venue usage 2025-26 (all 8 calendars pulled, 2026-08-01)
Totals: ~1,420 games — SL 966 (68%) · D1 five divisions 315 · NPA 80 ·
WNPA 57. Venue share of ALL NPH games: **Six Park East ~37% · The
Playground Burlington ~29%** (top-2 = two-thirds), Ridley ~5%, FEIA ~3%,
then ~20 school/college gyms at 1-2% each (St. Francis Xavier, Turner
Fenton, Henry Street, Royal Crown, Carleton, King's Christian, Humber,
NDL Longueuil, York Tait McKenzie, Lisgar, David Ann, Crestwood, Edge,
St. Jude, F.H. Sherman, Bramalea, Glebe, Earl Haig, Bishop Reding, The
Gate, Athol Murray, Hodan Nalayeh).
- Biggest league: SL (966 games, 146 census entries). Most BUILDINGS for
  its size: NPA (12+ buildings for 80 games — academy home gyms +
  weekdays). Most teams through one building: Six Park East (~150+).
- Division residency: Gr9 ~65% + Gr10 ~55% of games AT Six Park; Gr7/Gr8
  resident at Playground; Gr11/Gr12 split both hubs; D1 girls rotate
  hosts monthly (Playground→Six Park→NDL→Royal Crown→Carleton) = travel
  relief via home weekends, not requests.

## Six Park East is a SHARED building — NJC/NSC interleave (KEY)
National Junior Circuit + National Senior Circuit (sibling orgs, TeamLinkt)
book Six Park East for the SAME six Fri-Sun blocks in 2026-27: Oct 16-18,
Nov 13-15, Dec 11-13, Jan 15-17, Feb 12-14, Mar 12-14 (championship).
Overlaying NPH's official 2026-27 SL calendar: every collision weekend
(Nov 14-15, Dec 12-13, Jan 16-17, Feb 13-14, finals Mar 13-14) carries
EXACTLY the grades that don't need Six Park (Gr7, Gr8, Gr10-with-schools,
Tier-1 finals block), while every big Six Park stack (Oct 24-25, Nov 21-22
peak 84 games, Dec 19-20, Jan 9-10, Jan 30-31, Feb 6-7, Feb 20-21) sits on
an NJC-free weekend. The building's season is effectively sold out ~20 of
~23 weekends across the two orgs.
→ Product implication (owner 2026-08-01): venue WEEKEND AVAILABILITY is the
true planning input. Flow: building availability calendar → session-day
planning (which grades on which available weekend) → actual scheduling.
Matches the calendar-planner design (weekends primitive, courts output).

## CORRECTION (2026-08-03, full portal re-pull — trust these over the ~figures above)
Full deduplicated JSON parse of all 17 seasons (raw + scripts: session scratchpad nph-sl-raw/). SL 2025-26 core 7 divisions, REGULAR season = 714 games: **Six Park 367 (51.4%) · Playground 256 (35.9%) · 13 satellites 91 (12.7%)**. R+F = 857; + Exhibition/Quebec/Ottawa = 961 total. Per-division (R): Gr10 210g (71% SP) · Gr11 120g (48% SP) · Gr9 125g (67% SP) · Gr12 117g (74% PG) · Gr7 61g (49% PG) · Gr8 47g (64% PG) · JrG 34g (50% SP). The eyeballed "Gr10 169 / Gr12 186" lines above are superseded. **Haber: zero games anywhere in 2025-26** (all 17 seasons searched; Summer 2026 only). **Six Park bookings are COURT-CONTIGUOUS (courts 1-N)**: 9 SL weekends = 6 whole-building-ish (courts 1-4/1-5/1-6), 2 partial (courts 1-3 only, January), 1 stray Friday; avg SL-only utilization 48.7% of 6x12h days; Feb 7-8 with D1 overlap ~87.5%. Partial-court weekend rental at Six Park is real (January proves it).

## WASTE + PATTERN ANALYSIS (2026-08-03, full-season computation — artifacts: session scratchpad nph-sl-raw/ master-utilization.json, njc-nsc-overlay.json, waste-audit.json + rerunnable scripts)
- NJC/NSC 2025-26 pulled LIVE from TeamLinkt (assoc 27543/27544): all 450 events at Six Park courts 1-6; sessions Oct 10-12, Nov 14-16, Dec 12-14, Jan 16-18, Feb 13-15, Mar 13-15. **0 of 41 NPH Six Park days shared with the circuits** — weekend-level building exclusivity, never court-sharing. Jan partial rentals were demand-sized on NJC-FREE weekends.
- Measured slot spacing: **SL runs 75-min slots at both hubs** (not 90). Playground Saturdays start 12:15 (own morning programming), Sundays 09:15.
- WASTE (weekend, conservative-to-spec range): Playground 57.4% of own weekend court-hours idle (868.5/1,512) while renting 77 Six Park weekend court-days (22.2% of rented courts idle). **Avoidable by whole-cohort co-location: 17-30 SP court-days (22-39% of rental) + 9-10 satellite venue-days.** Pure over-renting (no moves needed): 6 court-days. Five proof weekends: Oct 25-26 (Gr12), Nov 1-2 (Gr11), Nov 22-23 (Gr8+9), Dec 6-7 (Gr11), Feb 21-22 (worst: PG 4 games while renting 6+5 SP courts).
- SPLIT-GRADES KNOB: co-location captures ALL venue-day savings + ~2/3 of court-days; splitting adds +15-19 court-days, +0 venue-days → secondary opt-in, default OFF.
- Their implicit rules: building-availability-first skeleton (0 violations) · cohort atomicity 85% (self-authorized splits under pressure) · residency Gr9/10=SP, Gr7/8/12=PG · court-contiguous demand-sized rentals · alternation cadence · satellites = overflow + regional service (rational except Ridley Dec 20-21).
- Product knobs K1-K6 mapped in the saved analysis; savings expressed in court-days/venue-days (owner prices them).
- VALIDATION (2026-08-03, owner challenge "did you miss their other leagues?"): master table + waste audit were ALL-LEAGUE — the proof weekends' Playground rows contain NPA (Nov 22-23: 3+4g, Feb 21-22: 3+1g), D1-JrBoys (Dec 6-7: 3+2g), SL Gr7/8/JrG; parallel-league usage was already netted out of every idle figure. STRICT floor (Playground usable ONLY first-tip..last-tip at real 75-min slots — paranoid for a building they own): proof weekends still show slack for ~5-12 games/day while 3-6 Six Park courts were rented across town; ~1-2 SP courts/weekend shaveable on 4 of 5 proof weekends even then, and the 6 pure over-rented court-days need no Playground hours at all. Defensible floor ≈ low-teens SP court-days; fair range stays 17-30.
