---
updated: 2026-08-01
tags: [type/runbook, status/active]
---

# NPH Pitch Journey — demo run-sheet

Load worlds from **admin@sportshub.demo → Dashboard → Demos** (password
`TestPass123!` for every demo login). Loading replaces the demo world;
**Fast forward only adds** — everything you demo live survives.

## Accounts
| Login | Who | Used for |
|---|---|---|
| admin@sportshub.demo | Platform admin | The Demos loader page |
| owner-nph@sportshub.demo | NPH league owner | Approvals, scheduling, requests, planner |
| owner-royalcrown@sportshub.demo | Royal Crown club | Live team submission + club side |
| owner-ottawaelite@sportshub.demo | Ottawa Elite club | Far-team request story |
| ref-mike@sportshub.demo (PIN 1234) | Referee | Assignments + scoring console (stage 4) |

## The script

**Stage 1 — Registration in flight** (~1 min load)
1. owner-nph@: Showcase League → Teams — ~25 of 146 in, mixed statuses.
   Approve one pending team; show the fee/payment status flow.
2. owner-royalcrown@: Browse leagues → Showcase League → submit a team
   (they have unsubmitted real teams ready).
3. Show D1 / NPA / WNPA already fully approved and schedule-ready.

**Fast forward → Stage 2 — Everyone's in** (~10s)
4. All 146 census teams now submitted. Approve one more live.

**Fast forward → Stage 3 — Ready to schedule** (~10s)
5. owner-nph@: Schedule tab → **Commit whole season** → it comes up SHORT:
   "Court capacity is N games short… add a court." (Deliberate — Six Park
   is attached with 5 of its 6 courts.)
6. Sessions tab → add **Six Park Court 6** → run again → all 720 games fit.
7. **Scenarios** button → "Distribute by venue" card: every division gets
   a home gym (Six Park / Playground / Haber balanced ~80%) → Use this
   scenario → preview: 0 back-to-backs, 0 two-gym days → **Commit**.
8. Requests: the Ottawa Elite + Capital Courts approved windows are
   honored in the fairness report; Dragons de Gatineau is PENDING —
   Simulate its cost live, approve, regenerate.
9. **Publish** → second screen (parent/coach login or the phone app):
   calendars fill, bells + emails land. Settings → calendar sync = the
   phone-subscribable ICS feed.
10. Move one game → change notification. Cancel one WITH a reason →
    families see the reason. Mark one DEFAULTED (forfeit) → win by
    forfeit in standings + notifications.
11. The seeded **withdrawal request** (Orillia Lakers): approve it →
    future games cancel, gap callout appears → "Add ONLY the missing
    games" → nobody else's games move.

**Fast forward → Stage 4 — Game day** (~1 min)
12. Two weekends now COMPLETED with box scores, stat leaders, standings.
    ref-mike@ is assigned to the next slate (his calendar + ICS show it).
13. Live-scoring demo on the next game: attendance, starting lineups,
    clock, live scoring → public game page updates in real time →
    finalize with the **referee signature** → open the **paper
    scoresheet** (print/save as PDF) → final-score notifications land.
14. Social close: select Player of the Game → the card posts to the feed;
    a player shares their stat-line card.
15. Org close: Organization → **Capacity planner** → all leagues, one
    court pool → "everything fits."

## Notes
- True phone PUSH still waits on Apple/Google keys (owner-owed): today the
  "notification" beats are the in-app bell + email + the native app.
- Never run the old seeders (demo-scoring-game etc.) — Demos page only.
