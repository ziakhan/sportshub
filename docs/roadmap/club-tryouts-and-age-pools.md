# Club tryouts and age-group pools

**Status: design approved in conversation (owner, 2026-08-20). NOT BUILT — build starts only on an explicit go.**

## Why

Real clubs announce one tryout event covering several age groups (the Instagram pattern: "Fall tryouts — U11 Mon 6pm, U13 Mon 7:30, U15 Wed"), planned by club managers, often before anyone knows how many teams each age group will field. Today only a team can post a tryout for itself, which forces a team to exist before the club knows whether it should.

## Owner rulings (binding)

1. **Tryout events are club-level.** (League is not involved — dictation correction confirmed.) The existing team-posted tryout stays untouched as the simple case.
2. **Sessions are logistics, pools are structure.** One session can host several age groups together; whichever session a kid attends, they land in their age-group pool.
3. **The pool is the centre of gravity.** Status ladder: registered → offered → accepted → **assigned**. "Accepted but unassigned" is a normal resting state. Kids stay in the age-group pool until a person puts them on a team.
4. **Offers go out by selection, not by team.** Filter the pool by age group, select kids, attach an offer template, send. Different fees inside one age group = different selections with different templates. Money commits at acceptance; no team required anywhere in this step.
5. **Team count is decided late.** Clubs announce two or three teams based on accepted counts (and how many showed up). The pool view must make accepted-per-age-group counts prominent — that number drives the decision.
6. **Assignment is a free market inside the club.** Any club staff can pick any unassigned accepted player from the pool. First assignment wins. Release/transfer requests between team staffs (accept/decline) move players back to the pool or across teams. **The platform imposes no assignment-authority policy** — clubs coordinate internally.
7. **Cross-team privacy line.** Browsing the pool: unassigned players fully visible to club staff; an assigned player shows name + "assigned to Team X" — and that is the entirety of what crosses team lines. Assigned players stay listed with the tag.
8. **Families are notified at team finalization**, not on every assignment shuffle. Internal moves are silent; the finalized team announces.
9. Money at offer, jersey at assignment — commitments never attach at the tryout stage.
10. **Marketplace rendering** (2026-08-20): one public card per age group per time per place, grouped under the event name (eyebrow + club-page section). Different times or venues are NEVER combined on one card; every card carries start, end, location. The planner manages everything in one place; only the public rendering fans out.
11. **Capacity and signup counts** (2026-08-20): per-age-group capacity is meaningless for tryouts (clubs flex team count to turnout). Sessions may carry an optional gym capacity for the club's own planning; it never renders publicly. Public signup counts are hidden by default with a per-event opt-in toggle; the club dashboard always shows real counts.

## Model sketch

- The schema is already close: `Tryout` is tenant-owned with nullable `teamId`, own ageGroup/fee/venue/schedule. New: event grouping + sessions (`serves ageGroups[]`, time, venue, capacity, tryout fee), pool membership + status per (club, season, ageGroup, player), club-level offer templates (age-group program fees; per-team templates remain), release/transfer request handshake, finalize-team action that triggers family notifications.
- Reuses as-is: offers + payments, teams, staff roles/CASL, venues, one-identity-per-person.

## Defaults assumed, pending owner confirmation

1. **Pool scope** = (club, season, age group); multiple events (fall tryouts, January top-up) feed one pool.
2. **Session choice**: family registers for the event and picks any session whose age groups include their kid; no club-side routing.
3. **Assignment reach**: any club staff onto any club team (widest reading of "everybody can pick up players").

## Phasing (when built)

- **P1** Club tryout event + sessions (multi-age-group) + family registration → pools fill.
- **P2** Pool console: filter by age group, selection-based offers with attached templates, accepted counts loud.
- **P3** Assignment market: pick-from-pool, release/transfer requests, finalize-team notification moment.

## Deferred — needs its own planning session (owner, explicitly not now)

- **Private per-coach notes on pool players.** Every coach keeps their own notes; never visible to other coaches (first-choice/second-choice politics are coordinated humanly, not in the product). To be designed properly later.
- **Player evaluation system.** Owner has a separate plan for evaluating players; do not improvise one into the pool console.
  → **Planning session held 2026-08-21: [[tryout-evaluation-design]]**, with the research behind it in [[tryout-evaluation-2026-08]]. Visibility became a club setting rather than a platform rule (owner), and the private-notes ruling above survives as the default with a per-item override no club setting can override.
