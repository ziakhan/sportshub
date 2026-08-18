# Multi-league scheduling + playoff gym allocation — design
**2026-08-10 · owner: "we do need to be able to choose the gyms and playoff availability should also allocate gyms. We do need to allow multiple leagues to be scheduled at the same time... we only did the showcase league. Let's think about that and start planning it."**

Status: DRAFT FOR OWNER QUESTIONS — nothing built.

## 1. What NPH's reality demands (evidence from the saved data)
- One organization runs FOUR leagues at once (Showcase, D1, NPA, WNPA) out of the same rented buildings. Their playoff dates prove it: other leagues' brackets ran at Six Park East on Feb 21-22 alongside Showcase Grades 9 and 12, and shared The Playground the following weekend.
- Buildings are rented by the ORG, not by a league: Six Park East (Oshawa, 6 courts), The Playground (Burlington, 3 courts), Peel school gyms as overflow.
- The travel law holds in playoffs exactly as in the regular season: no grade's bracket ever straddled distant cities; multi-building weekends stayed within a close cluster (Grade 10 across Mississauga + Brampton schools = Peel cluster).
- Audit of OUR twin plan (2026-08-10): Grade 10 and Grade 12 brackets straddle Oshawa + Burlington in one weekend — the playoff placer pools every booked court and never learned the regular season's laws. Confirmed defect.

## 2. Today's model and the two gaps
Venue is global; SeasonVenue links a season to venues; SeasonSessionDayVenue books a venue-day (hours + courts) per season.
- **Gap A — cross-season blindness:** nothing checks whether ANOTHER season/league booked the same building the same day. Two leagues booking Six Park's 6 courts each would both believe they have all six.
- **Gap B — playoff placement ignores buildings:** placeWeekend treats a weekend's booked courts as one pool; brackets overflow across cities.

## 3. The design, staged

### Stage P — playoff gym allocation (small, closes the defect)
- Playoff placement learns grade-stays-together: grades bin-pack WHOLE into buildings (biggest grade → roomiest building); a bracket never spans buildings.
- Per-grade override on the card, sentence-style, beside "Which weekend?": **"Plays at: [building]"** (auto by default). Stored as `playoffConfig[grade].venueId`.
- Preflight line blocks what it can't hold: "Grade 10's 47 games need Six Park East; The Playground only holds 54 that weekend."
- (Later, with Stage 2's clusters: "building" widens to "cluster".)

### Stage 1 — cross-season visibility (the guard)
- A venue-day ledger across ALL seasons/leagues: who booked what (courts × hours).
- Planning UI: booking a day shows "also here that day: D1, 3 courts 10:00-16:00" and warns when combined claims exceed the building's real courts.
- The auditor gains the same check season-side: BLOCK when a weekend's booked courts are oversubscribed across seasons.
- No schema change: it's a query across existing SeasonSessionDayVenue rows + venue court counts.

### Stage 2 — ORG PLANNING ACROSS LEAGUES (demand first; corrected by owner 2026-08-10)
**The premise (owner): "the whole reason we introduced the planning phase was that you need to plan across leagues to see how many courts you need." Nothing assumes a rental exists — the plan PRODUCES the rental decision.**
- The org planning surface sums DEMAND across every league's season for the term: Showcase 145 teams' games + D1 + NPA + WNPA, per weekend, in court-hours — the same sufficiency math the single-league planner already does, aggregated.
- Output = the shopping list: "all leagues together need ~N court-hours per weekend; Six Park (6 courts) + The Playground (3) covers it with X to spare / leaves you short Y — rent another building or add hours."
- Each league still plans in its own wizard; the org view reads those plans live. Booking happens INFORMED by the picture, and once booked, per-league claims are simply what each plan already said it needs — allocation falls out of planning, it is never a separate afterthought decision.
- Geographic clusters live here: mark near-by gyms (Peel schools) as one cluster so the travel law treats them as one building, org-wide.
- Stage 1's ledger stays as the safety net for leagues that book without org planning.

### Stage 3 — joint optimization (recorded, not now)
One engine run across leagues sharing supply. Not needed while league plans fit the shared picture.

## 4. Releasing multi-league (the demo)
The demo world already seeds D1 (10 teams), NPA and WNPA with real teams — never scheduled. Release story: plan + schedule D1 alongside the Showcase League into the SAME buildings, showing the ledger, the warnings, and (Stage 2) the org allocation. That is the "multiple leagues at the same time" proof.

## 5. Open questions for the owner (asked 2026-08-10)
1. Build order: Stage P alone first, or P + 1 together, or all of P/1/2 as one arc?
2. Stage 2's org layer: needed for the GTM pitch now, or fine as the follow-up?
3. Which league joins the demo first (D1 recommended: 10 teams, one division, lightest)?
