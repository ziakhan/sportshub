# Demo scenario audit: old demos vs the new ten, phone-first rulings, league lineup for the send

Status: FOR OWNER REVIEW (2026-08-16, before the league send). TWO distinct old sources, both mined:
1. **The HOMEPAGE demo** (what the owner means by "the old demo"): the automated 12-minute flow-demo logged-out visitors see on production. 64 scenes in five flows: League setup, Club setup, Tryouts and offers, League entry, The season. Pans/zooms hand-tuned. It DOES include scheduling (create league, season, divisions, sessions, venues, referees, scheduling, tiebreakers, open registration).
2. **The NPH pitch run-sheet** (docs/demo-runbook-nph-journey.md): the live show driven by hand for league meetings, on the real world (146 teams, official calendar, $3,950 fees, Six Park/Playground/Haber).

## A0. Homepage-demo scenes the new ten LOST (league lens)

| Homepage demo scene(s) | In the new ten? | Verdict |
|---|---|---|
| referees (league setup) | MISSING | Strengthens the "The referees" candidate demo |
| roster-version, roster-locked, roster-change-request | MISSING | League roster mechanics: leagues care. Fold into season story entries chapter or a small league-entry demo |
| team-fee-due, stripe-team-fee, league-payments, record-payment | MISSING | The league collecting TEAM FEES from clubs is a different story from the club money demo, and it is absent. Fold the $3,950 obligation + payment beats into season story |
| offer-templates, bulk-offer | Roster story shows ONE offer | Add the bulk-offer beat when roster story is rebuilt (club shelf, later) |
| check-in (tryout) | MISSING | Phone roll-call beat, already ruled into game-day; tryout check-in returns with roster story later |
| capacity-planner | MISSING | Org-level close, post-send |
| tiebreakers | Partial (playoffs shows the working) | Keep as is |
| champ-recap | MISSING | Ending beat candidate for the playoffs demo |
| live-duo, scores, box-score, standings, news, chat, polls, bracket | Covered by game-day / loop / playoffs | Fine |

## A. What the old journey has that the new demos lost

The old NPH pitch journey runs on the REAL world: 146 teams, the official NPH 2026-27 calendar (13 session weekends Oct 24 to Feb 20 plus three tiered finals weekends), Six Park East with 5 of 6 courts, The Playground Burlington and Haber, the $3,950 fee structure, real club names. Beat by beat against the new ten:

| Old journey beat | In the new ten? | Verdict |
|---|---|---|
| Approve a team, fee obligation appears ($3,950) | Weaker (entries queue, no fee beat) | Absorb into season story |
| Commit FAILS naming the exact weekend and court, add Court 6, everything fits | Similar (the refusal beat) but generic numbers | Absorb with real calendar and venues |
| "Distribute by venue: every division gets a home gym" scenario | MISSING | Absorb into season story. This was the wow. |
| Ottawa Elite Sunday-by-noon request honored, Dragons pending request, Simulate cost, approve, honored | MISSING entirely | Absorb as a season story chapter (requests are a league seller) |
| Publish, phones fill, ICS calendar sync ("in their phone calendar automatically") | Publish ping only, no ICS beat | Add ICS beat |
| Move a game, phones get "schedule changed"; CANCEL with a REASON, phones get the reason | MISSING (ruled back in 08-16) | NEW DEMO: the schedule change |
| Game DEFAULTED, standings show forfeit, fan-out | MISSING | Candidate beat in playoffs demo |
| Withdrawal: approve, future games auto-cancel, "N teams below the guarantee" callout, ADD ONLY THE MISSING GAMES, nobody else moved | MISSING | Strong candidate: own short league demo or season chapter |
| Referee assignments on his calendar + ICS | MISSING (ref appears only at sign-off) | Candidate league demo (referees are a league cost center) |
| Live game: attendance/RSVP roll call, starting lineups, clock, live public page | Partially (game-day has no attendance/lineups) | Add roll-call beat to game-day, ON THE PHONE |
| Referee signature pad, PAPER SCORESHEET printed to PDF | Sign-off yes; scoresheet PDF MISSING | Add: the paper scoresheet kills a league objection |
| Player of the Game to the feed, stat card share | Was players-season (parked); POTG stays in game-day recap | Fine |
| Capacity planner org close ("every league, one pool") | MISSING | Later, org-level demo, not tomorrow |

