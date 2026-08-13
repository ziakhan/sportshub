# Demo World Spec — Limited Launch (draft 1, 2026-08-12)

**Status: DRAFT FOR OWNER MARKUP. Every name, state, message, and count below is a default. Change anything. Items tagged `NEEDS-BUILD` are features that must be built before that line can be seeded; everything else is seedable with what exists today.**

One world, one spec: the public site and the demo personas are two lenses on the same seeded season. Sections marked PUBLIC are visible with no account; PERSONA sections are visible only inside a role. Visitor session actions (their RSVPs, their chat messages) layer on top per browser session and are not part of this spec.

---

## 1. Identity

| Item | Default | Notes |
|---|---|---|
| League name | **Maple Court League (MCL)** `[OWNER: name it]` | Fictional until NPH signs (standing ruling). Must not collide with any real league. |
| Organizer brand | "MCL Basketball" | Shows on the branded hub. |
| Grades | Gr 5 through Gr 12, boys + girls `[OWNER: trim?]` | Full spread shows scale; could trim to Gr 7-12 for tighter data. |
| Divisions | Big grades (Gr 9-12) split into two divisions each; small grades single | Shows the divisions feature in standings. |
| Clubs | 12 fictional clubs `[OWNER: name them]` — defaults: Lakeside Storm, Crosstown Royals, Northgate Wolves, Harbour City Hoops, Ridgeview Rise, Bayfront Blues, Summit Select, Ironwood Elite, Eastfield Eagles, Parkdale Panthers, Westgate Warriors, Cedar Hill Cyclones | RULE: seed-time validation that no name collides with the 188 real imported Ontario clubs. |
| Teams | One team per club per grade entered (not all clubs in all grades); ~60 teams total | Realistic spread, some grades 6 teams, some 10. |
| Players | Fictional ALWAYS (permanent rule: never real minors). Realistic, diverse Canadian names; correct birth years per grade; 10-12 per roster | Generated list reviewed once by owner, then frozen. |
| Coaches/staff | Fictional adults, one head coach + one manager per team | Ghost coach names used in chat scripts below. |
| Venues | 3 fictional gyms: **The Yard (6 courts)**, **Harbourview Fieldhouse (3 courts)**, **North Gym (2 courts)** `[OWNER: names]` | Mirrors the real Six Park + Playground shape so the pitch demo math also works. |

## 2. Season states (the world's timeline)

The world sits at one frozen moment: **regular season COMPLETE, playoffs COMPLETE for older grades, one "showcase weekend" perpetually live.**

| Layer | State | Side |
|---|---|---|
| Regular season | 100% complete: every game has final score, box score, per-player stats | PUBLIC |
| Standings | Final tables per division, tiebreakers visibly applied | PUBLIC |
| Playoffs | Completed brackets for Gr 9-12 with champions + finals recaps; consolation results visible | PUBLIC |
| Awards | Champion banners, season stat leaders (pts/reb/ast/stl/blk), All-Star five per grade `NEEDS-BUILD (awards page light)` `[OWNER: cut or keep]` | PUBLIC |
| Showcase weekend | A rolling "exhibition weekend" that hosts the LIVE GAME CAROUSEL (§3) + the next day's fixture list | PUBLIC |
| Open tryout | One club (Lakeside Storm) has a tryout listing open for next season | PUBLIC + gate |
| Registration | "Fall season: registration opens soon" states on league hub | PUBLIC + notify-me |

## 3. The live game carousel (the centerpiece)

Owner ruling 08-12: multiple simultaneous live games, continuous, restarting after finish. Public game pages show play-by-play refreshing with NO account.

- **3 concurrent live games** at staggered points: one early (1st quarter), one mid (3rd), one in final minutes. `[OWNER: 2 or 3?]`
- **Ghost scorer** `NEEDS-BUILD`: a server-side driver scoring each game through the real scoring pipeline (events → live page → box score), ~25-30 min per game real time.
- On finish: game FINALIZES through the real pipeline → recap auto-publishes (existing AI/template path), Player of the Game posted, standings-adjacent surfaces update → after a ~5 min cooldown the slot starts its next fixture.
- Fixture pool: a bank of ~12 showcase match-ups recycling daily; scores vary run to run (seeded randomness is fine here, these games do not touch the frozen standings — exhibition flag). `[OWNER: confirm exhibition framing]`
- The league hub and homepage show a **"LIVE NOW" strip** whenever carousel games are running (existing scoreboard strip).
- Off-hours: carousel can run 24/7 (it is all fictional) or on a schedule (e.g., 8am-11pm ET). Default: 24/7. `[OWNER?]`

## 4. Feed plan (the content calendar)

Frozen base feed (seeded once) + rolling posts from the carousel.

| Post type | Count in base feed | Example | Buildable? |
|---|---|---|---|
| Game recaps | ~30 across the season, every playoff game | "Storm hold off Royals 58-54 in Gr10 semi" | EXISTS |
| Final-score posts | Auto per game | | EXISTS |
| Player of the Game | ~20, with photos (stock/generated, fictional kids) | | EXISTS |
| Shareable stat cards | ~10 | | EXISTS |
| Club announcements | 2-3 per club (tryout posted, practice schedule, photo day) | | EXISTS |
| League news articles | 5-6 (season preview, midseason report, championship wrap, award winners) | | EXISTS |
| Stories | A seeded rail (championship day, behind the bench) | | EXISTS |
| **Match-up previews** | "Saturday: #1 Storm vs #3 Wolves — the rematch" | | `NEEDS-BUILD` (new post type) |
| **Prediction polls** | "Who takes Gr11 final?" with live result bars | | `NEEDS-BUILD` |
| **Gamification posts** | Points leaderboards, badge drops | | `NEEDS-BUILD` (points/badges feature, ledger A4) |
| Rolling: carousel recaps + POTG | Continuous from §3 | | EXISTS once carousel built |

