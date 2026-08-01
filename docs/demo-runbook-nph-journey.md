---
updated: 2026-08-01
tags: [type/runbook, status/active]
---

# NPH Pitch Journey — the complete run-sheet

Every login: password `TestPass123!`, on https://ysportshub.com.

## Device setup (do this BEFORE the meeting)

| Device | Browser/app | Logged in as | Role in the show |
|---|---|---|---|
| **Laptop A — projector** | Chrome, profile 1 | owner-nph@sportshub.demo | The star: league console — approvals, scheduling, scenarios, planner |
| Laptop A | Chrome, profile 2 (or Safari) | admin@sportshub.demo | Dashboard → Demos, kept open on the stage rail for fast-forwards |
| **Laptop B** (or a second window) | any browser | owner-royalcrown@sportshub.demo | The club: submits a team live |
| **Phone 1 — hand it to them** | native app or mobile browser | parent-journey@sportshub.demo | Priya Reyes — parent of Jordan Reyes #7, Royal Crown Grade 10 (PRIME). Watches calendar fill + notifications |
| **Phone 2 or a tab** | browser | coach-journey@sportshub.demo | Coreen Baptiste — Royal Crown Gr10 head coach. Same notifications, staff view |
| (stage 4) | browser | ref-mike@sportshub.demo | Referee — assignments + scoring console |

Also useful in a tab: owner-ottawaelite@sportshub.demo (the far-club story).

**Pre-flight (15 min before):** admin profile → Dashboard → Demos → **Load
stage 1** on "NPH full-scale journey" (~1 min; wait for the green chip).
Log every device in AFTER the load (loading replaces demo accounts).
Phones: sign in, leave the app on the team/home screen.

## The show, beat by beat

### Stage 1 — "This is your league, mid-registration"
1. **owner-nph@**: Manage → NPH Showcase League → season → **Teams tab**.
   Point at the real names — Royal Crown, Dragons de Gatineau, Burloak…
   ~25 of 146 in, statuses mixed. Open a PENDING team → **Approve** →
   show the fee obligation appear (their $3,950 structure).
2. Show **D1, NPA, WNPA** in the sidebar: fully approved, sessions and
   venues ready — "the rest of your org is already set up."
3. **Laptop B (owner-royalcrown@)**: Browse leagues → NPH Showcase League →
   Register a team → pick one of Royal Crown's unsubmitted teams → submit.
4. Back on **owner-nph@**: refresh Teams — the new submission is there.
   Approve it live.

### Fast forward → Stage 2 — "Registration closed overnight"
5. **admin profile**: Demos → **Fast forward → stage 2** (~10s). Back on
   owner-nph@: Teams now shows **all 146** — the live ones you just
   approved are untouched. Approve one more if you want the rhythm.

### Fast forward → Stage 3 — "Let's build the season"
6. **admin profile**: **Fast forward → stage 3** (~10s). League is
   FINALIZED, everyone approved, fees settled.
7. **owner-nph@ → Schedule tab → Commit whole season.** It FAILS, in
   seconds, naming the exact weekend: *"Weekend 4 · Nov 21 (Gr8, Gr9,
   Gr10, JrGirls) needs 84 games but has 80 court-slots — extend hours or
   add a court."* The season runs NPH's OFFICIAL 2026-27 calendar (the
   registration graphic): 13 session weekends Oct 24 → Feb 20, every grade
   on its own five, plus the three tiered finals weekends (Feb 27-28,
   Mar 6-7, Mar 13-14) already sitting as playoff sessions. Only Six Park
   is attached — with 5 of its 6 courts.
8. **Sessions tab** → Six Park East → add **Court 6** → run again →
   **every game fits** on Six Park alone. Then the kicker: "but every
   family drives to Oshawa every weekend — watch." **Venues panel** →
   attach **The Playground Burlington** and **Haber Rec** (add-to-sessions
   on).
9. **Scenarios** button → **"Distribute by venue — every division gets a
   home gym"** (grades split across Six Park / Playground / Haber, no
   two-gym weekends, requests still honored) → **Use this scenario** →
   Preview → **Commit whole season**.
10. **Requests**: Teams → Ottawa Elite → show the APPROVED Sunday-by-noon
    window honored in the fairness report ("they drive back to Ottawa").
    Then Dragons de Gatineau → the PENDING request → **Simulate cost**
    (show the diff: "approving costs nobody anything") → **Approve** →
    re-run the schedule → honored.
11. **Publish** (Schedule tab) — now turn to the phones:
    - **Phone 1 (parent-journey@)**: Jordan's team calendar is FULL; the
      bell shows the publish notice (+ email).
    - Settings → **calendar sync**: subscribe the phone's calendar app to
      the ICS feed — "it's in their phone calendar, automatically."
12. **Change management**, still on owner-nph@:
    - Move one Royal Crown Gr10 game → phones get "schedule changed."
    - Cancel one game, pick a **reason** ("Venue unavailable") → phones
      get the cancellation WITH the reason.
    - Mark one game **DEFAULTED** (forfeiting team = opponent) → standings
      show the win by forfeit; notifications fan out.
13. **The drop-out**: Teams → the pending **withdrawal request** (Orillia
    Lakers) → Approve → future games auto-cancel, opponents notified →
    Schedule tab shows the amber "*N teams below the guarantee*" callout →
    **Preview the fix** → **Add ONLY the missing games** — "nobody else's
    weekend moved."

### Fast forward → Stage 4 — "Six weeks later: game day"
14. **admin profile**: **Fast forward → stage 4** (~1 min). Two weekends
    now COMPLETED: standings, stat leaders, box scores — all real names.
15. **ref-mike@**: his calendar shows the day's assignments (also in his
    phone's ICS feed).
16. **The live game** (owner-nph@ or the scorekeeper flow): open the next
    scheduled game → scoring console → attendance/RSVPs → starting
    lineups → clock → score a few possessions — have **Phone 1** on the
    public game page: it updates LIVE. Finalize → **referee signature**
    pad → open the **paper scoresheet** (print → save as PDF).
    Phones get the final-score notification.
17. **Social close**: on the finalized game, select **Player of the Game**
    (Jordan Reyes if Royal Crown won the room's heart) → the card lands on
    the feed. On Phone 1, share Jordan's **stat line card** from the box
    score — "this is what the kids and parents actually see."

### The org close
18. **owner-nph@**: Organization → **Capacity planner** → select all
    leagues → Run — "every league, every court, one pool: everything
    fits." (Pull a lever if they ask: hold a court free, re-run.)

## If something goes sideways
- Status panel looks stuck on the Demos page → refresh; the "loaded ·
  stage N" chip is the truth.
- Wrong world / demo went off the rails → **Load stage 1** again (1 min)
  and fast-forward back to where you were. Everything reseeds identically.
- Never run the old CLI seeders during prep — the Demos page only.

## Honest limits (don't promise these live)
- True phone push (APNs/FCM) still waits on the Apple/Google keys —
  today's "notification on the phone" = the in-app bell + email + the
  phone-calendar ICS feed, which all work.
- The journey world's players are fictional by design (real rosters are
  minors); team, club and venue names are NPH's real ones.
