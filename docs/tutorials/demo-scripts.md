---
updated: 2026-07-07
tags: [theme/demos, type/tutorial, status/reference]
---

# Demo scripts — every use case, step by step

One entry per video/demo. Each lists: who you sign in as, where you start,
the steps, and the **payoff** (the shot that proves it). All run on the NPH
demo world — reseed first for a pristine set: `npx tsx scripts/seed-nph-demo.ts`.

**Accounts** (password `TestPass123!`): `owner-nph@sportshub.demo` (league) ·
`owner-lords@sportshub.demo` (club) · `coach-lords-gr9@sportshub.demo` (coach)
· `parent@sportshub.demo` (2 kids: Mateo/Lords G9, Jordan/Force G10) ·
`ref-mike@sportshub.demo` (PIN 1234) · `admin@sportshub.demo`.

**Device per audience (owner decision input, 2026-07-07):** league + club
demos = full-screen DESKTOP (recording at 1440p; the calendar's week GRID
view is the desktop default). Parent + referee demos = PHONE frame
(responsive viewport ~390px; the calendar shows the agenda view + "Add to
phone"). Rationale: that's each audience's real device — operators work at
desks, families live on phones.

---

## 🏆 LEAGUE — L-long master tour (~15-25 min, chaptered; L-short sizzle is cut from it)

**As `owner-nph@` unless noted.**

| Ch | Chapter | Steps (high level) | Payoff |
|----|---------|--------------------|--------|
| 1 | Create a league | "+ New" menu → Create a league (`/manage/leagues/create`) → name, sport config. No role picker — creating it MAKES you the league owner. | League dashboard exists |
| 2 | Create a season | League → New season: label, team fee, games guaranteed, registration deadline. | Season card, REGISTRATION status |
| 3 | Divisions + club intake | Season Manage → Divisions tab: add divisions (Grade 8-11). Clubs submit teams (show `owner-lords@` side: team dashboard → Add to league → pick roster version → submit). Approve submissions in Teams tab. | Approved team list w/ locked rosters |
| 4 | Sessions + dates | Manage → Sessions tab: create a REGULAR session, add session days (the actual Saturdays/Sundays). | Session with dated days |
| 5 | Venues + times + courts | Manage → Venues tab: attach venues (each carries **default hours** — weekends 8-6, weeknights 5-10); Sessions tab: pick a date and the day window **prefills from the venue's hours for that weekday**, editable; courts + capacity fit. | Date picked → times fill themselves |
| 6 | Referees | Manage → Referees tab: build the pool; broadcast a session-day shift offer. Cut to `ref-mike@` → `/referee/requests` → set availability, accept the shift (first-accept-wins auto-assigns the day's games). | Referee attached to game rows |
| 7 | Generate the schedule | Manage → Schedule: preview (fairness, utilization) → **Commit**. | Games appear in the season schedule |
| 8 | **THE PAYOFF** | The moment commit lands: club managers get a bell; every team's coach/TM/parents get bell + **email** ("Lords G9: 10 games scheduled"). Cut to `parent@` → team calendar full of games → same games on an iPhone via the subscribed feed. | Notification tray + calendar + phone |
| 9 | League-wide event | Any G9 team calendar (league owner has authority via approved submissions) → Add event "NPH Media Day", tick multiple teams. Every family belled once; event on all calendars + phones. | One event, six calendars |
| 10 | Season runs | `coach-lords-gr9@` (or scorekeeper) → `/score` → live console: score a period; public `/live/[game]` updates for `parent@`; finalize w/ referee PIN sign-off → scoresheet PDF + AI recap auto-publishes → standings/leaders move (`/league/[season]`, `/leaders`). | Recap on the homepage; standings update |
| 11 | Money | Manage → league fees view: who paid, obligations, amounts collected. | $ roll-up |

**L-short (3-4 min sizzle):** chapters 1→8 compressed + one live-scoring beat
+ standings. Scripted voiceover. This is also the GTM outreach asset.

---

## 🏀 CLUB — 12 shorts (60-120s each)

**As `owner-lords@` unless noted.**

- **C1 — Create a club**: "+ New" → Create a club (`/clubs/create`) → name/city/branding. Creating it makes you ClubOwner. *Payoff: club dashboard.*
- **C2 — Create a team**: Club → Teams → New team: name, age group, gender, season. *Payoff: team card on the dashboard.*
- **C3 — Assign staff**: During team create (or Edit Team): assign existing staff or invite by email — Head Coach / Assistant Coach designations, Team Manager role; hand-off: what a club manager vs team manager can do. *Payoff: staff badges on the team.*
- **C4 — Post a tryout**: As **coach or team manager** (`coach-lords-gr9@`): team dashboard → New Tryout → title, date, location, fee, publish. *Payoff: tryout live on the public marketplace.*
- **C5 — Tryout day**: Signups list (`/clubs/[id]/tryouts/[id]/signups`) → phone check-in page → tap kids in as they arrive; progress bar; no-shows visible. *Payoff: roll-call done on a phone.*
- **C6 — Offer templates**: Club → Offer Templates → create "New Player 2026" (uniform+bag+ball, $1,250) and "Returning Player 2026" (no kit, $950). *Payoff: reusable package library.*
- **C7 — Send offers (+ bulk)**: Signups page → tick several players → Send Offers → attach BOTH templates as package options → send once to all. *Payoff: N offers out in one click.*
- **C8 — Family accepts (parent POV)**: `parent@` → `/offers` → open offer → choose package (Returning vs New) → sizes + jersey prefs → accept → kid auto-rosters. *Payoff: roster grows by itself.*
- **C9 — Finalize the team**: Accepts roll in → roster page → Order Sheet (`/clubs/[id]/offers/summary`): per-team size roll-ups, jersey numbers, CSV for the uniform vendor → submit team to league (roster version → lock). *Payoff: Order Sheet + league submission.*
- **C10 — ONE team calendar**: Team calendar → set practice days → **Announce** (bell+email to every family) → league games land automatically → Add event (photo day; club managers tick sibling teams) → "Add to phone" (iCal). *Payoff: practices + games + events on a parent's iPhone.*
- **C11 — Finances**: Club payments view: posture (online/offline), obligations per family, who-paid-what, installments. *Payoff: money table reconciles.*
- **C12 — Communications**: Team chat (STAFF badge, moderation) → 📊 quick poll in the stream (tap-to-vote bars) → multi-question survey on the Polls page (staff see who voted what). *Payoff: poll bars filling live.*

---

## 🎬 LIVE SCORING & SCOREKEEPING — standalone short (S1)

**As `coach-lords-gr9@` (console) + `parent@` (second screen/phone).**

- **S1 — Score a game live**: `/score` → open the game console → attendance
  → start period → tap scoring/rebounds/fouls (offline-safe queue) → BOX
  overlay mid-game → second screen: `parent@` watching `/live/[game]`
  update within 10s → final → referee PIN sign-off (`ref-mike@`, 1234) →
  scoresheet PDF + AI recap auto-publish. *Payoff: the parent's screen
  moving a beat after every console tap.* (Also chapter 10 of L-long —
  this short is the deep cut for scorekeepers/refs.)

---

## 👨‍👩‍👧 PARENT — 5 shorts (phone frame)

**As `parent@` (or a fresh signup for P1).**

- **P1 — Sign up & add your child**: Sign up (fresh email) → "I'm a Parent" card → profile → dashboard → Add a child. *Payoff: kid on the dashboard.*
- **P2 — Discover programs**: Browse clubs (featured, ratings, city filter) → club page (reviews, teams) → marketplace: tryouts / camps / house leagues → follow a team. *Payoff: found the right program in under a minute.*
- **P3 — Register + accept an offer**: Sign kid up for a tryout → after tryout day, offer arrives (bell + email) → choose package → sizes/jersey → pay or installments. *Payoff: "You're on the team."*
- **P4 — Follow the season**: Dashboard rows per kid (Chat · Polls · Calendar) → live game (`/live/...`) → practice/game/event calendar on the phone. *Payoff: whole season in your pocket.*
- **P5 — The stats world**: public **team page** (record, schedule, roster, player averages) → **player page** (kid's game log, season averages, consent-gated naming) → league **stat leaders** ("is my kid on the board?") → **standings** → **club page** (teams, reviews, programs). *Payoff: a kid's own ESPN page.*

---

## 🦓 REFEREE — 2 shorts

**As `ref-mike@`.**

- **R1 — Get booked**: `/referee/requests` → set availability windows → shift offer arrives → accept (first-accept-wins) → day's games auto-assigned. *Payoff: Uber-style booking, zero phone calls.*
- **R2 — Game day**: Scoring console access → verify score at final → PIN sign-off (1234) → scoresheet locks + emails both clubs. *Payoff: signed scoresheet PDF.*

---

## Status: what each demo depends on

Every use case above (2 league cuts, 12 club, 1 scoring, 5 parent, 2 referee shorts) is **recordable today** on the demo world — the
storyline gaps were closed 2026-07-07 (schedule-publish fan-out, TeamManager
tryouts, team events/one-calendar, multi-package offers + bulk send). The
catalog + production plan (voice, phasing, help-center build) lives in
[onboarding-tutorials-plan.md](../onboarding-tutorials-plan.md); this file is
the per-use-case script skeleton that detailed click-path scripts will grow
from (one file per video in `docs/tutorials/`) once recording is green-lit.
