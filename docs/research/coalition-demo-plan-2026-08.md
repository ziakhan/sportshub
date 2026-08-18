---
updated: 2026-08-17
tags: [theme/research, theme/gtm, type/plan, status/in-progress]
---

# Coalition demo — data harvested, plan for the build

Owner has a **personal relationship with Ben Sanders**, Coalition's founder and commissioner (he coached the owner's son). This becomes the priority pitch, ahead of the NPH showcase demo.

**Overnight 2026-08-17: the full Coalition league has been harvested and packaged. This file records what exists, what the pitch actually is, and what remains to build.**

---

## 1. ✅ What is now in the repo

| File | Contents |
|---|---|
| `docs/research/raw/coalition-games-2025-26.json` | **6,971 games** — every game of Winter 2025-26 and Summer 2025, with venue, court, date, time, both teams, **final scores**, division, pool, status and **venue lat/lon** |
| `docs/research/raw/coalition-seed-package.json` | Normalised seed input: **39 venues (73 courts)**, **106 divisions**, **921 team entries** |
| `docs/research/raw/coalition-events-2025-26.json` | All six Coalition events with division and team rows |

### How it was obtained

Coalition runs on Exposure Events. Their schedule pages load client-side, but the page embeds the division list and exposes a games endpoint:

```
POST https://basketball.exposureevents.com/{eventId}/{slug}/eventgames
Headers: X-Requested-With: XMLHttpRequest, Content-Type: application/json
Body:    {"divisionId": <id>}
```

Division IDs are embedded in the schedule page HTML as `divisions: [{"Id":…,"Name":…}]`. Harvester and division lists are in the session scratchpad (`fetch_div.sh`, `winter_divs.json`, `summer_divs.json`). **Re-runnable any time** — this is public data with no auth.

### What the data covers

| | Winter 2025-26 | Summer 2025 |
|---|---|---|
| Games | **4,779** | 2,192 |
| Divisions | 72 | 34 |
| Venues | 34 | 14 |
| Game dates | 38 | 23 |
| Games with final scores | **6,965 of 6,971 across both seasons** | |
| Games with venue coordinates | **6,971 — all of them** | |

**Distinct team names: 814. Venue/court inventory: 39 venues, 73 courts.**

---

## 2. ⚠️ The pitch is NOT "we save you travel" — I tested it and it fails

Before building a demo around scheduling savings, I modelled it against their real calendar. **The result kills that angle and it is better to know now than in the room.**

**Division-day consolidation:** 66.7% of division-days already run at a **single venue**. Reassigning every division-day to its single best venue saves **7,935 km of 343,203 — about 2%.**

> **Coalition's venue assignment is already good.** Do not walk in claiming we will save them travel. The registrar will know, and the claim collapses.

What *is* true about their scheduling, and defensible:

| Fact | Number |
|---|---|
| Venues running on a single game-date | **avg 7.2, max 13** |
| Games on the busiest date | **249** (1 Feb 2026) |
| Division-days split across 2+ venues | **33.3%** |
| Worst splits | U16 Boys Div 6 and Div 7, 31 Jan 2026 — **5 venues each** |
| Median venues a team visits in a season | **5** |
| Most-travelled team | **Oakville Venom, 21 different gyms** |
| Median team round-trip travel | ~405 km · mean 554 km · worst Barrie Royals ~4,652 km |

**So the honest scheduling story is about LABOUR and COORDINATION, not waste.** Thirteen buildings, 63 courts, 249 games on one Sunday, 72 divisions re-tiered through the season — all coordinated by hand on Exposure. That is the pain. We should say exactly that.

### Correcting the owner's venue assumption

The owner said *"I think they play off of HoopDome and HoopDome has only four courts."* **Half right.** HoopDome does have 4 courts and 749 games across both seasons — but it is not their main venue.

| Venue | Courts | Games (both seasons) |
|---|---|---|
| **Skillz Basketball Lab** | 3 | **1,105** |
| **TSS Athletic Centre** | 3 | **928** |
| **T.A.T. Stadium** | **5** | 883 |
| **HoopDome** | 4 | 749 |
| **GTA Sportsplex** | 4 | 700 |
| Centennial Athletic & Wellness | 3 | 609 |
| T.A.T. Arena | 3 | 272 |
| Wexford CI | 2 | 262 |

The rest is a long tail of **high-school gyms at 1–2 courts each** — which is exactly the owner's point about needing more courts than any one building offers, and why the coordination load is real.

---

## 3. The demo that actually lands

**Premise: their own league, running in our product.** Not a mock world — Coalition's real divisions, real teams, real venues, real games, real scores.

### What the data supports directly (no invention)