`[OWNER: mark counts + which NEEDS-BUILD types block launch vs come later]`

## 5. Persona states (first screen is staged, never accidental)

### Parent persona ("Sam, parent of two")
- **Lands on My Calendar**: two kids (Gr 8 boy on Northgate Wolves, Gr 10 girl on Lakeside Storm), this weekend visible, one carousel game involving a kid's team LIVE right now.
- **Offer waiting** (badge on entry): Lakeside Storm spring program offer, deposit + 3 installments shown. Walkable to final accept; accept = session-scoped, drops welcome message in chat + kid shown on roster for that session.
- **Chats**: two team chats with staged history (scripts §6); visitor messages get ghost replies.
- Bell: 5-6 staged notifications (game moved last week, waiver signed, recap published, POTG for her son).
- Payments page: paid history + upcoming installment (display only).

### Coach persona ("Coach Dre, Northgate Wolves Gr 8")
- Lands on team page: roster with jerseys, RSVP roll-up for the live/upcoming game (3 going, 1 maybe, 1 no-reply), practice this Tuesday.
- Team chat with parent questions staged; a quick poll running ("Saturday carpool?").
- Scoring console visible on the live game `[OWNER: read-only view, or session-scoped "try scoring" sandbox? — bigger build]`.

### Club owner persona ("Jordan, Lakeside Storm")
- Lands on club console: 6 teams, the open tryout with 14 signups, offer pipeline (sent/accepted/expiring), order sheet with size breakdown, fees dashboard (collected vs outstanding), club page editor visible.

### League operator persona `[OWNER: public or meetings-only?]`
- Lands on season console: overview checklist complete, standings, schedule board, playoff brackets, referee assignments, waiver grid at 100%.

## 6. Chat scripts (exact messages)

**Northgate Wolves Gr 8 — team chat (staged history):**
1. Coach Dre: "Practice moved to Tuesday 6:30 at The Yard, court 4. Calendar's updated."
2. Parent (fictional): "Thanks coach, we'll be there."
3. Coach Dre: "Saturday game is 9:40am vs Panthers. RSVP on the event so I can set the lineup."
4. System card: game reminder with RSVP buttons.
5. Coach Dre: "Recap from last week is up — proud of this group." (links recap)

**Ghost replies to visitor messages (canned, session-scoped, 5-15s delay, rotate):**
- "Sounds good, see you Saturday. Game's at The Yard, court 2."
- "Thanks for the heads up!"
- "Check the calendar — everything's up to date there."
- (After RSVP "can't make it"): "No problem, thanks for letting me know."
- (After offer accept): "Welcome to Storm! Jersey sizes are in your offer — see you at first practice."

`[OWNER: rewrite any of these in your voice]`

## 7. Hint balloons ("experience beacons") `NEEDS-BUILD (one component)`

Floating dismissible pills anchored to features, capped at one visible at a time, never shown again once dismissed (per browser):

| Where | Copy (draft) |
|---|---|
| League hub, when carousel live | "2 games are live right now — tap in and watch the score move" |
| Live game page (anonymous) | "This is live scoring. It updates as the table scores — no refresh, no login" |
| Feed recap post | "Recaps write themselves the moment a game ends" |
| Standings | "Standings update the second a scoresheet is signed" |
| Tryout listing | "This is how families join a program — try it in the demo" |
| First scroll on any page | Pulse the Demo drawer tab once |
| Inside parent persona, calendar | "This is every kid, every team, one calendar — try RSVPing" |
| Inside parent persona, offer | "Open your offer — this is how families accept and pay" |

`[OWNER: add/cut/reword]`

## 8. Exclusions (must NOT appear)

- Real player names or any real minor's identity. Real club/league/venue names (until NPH signs).
- Real money movement: all payment surfaces display-only or session-scoped; no live Stripe.
- Operator money/accounting in public personas `[OWNER: confirm]`.
- Anything unfinished or rough at the time of seed freeze (final visual pass gate).
- Demo entities in real directories/search: own section + noindex (standing ruling).

## 9. Mechanics recap (from the limited-launch plan)

Nightly reset rebuilds the frozen world identically; carousel + ghost replies + session writes run between resets; session writes purge at reset; kill switch hides the whole demo era on launch day. Welcome pop-up → open browsing → big right-edge Demo drawer → signup gate → personas.

## 10. Build list this spec implies (beyond seed data)

1. Ghost scorer / live carousel driver `NEEDS-BUILD`
2. Session-scoped write layer + ghost reply engine `NEEDS-BUILD`
3. Persona demo sessions + signup gate + drawer + pop-up `NEEDS-BUILD`
4. Hint balloon component `NEEDS-BUILD`
5. Match-up preview + prediction poll post types `NEEDS-BUILD` (gamification posts wait on points/badges)
6. Demo flag + badges + directory section + noindex `NEEDS-BUILD`
7. Spec-driven seeder (this document → world) `NEEDS-BUILD (rework of existing seeder)`
