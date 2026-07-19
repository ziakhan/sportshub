---
updated: 2026-07-19
tags: [theme/marketing, type/spec, status/in-progress]
---

# Flow demo: the contract (owner's words, 2026-07-19)

Real screens only, captured from the live product in the demo world.
Transitioned in this exact order in the click-through stepper. One or two
word captions. Operator steps at desktop size, parent steps at a true
phone viewport. Big, readable, zoomable. If a state does not exist in the
demo world, DRIVE THE REAL PRODUCT to create it, then capture. Nothing
drawn, nothing skipped, nothing invented.

## The flow, in order

**League setup (first)**
1. Create the season
2. Add sessions (dates)
3. Add venues (courts)
4. Referees (pool / assignment setup)
5. Set fees, roster lock date, scheduling rules (min/max games per week
   per session)
6. Publish: registration open

**Club setup**
7. Club signs up / claims its page
8. Creates a team
9. Assigns staff (Head Coach, Assistant Coach, Team Manager, email invite)

**Tryout to roster**
10. Club creates the tryout (sessions, gym, capacity, fee) and publishes
11. Parent discovers the tryout (phone)
12. Parent signs up and pays (phone)
13. Attendance on tryout night
14. Offer templates (packages: fee, deposit, installments, included gear)
15. Send offers
16. Parent accepts: package choice (phone)
17. Payment plan + uniform/tracksuit sizes + jersey number prefs (phone)
18. Deposit paid, submits back (phone)
19. Club board: sizes and numbers recorded
20. Finalize the team

**League entry**
21. Club: one button, pick the roster, submit to the league with payment
22. Roster locked at the lock date
23. League reviews team payments
24. League finalizes at the deadline
25. One button: generate the schedule (session by session, within rules)

**Season proof (already captured)**
26. Live game page, scores hub, news/recaps, standings

## Build steps
1. Staging script: drive the real product through steps 1-25 as the real
   demo personas (UI or API with session cookies), capturing each screen
   at the view moment (desktop 1440x900, phone 390x844@2x) into
   apps/web/public/shots/flow/NN-name.png.
2. Stepper page (unlinked until owner approves): full-res captures in the
   click-driven player, captions of one or two words, click to zoom.
3. Verify EVERY image loads on prod (all of them, not a spot check).
4. Owner reviews. Only then link it anywhere.

## Open issues from the static-shots attempt (owner reported)
- Two or three images 404 on the live pages: diagnose during step 3
  (suspect next/image optimizer on specific files). The static sections
  get replaced by the flow stepper anyway once approved.
- Club dashboard shows the old lowercase wordmark in the workspace drawer
  and a leftover line of developer copy: fix in product, then recapture.