1. **The league, ingested.** 72 winter divisions, 890 teams, 4,779 games, 34 venues. Show that we can hold their whole season.
2. **Standings that compute themselves** from the real results, per division, across ten tiers.
3. **Venue and court map** — 39 venues with real coordinates, court counts, and the calendar of which building runs when.
4. **The busiest day.** 1 Feb 2026: 249 games across 13 venues. One screen showing every court in the league running at once is the single most persuasive image we can put in front of him.
5. **Schedule browse by division, team, venue and date** — currently four separate clicks on Exposure with a spinner.

#### The money shot, fully specified: Sunday 1 February 2026

**249 games · 13 venues · 43 courts in use · 26 divisions running simultaneously.**

| Games | Courts | Divisions | Venue |
|---|---|---|---|
| **42** | 4 | 6 | HoopDome |
| **38** | 5 | 3 | T.A.T. Stadium |
| 25 | 3 | 3 | Skillz Basketball Lab |
| 25 | 3 | 3 | Centennial Athletic and Wellness Centre |
| 19 | 4 | 2 | GTA Sportsplex |
| 18 | 2 | 3 | St. Francis Xavier CSS |
| 18 | 2 | 1 | David and Mary Thomson C.I. |
| 17 | 2 | 3 | Bishop Reding CSS |
| 16 | 2 | 2 | Wexford CI |
| 9 | 1 | 2 | St. Ignatius of Loyola SS |
| 8 | 1 | 2 | Assumption CSS |
| 7 | 1 | 3 | St. John Paul II CSS |
| 7 | 1 | 3 | St. Mother Teresa Catholic Academy |

**This one table is the pitch.** Thirteen buildings across the GTA, forty-three courts, two hundred and forty-nine games, twenty-six divisions — on one Sunday, coordinated by hand, producing 249 final scores and nothing else.

### What needs synthetic data (and must be labelled as such)

Coalition publishes **no rosters and no player stats** — Exposure gives them none. So for the game-day surfaces we must generate:

- Player rosters for a **small featured subset** (suggest 2 divisions: one boys D1 "Quest for the Ring", one girls Diamond Division)
- Play-by-play and box scores for those games
- Recaps, POTG and milestone cards derived from them

**Rule: the featured subset is clearly marked as demonstration data.** Real scores stay real; invented player names are never presented as Coalition's actual players. Ben will ask, and the answer must be clean.

### The narrative arc for the meeting

1. *"This is your Winter League. All 890 teams, all 4,779 games, all 34 venues."*
2. *"Here's February 1st — 249 games, 13 buildings."* (the coordination reality)
3. *"Now here's what happens when a game is scored."* → live box score → standings move → **player's stat line lands on their profile** → **recap and card generate** → parent gets notified.
4. *"You currently produce nothing from 4,779 games except a final score typed into Exposure."*
5. Family view: follow the kid, see the season, share the card.

---

## 4. What remains to build

| Task | Status | Notes |
|---|---|---|
| Harvest full league data | ✅ **done** | 6,971 games in the repo |
| Normalised seed package | ✅ **done** | venues, divisions, teams |
| **Coalition seeder script** | ⬜ **to build** | Model on `scripts/seed-nph-demo.ts` (2,936 lines). Creates org → league → season → divisions → teams → venues+courts → games with real scores → standings |
| Featured-division player rosters + stats | ⬜ to build | Synthetic, clearly labelled, 2 divisions |
| Recaps / cards / POTG for featured games | ⬜ to build | Reuses existing recap + card pipeline |
| Venue map surface | ⬜ check | Do we have a venue map view? 39 geocoded venues is a strong visual |
| "Busiest day" view | ⬜ to build | 249 games / 13 venues on one screen — the money shot |

**Suggested next command:** build `scripts/seed-coalition-demo.ts` reading `docs/research/raw/coalition-seed-package.json` and `coalition-games-2025-26.json`.

⚠️ **Do not run any seeder against the box or Neon without the owner's explicit go-ahead** (CLAUDE.md deploy policy). Local DB only until he says otherwise.

---

## 5. Notes for the conversation with Ben

- **Lead with the relationship, not the product.** He coached the owner's son; this is a catch-up that becomes a business conversation, not a pitch.
- **Do not claim travel savings.** (§2 — it is only 2% and he will know.)
- **Do not disparage Exposure.** It does registration and brackets competently. Our claim is that it does nothing after tip-off.
- **The credible line:** *"You run 4,779 games a season and they produce one number each. We turn every one of them into a box score, a player's record, a recap and something a parent shares."*
- **Their fee is $3,195/team winter, $2,400 summer, ~$3.9M/yr revenue.** Our $39/team is 1.2% of a winter entry. Price is not the obstacle.
- **Watch for ARC** ([[coalition-league-census-2026-08]] §5b) — SBA, the club that operates Coalition, already registers on ARC, whose stated vision matches ours. If Ben mentions them, we should know we have looked.

⬅ [[coalition-league-census-2026-08]] · [[league-economics-and-obl-structure-2026-08]] · [[business-model-v3]]