## B. Verdicts on the current ten

- **Season, planned to published**: KEEP, gold standard, rebuilt with the old journey's real spine: official calendar, $3,950 obligations, commit-fail naming the weekend, Court 6 fix, venue distribution scenario, requests + simulate cost, publish + ICS.
- **Standings to playoffs**: KEEP, mirrors the new bracket tree; add the defaulted-game beat.
- **Waivers**: KEEP (league shelf).
- **Game day**: KEEP, phone + phone; add phone roll-call and lineups before the clock; add the paper scoresheet PDF moment at sign-off.
- **Everyone in the loop**: KEEP but becomes purely club-to-family comms (its league game-change chapter moves out to the new schedule-change demo).
- **Build a team / Claim your club / Your week / Money picture**: KEEP on their shelves; not in tomorrow's league push. Money fee tiers correct to $3,950 rep / ~$500 house / $25-or-free tryouts.
- **The player's season**: PARKED (owner 08-16: photo upload is a feature, not a story; identity law rewrite needed anyway).

## C. New league demos (adds)

1. **"A game moves, and everyone knows"** (RULED): league moves one game, cancel-with-reason shown too, recipient breakdown by role on camera: both rosters' families plus coaches, managers, both club owners, 24 families, 50 to 60 people, zero buttons pressed. Phones receive on camera.
2. **"A team drops out"** (RECOMMENDED, from the old journey): withdrawal approved, future games auto-cancel, the guarantee callout, add only the missing games. "Nobody else's weekend moved" is the single best trust line the product owns.
3. **"The referees"** (CANDIDATE, if time allows): assignments land on the ref's calendar and ICS, availability, per-game pay visibility.

## D. Phone-first composition rulings (owner 08-16)

Owner: wherever a mobile screen exists, REFUSE the PC screen; fabricating a phone composition of a desktop screen is ALLOWED and preferred (two big phones side by side), EXCEPT league scheduling and similar planning surfaces which stay desktop.

| Surface | Frame | Basis |
|---|---|---|
| Scoring console | PHONE (ruled) | Real console must be verified/rebuilt at phone width |
| Live watch, calendars, notifications, waiver signing, offer ACCEPT | PHONE | Real phone surfaces exist |
| Attendance / tryout roll call | PHONE | Real ("roll call happens on your phone at the door") |
| Offer SEND, team creation, tryout posting | PHONE (fabricate ok, owner said team creation on phone is fine) | Phone composition allowed |
| Club comms composer | PHONE (two phones side by side) | Fabricate allowed |
| League planning, scheduling, divisions, bracket building, money table, waiver grid | DESKTOP (owner exception) | Operator working surfaces |
| Readability dividend | Phone frames render near life size, which solves half the small-text disease on those scenes | |

## D2. The recording methodology (owner 08-16: use the OLD demo's presentation, it is day and night)

**SCOPE, OWNER-DICTATED AND VIOLATED ONCE (08-16), NOW HARD:** the old production demo and the old run-sheet contribute PRESENTATION ONLY (sizes, zoom, proportions, phone treatment) plus explicitly blessed non-scheduling beats (requests, ICS, withdrawal, referees, real fees AS THE PRODUCT HAS THEM). Their SCHEDULING AND PLANNING FLOWS ARE OLD AND EXCLUDED, owner verbatim: "Scheduling is definitely the old scheduling... the one we have now is better." Planning and scheduling scenes derive from the CURRENT product only: home court, floater gyms with no bookings, the system stating the hours it needs. League team fees have NO installments. Every scene needs a this-flow-exists-today line (route + code path) before filming.

**SCOPE ENFORCED, SECOND PASS (2026-08-16, after the owner rejected two beats of the rebuilt season story).** Both rejections were the same failure, a beat borrowed from an old flow:

1. **The team fee had a deposit and three installments.** Wrong. `computeDefaultPlan` (`lib/payments/installments.ts`) belongs to the PARENT-TO-CLUB OFFER flow and has no caller on the league path. Approving a submission calls `ensureObligation` ONCE, for the whole fee, dated `season.startDate` minus `balanceDueDaysBeforeStart` (system default 14) in `api/seasons/[id]/teams/[teamId]/route.ts`. League team fees have NO installments; that is now written into `season-story-numbers.md` §0.1 and §B.
2. **The buildings chapter staged an August-1 booked-hours ledger.** Wrong. Owner, verbatim: "The Burlington playground is their home court. We select a damn home court then we give you floater gyms and then you don't have to give the booking of those gyms. We just schedule them and tell you how many you need." That IS the shipping model: `SeasonVenue.role` home/pool (DB confirms The Playground = home, Six Park East and Haber = pool), `plan/gyms-weekends-step.tsx` for the cards and the OPTIONAL bookings control with its skip line, `board-shared.ts` COPY.drawHow for "fills your home gym first, then rents as few gyms as possible", and `plan-ui.tsx` `AskSheet` for "what you need to book", in court-days and court-hours. Rebuilt on that; §0.2 and §D, §G.

The commit-refusal beat SURVIVED the recomposition because it was verified rather than assumed: `lib/scheduler-v2/audit.ts` was re-run against the recomposed November weekend and returned `grade-does-not-fit` with `{demand:42, supply:32, short:10}` and its three options verbatim, and stopped refusing once a third court was rented. Recorded in `season-story-numbers.md` §F.

Every scene now carries its "this flow exists today at &lt;route&gt;" line: `season-story-numbers.md` §0b, one row per beat.

Extracted from the homepage flow-demo engine (flow-demo/frames.tsx) and now LAW for the rebuild:
1. **Compose at ~1160 logical, render at scale 1.0 on PC.** The old engine lays scenes out at DESKTOP_W=1160 and scales min(1, fit): content NEVER shrinks on a computer. Scenes are focused page regions, no browser chrome, no site header, so authored 14-16px text renders at 14-16px.
2. The new engine's mistake, named: full desktop mock incl. chrome at 1120x660, scaled to ~0.85 beside a phone = ~12px text. Banned.
3. Split scenes: never buy a second frame by shrinking the first. Pair two phones at life size (fits), or sequence frames (the acting surface big), or compose the desktop region narrower. Effective scale floor ~0.92; the 14px readability audit is the hard gate.
4. Phone frames at life size (390 logical at 1.0).
5. The old mobile methodology (fixed 0.78 pan scale, auto-scroll to the highlighted control) is the recorded starting point for the LATER phone-presentation round. Parked. BUILT 2026-08-16: the keyhole ships at a fixed **0.85**, not the old 0.78, because a scene is authored to a 14px floor and 14 x 0.78 = 10.9px falls under the 11px phone floor while 14 x 0.85 = 11.9px clears it and renders a 414 logical handset at 352px, the full width of a 390px viewport, so the gate is now two floors against one law: `--floor 11 --scope stage` for the panned scene and `--floor 14 --scope chrome` for the unscaled intro and transport, both 0 violations at 390x844.

## E. The plan for the send (owner wants leagues to get this tomorrow)

Tonight, sequentially, all against the new system (readability machine-check green, DB-derived numbers, slowed one-voice stop-explain-act pacing, fidelity sheets):
1. Season story rebuilt (gold standard) with the old journey spine.
2. The schedule-change demo (new).
3. Standings to playoffs on the new bracket.
4. Waivers.
5. Game day phone + phone (incl. roll call + scoresheet) if the night allows; otherwise it trails by a day and the send leads with 1-4.
Morning: owner reviews the season story FIRST; systematic corrections propagate across the set before anything is sent. Phone viewing for the send: phone-composed scenes read at life size; remaining desktop scenes ride the stacked view with the "best on a computer" disclaimer; the full mobile presentation redesign stays queued behind the send.
"A team drops out" and "The referees" get built right after the send unless the owner promotes them into it.
