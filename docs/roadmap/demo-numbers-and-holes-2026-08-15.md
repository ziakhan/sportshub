# Demo numbers + suspected holes: owner review sheet

Status: **AWAITING OWNER CORRECTIONS** (gate #1 of the demo directory v2 plan, 2026-08-15)

How to use this: Part A proposes one consistent "league truth" every demo draws from. Part B lists every number currently on screen and what it becomes. Part C is my suspected-holes list. Strike what is fine, correct what is wrong, add what I missed. Nothing in the demo scripts changes until this comes back.

---

## Part A. One league truth (proposed)

Every demo currently invents its own numbers, which is how we got a 30-team league, an 8-team "top 8 of 12" table, and a club with 6 teams in one demo and 7 in another. Proposal: one fact table, used everywhere.

| Fact | Proposed value | Notes |
|---|---|---|
| League | Metro Youth Basketball League (fictional) | Name is a placeholder, correct it if you want a different flavour |
| Scale | **24 clubs, 144 teams** | OWNER 08-16: team numbers must be realistic against North Pole Hoops scale, a big league, so the scheduling win is credible. 144 keeps every downstream number clean; 146 if the exact figure matters. |
| Divisions | 13 divisions of **8 to 12 teams**, U9 to U18, boys and girls, tiered | Replaces today's divisions of 3 to 6 teams |
| The promise | **"12 games guaranteed: 10 regular season + minimum 2 playoff"** | The sales language you asked for. Surfaces in the season plan scene and the registry copy. |
| Regular season | 10 games per team, **720 games league-wide**, 16 game weekends | 144 x 10 / 2 |
| Court math | 720 games x 90 min = **1,080 court-hours needed** | Season story headline |
| Venue book | Riverside CC (league's own): 3 courts, Sat 10h with one court held back, Sun 8h all three = 44 h/weekend, 704 total. Northside HS (rented): 2 courts x 6h Sat = 192. Cedar Ridge SS (rented): 1 court x 8h Sun = 128. **Held: 1,024** | Same narrative beats as today (owned building, held-back court, rented gyms) at real scale |
| The gap | **56 court-hours short, about 37 games unhoused, about 3.5 h per weekend** | The drama beat: "one more evening gym most weekends." Replaces 29 hours / 20 games. |
| Division truth | U11 Girls Rep division: **12 teams**, standings at 10 games played | Used by playoffs, game-day, waivers |
| Playoff weekend | **14 games, everyone plays at least 2**: top 8 championship bracket (QF 4, SF 2, F 1, 3rd place 1, QF-loser consolations 2 = 10 games) + 9-12 placement bracket (SF 2, F 1, 3rd place 1 = 4 games) | Keeps today's "14 playoff games" toast true, and 14 x 90 min = 21 h keeps "21 of 24 booked court-hours" true. Matches the real scheduler's bracket + placement formats. |
| Club truth | Riverside Ravens: **7 teams, 74 registered players**, everywhere | Claim story currently says 6 teams |
| Club audience | 214 "everyone engaged" (guardians x2, staff, followers) | Plausible for 74 players, keep |
| Rep season fee | **OWNER RULED 08-16: magnitude $3,000. Deposit at signup, then 3 installments on the 1st of the next three months, and a pay-in-full option shown too.** Exact figure to confirm: $3,000 = $750 deposit + 3 x $750 | Cascades to your-week and money demos. |
| Small fees | Tryout $25, camp $210, gym share $120 | Realistic, keep |

---

## Part B. Per-demo numbers: current on screen, proposed

### 1. Roster story (roster-story.tsx)
| Current | Proposed |
|---|---|
| Club tiles: Teams 7, Registered players 74, Waitlist 12 | Keep (now the club truth) |
| Teams board shows 6 rows but the tile says 7 | Show 7 rows or make the visible count honest |
| Roster fractions 11 of 12, 10 of 10, 12 of 12... | Keep, realistic |
| Tryout $25, 24 spots; House League "Opens 1 September, 48 spots" | Keep |
| Offer accept: uniform YM, tracksuit YL, shoes, jersey preferences | Keep. Verified this mirrors the real offer-response-form exactly (uniform YS to AXL, shoe, tracksuit, three jersey preferences 0 to 99). |
| Paid today $175, next payment 15 Oct $175 | Rescale if fee changes to $1,480 (deposit $340, installments $285) |

### 2. Everyone in the loop (loop-story.tsx)
| Current | Proposed |
|---|---|
| Audiences: club 214, teams 12, tryout 14 | Keep |
| Delivered 12, skipped 0 | Keep |
| Poll: 186 votes, 141 votes | Keep (86% of 214 is high but believable for a "which tournament weekend" poll) |

### 3. A season, planned to published (season-story.tsx). Biggest rewrite.
| Current | Proposed |
|---|---|
| 30 teams, 14 games each, 210 games | **144 teams, 10 games each, 720 games** |
| 315 court-hours needed, 286 held, 29 short, 20 games unhoused | **1,080 needed, 1,024 held, 56 short, 37 games unhoused** |
| Divisions of 3 to 6 teams (U13 Girls Tier 2 has 3) | Divisions of 8 to 12. A 3-team division cannot run a 10-game season without playing each other 5 times; fold Tier 2 into Tier 1 or show it interlocking with a neighbour league. |
| "Plan expected 30" entries queue | "Plan expected 144" with clubs submitting 4 to 9 teams each |
| "Eight U11 teams... Ten at U13" grade estimates | Rescale to division sizes (e.g. 24 U11 teams across two tiers) |
| "U11 Girls Rep has 14 games" | "has 10 regular season games, 12 guaranteed with playoffs" |
| Missing entirely | **The guarantee line in the plan scene**: "the promise families are sold: 12 games guaranteed" |

### 4. Game day (game-day-story.tsx)
| Current | Proposed |
|---|---|
| Rosters: 8 home, 7 away dressed | **10 and 9**. Eight dressed players is a short bench for rep. |
| Records 7-2 and 6-3 | Keep (9 games into a 10-game season) |
| Recap standings: 9-1, 18 pts | Keep (2 points a win, consistent) |

### 5. Your week (your-week-story.tsx)
| Current | Proposed |
|---|---|
| Season fee $340, installment 2 of 4 at $85, $170 left | If Part A fee passes: **$1,480, installment 2 of 4 at $285, $855 left** |

### 6. Claim your club (claim-story.tsx)
| Current | Proposed |
|---|---|
| Riverside Ravens "6 teams" | **7 teams** (club truth) |
| Six-digit code, 14-day reservation | Keep. Verified against the real claim flow (crypto 6-digit code, ~14-day reservation in claim-v2.ts). |

### 7. Waivers (waivers-story.tsx)
| Current | Proposed |
|---|---|
| Board: 5 team rows x 22 cells = 110 athletes | **12 team rows x 12 athletes = 144** (the U11 Girls Rep division). 22 players on a basketball team is not a thing. |
| Documents: "214 signatures", "198 signatures", concussion 0 | Rescale to the board's own scope: risk 138 of 144, media 129 of 144, concussion 0 (just published) |
| Registry blurb "a hundred and ten of a hundred and ten" | Update to match the new scope |
| Rowan's Law "every athlete under 26" | Keep, accurate for Ontario |

### 8. The player's season (players-season-story.tsx)
| Current | Proposed |
|---|---|
| Birth year 2015 on a U11 player | **Keep.** Verified against the product's own rule (U11 = born refYear minus 11 or later; 2026 - 11 = 2015). |
| Leaders 18 PTS / 9 REB / 5 AST | Keep |

### 9. The money picture (money-story.tsx)
| Current | Proposed |
|---|---|
| Rep fee rows $340 | $1,480 if Part A passes; camp $210 and gym share $120 stay |
| Reminder cadence: 3 days before, then every 4 days, stops at 90 | Keep (mirrors product behaviour; note: reminder crons are OFF on the box until deploy, runbook #36) |
| Aging buckets 1-30 days / 31-60 | Keep, amounts rescale with the fee |

### 10. Standings to playoffs (playoffs-story.tsx)
| Current | Proposed |
|---|---|
| Standings tables: 8 rows at 8 games played | **12 rows at 10 games played** (division truth). "Top 8 of 12" finally matches its own table. |
| "Everyone plays at least 2 games" | Keep, now backed by the Part A bracket structure |
| "14 playoff games", "21 of 24 booked court-hours" | Keep, both stay true under the new bracket |
| MIN_GAMES = 5 eligibility floor | **Suspect.** No games-played floor exists in the real scheduler (scheduler-v2/playoffs.ts has seeding, byes, pools, placement; no floor). Either cut the beat or tell me the real rule you want the product to have. |

---

## Part C. Suspected holes (strike, correct, add)

Cross-demo:
- **C1. One truth table.** Club 6 vs 7 teams, waivers 110 vs 214, board rows vs tile counts. All resolved by Part A if approved.
- **C2. Loop story shows per-recipient read counts.** The real read-meter UI is unbuilt (the data exists in TeamChatRead). Standing call: build the small panel before launch, or soften the beat to "delivered" counts only.
- **C3. Your-week shows a fee line and waiver inline in a place the real product does not have them** (documented invention in the story header). Keep as aspiration or trim to the real surface.
- **C4. Money demo shows automated reminders; the box has payment crons OFF** (runbook #36). Not a script change: flip the crons on at deploy or the live product undersells the demo.
- **C5. Playoffs eligibility floor** (Part B #10): demo invents a rule the product does not have.
- **C6. Game-day bench depth** (Part B #4).
- **C7. Season Tier 2 with 3 teams** cannot exist under a 10-game season (Part B #3).

Per-demo blanks for what you saw and I did not. You said there are holes; list them here or reply in chat and I will fold them in:
- Roster story: ...
- Loop: ...
- Season: ...
- Game day: ...
- Your week: ...
- Claim: ...
- Waivers: ...
- Player's season: ...
- Money: ...
- Playoffs: ...

---

## Owner rulings, round 2 (08-16)

1. **Loop story math**: the announcement is about Saturday's GAME, and the owner is right that a game concerns both teams. Fix: the club announcement scene becomes a PRACTICE gym change (one team, 12 families, math honest). A NEW chapter shows the league moving or cancelling a GAME: the fan-out goes to both teams automatically, recipients broken down by role on screen (both rosters' parents and kids, coaches, team managers, both club owners: 24 families, 50 to 60 people). Chat back and forth already exists in the story; the league-driven change was the missing scene.
2. **Season venues CONFIRMED from the owner's own DB (Venue table, 08-16)**: Haber Recreation Centre (Burlington), The Playground (Burlington), Six Park East (Oshawa), UTM (Mississauga). Paramount Fine Foods Centre available as a fifth. Data cleanup flagged: The Playground duplicated, UTM name contains an em-dash (rename pending owner word), junk test venues in the table.
3. **Game day goes phone plus phone**: the scorekeeper console AND the parent watch view are both PHONE frames. No tablet or desktop console in the demo. The pitch is "keep score from the phone you already have." Pre-check: the real console must hold up at phone width; if it does not, that screen gets rebuilt first (standing law).
4. **Playoffs format**: no top-8-of-12 cut. Everybody plays: bottom teams play extra converging rounds (play-in style, round after round) mirroring the Grade 10 division structure the owner built in the NPH demo world. Mirror THAT, do not invent.
5. **Playoff eligibility**: 4 games played to qualify IS the standard (owner). Demo shows 4. Product backlog: build the real rule.
6. **Bracket and schedule UI fidelity (product bug, not just demo)**: the real bracket must be a true tree: converging toward the middle, connector lines, bold advancing teams, "Winner of G3" and "Loser of G2" placeholders, consolation visible. The real schedule screen also lags the demo mock. Law applies: REBUILD THE REAL SCREENS FIRST, then the demo mirrors them. The discrepancy existed because demo mocks were drawn fresh while the real screens were never brought up to that standard.

## Final rulings (08-16, round 3) — SHEET CLOSED except two beats

- Owner: "everything you're saying is right." Defaults locked: **144 teams**, promise = **"12 games guaranteed: 10 regular season + minimum 2 playoff"**, leaders line stays, waivers board = one division at 144 athletes.
- **Fee tiers (owner)**: House League programs sit in the **$500 range** (a few months, once a week). REP and prep club fees sit at **$3,000 to $5,000**. Demo uses **$3,000 rep fee = $750 deposit at signup + 3 x $750 on the 1st of the next three months, with a pay-in-full option beside it**. Roster story's house-league card gets a ~$500 fee; tryout $25 and camp $210 stay.
- **E-transfer beat in the money demo (owner flagged the contradiction)**: the demo will NOT present manually recording an e-transfer as the product's answer while an automated Interac flow is on the roadmap. Fix: the manual-record beat becomes "cash taken at the door, recorded with a note" (true today, still shows offline money is handled); the automated e-transfer scene gets added to the demo when that flow ships (already queued as its own build).
- **Two beats wait for the owner to WATCH the demos first**: /demos/money-picture and /demos/your-week (the inline fee/waiver rows question). Everything else is cleared to execute.

## What happens after your corrections

Approved sheet becomes the single source for the Phase 2 script pass (realism + anchored callout balloons on every decision point), then a full re-drive of all 10 and fresh thumbnail captures. The gallery redesign (real screenshots, colored badges, less text) runs in parallel and does not wait on this sheet.
