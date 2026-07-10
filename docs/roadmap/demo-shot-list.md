---
updated: 2026-07-09
status: planned
tier: 1
area: gtm
source: owner
tags: [theme/gtm, type/plan, status/planned]
---

# Demo shot-list — "One hub, never leave"

The authoritative catalog for recording SportsHub screen-demos. Every demo dramatizes a
task that *today* forces an Ontario youth-basketball club, coach, or family to juggle
fragmented tools — then shows it done, start-to-finish, in one place here.

**The one line every demo must land:**
> *"Everything's in one hub. You never leave, and you need no other tool. Registration,
> payments, comms, scheduling, live scores, recaps, recruiting — it all happens here,
> and it's all connected."*

The differentiator isn't any single feature (competitors each own one). It's that they're
**one connected graph on one login**: a tryout signup becomes an offer becomes a roster spot
becomes a chat membership becomes a game becomes a box score becomes a recap on the kid's
public page — no re-typing, no re-uploading, no "which app was that in?".

> **Labels in this doc are verified against the source** (`apps/web/src/app/...`) as of
> 2026-07-09. Button/tab/section names in `Fixed width` are the exact on-screen strings.

---

## 1. Positioning & pain → solution map

### 1a. Sharpened positioning

The status quo is a **7-app stack** the same person re-enters the same data into: a spreadsheet
for the roster, TeamSnap for comms, GameChanger for the game, Instagram for the recap,
e-transfer/email for money, WhatsApp for the *real* conversation, and Exposure/league software
the club can't see into. SportsHub's wedge is **collapse the stack** and, more importantly,
**connect the data** so an action in one place updates everywhere.

Two audiences, one graph:
- **Operators** (club owner, league operator, coach): "run the whole thing without a spreadsheet
  or a second tool."
- **Families** (parent, player): "your whole season — signup, money, schedule, chat, scores, your
  kid's highlights — in one app you actually check."

### 1b. Pain → solution table

| # | Fragmented tool / pain today | The job it does | SportsHub feature that kills it | Demo IDs |
|---|---|---|---|---|
| 1 | **Spreadsheets** (rosters, who-paid-what, player info, tryout lists) | Single source of truth for people & money | Tryout signups → offers → roster → league submission pipeline; the auto-built **Order Sheet**; obligations ledger; player records — all live, all linked | CO-2, CO-3, CO-4, PA-4 |
| 2 | **Email chains** (announcements, schedule changes, offers, reminders) | Reaching families with the right info | Team announcements + practice scheduling (bell **+ email** to every family); offer delivery; automated payment reminders; branded public announcements | CS-3, CS-4, PA-3, CO-5 |
| 3 | **Instagram** (posting results, highlights, recaps) | Publishing results/highlights to families & recruits | Auto-published AI game recaps + box scores + highlight videos on branded club/league/team/player pages, `/news`, follow feed | LG-4, CS-6, PA-6, HERO-3 |
| 4 | **GameChanger** (scheduling, live scoring, box score, stats) | Game day: score it, stat it, share it | Live scoring console → box score → stat leaders → standings → auto recap; public live view; PDF scoresheet | SK-1, RF-2, LG-3, HERO-3 |
| 5 | **TeamSnap** (comms, schedule, RSVP, reminders, payments) | Team ops for the manager & family | Team chat + practice scheduling + calendar/iCal + polls + integrated payments — one team page | CS-1..5, PA-5 |
| 6 | **WhatsApp** (parent/team group chats) | The everyday group conversation | Team chat (staff + families, moderated) + floating chat dock — tied to the actual roster | CS-1, PA-5 |
| 7 | **Managing many teams** (club, U9→U19, boys+girls, A/AA/AAA) | Operate a multi-team club at a glance | Club dashboard: all teams, `Needs Attention`, `Offer Pipeline`, per-team filters, staff assignment across teams | CO-1, HERO-2 |
| 8 | **Exposure Events / segregated league software** (event/league scheduling) | Run a league season | Season console: divisions → team submissions → schedule generation w/ capacity planner → venues → standings → live results — on the same substrate the clubs already use | LG-1, LG-2, HERO-4 |
| 9 | **Chasing payments** (e-transfer, "did you pay?", installments) *(added)* | Collect & reconcile money | Stripe checkout at offer acceptance; obligations w/ installment plans; automated due-reminders; club/league payment consoles | CO-4, PA-2, PA-4 |
| 10 | **Finding refs & scorekeepers game-day** (texts, phone tree) *(added)* | Staff the game with officials | "Uber-style" referee session booking (league posts a shift → refs claim, first-accept-wins); scorekeeper assignment; PIN sign-off on results | RF-1, RF-2, SK-1 |
| 11 | **Roster churn mid-season** (email the league, re-send a sheet) *(added)* | Change a locked roster the right way | Roster versions + change-request flow (coach requests → league approves) + audited commissioner override | CS-7, LG-5 |
| 12 | **Recruiting / getting seen** (offer spreadsheets; DMs) *(added)* | Select players; give players exposure | Offers pipeline (single + bulk, templates, packages, accept/decline, sizes, jersey #s); public player pages with stats & recaps | CO-3, PL-1, PL-2 |
| 13 | **No single source of truth / re-typing everywhere** *(added)* | Stop re-entering the same data | One login, multi-role; the connected graph (signup→offer→roster→chat→game→recap) | HERO-1, HERO-2 |
| 14 | **Getting discovered / building reputation** *(added)* | Be found by families | Branded public club/league pages, club directory, SEO team/player pages, **auto family reviews**, follow | PA-1, PA-7, CO-6 |

### 1c. Honesty guardrails (do not overreach on camera)

- **Where money is actually collected (verified):** tryout / camp / house-league **registration
  does NOT charge a card at signup** — it creates an **obligation** the family pays later at
  `/payments` (tryout signup even shows stale "payment processing coming soon" copy). The **real
  Stripe card flow is at OFFER ACCEPTANCE** (`/offers` → `Accept Offer` → `Pay $X & Accept`, with
  `Pay in full` vs `Payment plan`), which hard-gates on a confirmed payment for online clubs. So to
  show *money moving on camera*, film **offer acceptance (PA-2)**; registration demos should say
  "the fee is now on my account," not "I'm paying now."
- **Club announcements don't notify anyone.** `POST /api/clubs/[id]/announcements` only publishes to
  the public-page `Announcements` block — no follower push, no email (verified). The **notify-families**
  claim is true only for **team practice scheduling / announcements** (bell + email — CS-3, CS-4) and
  offer/payment notifications. Frame CO-5 as "one post, live on my branded page," not "blasts every family."
- **"No other communication channel"** — true *in-app + email*. Chat/polls/announcements are
  polling-based (5–10s), not real-time push ([[native-mobile-platform]] realtime track committed). Pitch it as "replaces the
  group chat AND keeps it tied to the roster/schedule/money," not "faster than WhatsApp."
- **Streaming video — [not built — skip].** GameChanger streams; SportsHub does **live score +
  play-by-play + recaps + embedded YouTube highlights**, not native video. Say "follow the live score
  and play-by-play," never "watch the live stream." (The homepage marketing tile literally reads
  `Live Scoring · COMING SOON`, though live scoring *works* — don't dwell on that tile.)
- **One-tap game RSVP / availability grid — [not built — skip]** ([[attendance-rsvp]] planned). Demo
  availability via a **poll**, not a TeamSnap-style RSVP grid.
- **Tryout evaluations / numeric scoring — [not built — skip]** ([[tryout-evaluations]] planned).
  Check-in exists; scoring players does not.
- **Playoffs / brackets — [not built — skip]** ([[playoff-generation]] planned). Regular-season
  scheduling + standings are real.
- **Tournaments — mostly [not built — skip].** `/clubs/[id]/tournaments` supports create → divisions →
  team registration → venues → status flow, but **no bracket/schedule/game generation or scoring
  exists**. Public `/tournament/[id]` is an info + registration page. Film tournaments only as a
  "register a team into an event" beat, never a run-the-tournament beat.
- **Player game log is gated by `hasFamilyPass`** (currently free-for-all; shows only 3 rows if not
  entitled). Fine to show; just know the gate exists.

---

## 2. Demo catalog

**Legend** — 🎬 Vignette (30–60s, one punchy task) · 🎥 Walkthrough (2–5min, a full flow).
All logins password **`TestPass123!`**. App root: `http://localhost:3000`.

> **Featured-asset routing (verified against the seed):**
> - **Branding / public-page** demos → **North Toronto Huskies** (purple, `owner-huskies@`,
>   `/club/north-toronto-huskies`) and **West United** (teal, `owner-west@`, `/club/west-united`) —
>   the two *fully enriched* clubs (banner, tagline, socials, 3 announcements, 3 tryouts, camp, house
>   league, 3 reviews, teams).
> - **Tryout → offer → order-sheet** pipeline → **Toronto Lords** (`owner-lords@`,
>   `/club/toronto-lords-basketball`) — its **Lords Fall** tryout has **12 signups, 5 checked in,
>   3 accepted** ready to film.
> - **Parent / player** demos → the parent's real kids: **Miles Reyes → Toronto Lords Grade 9**,
>   **Trey Reyes → Burlington Force Grade 10**. Chat/polls/practices are seeded on **Lords G9**. The
>   live pending offer is **Toronto Lords Fall Elite**.
> - **League / game-day** → **NPH Summer League** (`owner-nph@`), IN_PROGRESS, 4 divisions (Grade
>   8–11), 144 completed + **3 LIVE** + **8 scheduled Sat Jul 11** games.
> - **⚠️ Never hardcode a league/season/game/tryout id — they regenerate on every reseed.** Get the
>   current id by browsing (`/leagues`, `/scores`, `/manage/leagues`, the club's Tryouts tab) at
>   record time. The brief's `8d1b540d-…` league URL works *now* but dies on the next reseed.

---

### 2a. Club owner / manager

Club dashboard tabs (exact, in order): `Overview` · `Teams` · `Tryouts` · `Offers` · `Templates` ·
`House League` · `Camps` · `Tournaments` · (admin) `Payments` · `Staff` · `Customize page` · `Settings`.

---

**CO-1 · Your whole club at a glance** — 🎥 Walkthrough
- **Replaces:** the master spreadsheet + a wall of browser tabs
- **Login:** `owner-huskies@sportshub.demo` (or `owner-lords@` for more teams)
- **Featured:** North Toronto Huskies
- **Click path:**
  1. Sign in → `/dashboard` → open the club → `/clubs/[id]`.
  2. Walk the Overview: the four stat cards (`Teams` / `Tryouts` / `Offers` / `Staff`), then
     **`Needs Attention`** (tryouts needing offers, offers awaiting parent response, expired offers,
     teams with `No head coach`, unpublished draft tryouts).
  3. Show **`Offer Pipeline`** (Pending/Accepted/Declined/Expired) and **`Quick Actions`**.
  4. Click the `Teams` tab — age-group pills + name search over every team.
  5. Click `Tryouts` and `Offers` tabs — same club, same screen.
- **Narration beats:**
  - "One club, every team across every age group — one screen, not one spreadsheet per team."
  - "The system tells *me* what needs attention — I'm not hunting for it."
  - "Everything a rep club juggles is here, and it's all connected."
- **Duration:** 3–4 min

**CO-2 · Spin up a team, assign the coach** — 🎬 Vignette
- **Replaces:** a new spreadsheet tab + emailing a coach
- **Login:** `owner-huskies@sportshub.demo`
- **Featured:** North Toronto Huskies
- **Click path:**
  1. `Teams` tab → **`Create Team`** → `/clubs/[id]/teams/create`.
  2. Fill `Team Name`, `Age Group`, `Gender`, `Season`.
  3. Under Staff Assignment either **`Add Existing Staff`** (role = `Head Coach`) **or**
     **`Invite by Email`**.
  4. **`Create Team`** → it appears in the list.
- **Narration beats:**
  - "New team, coach assigned or invited by email — no side spreadsheet, no separate invite tool."
  - "The coach's role and team access are created in the same click."
- **Duration:** 45–60s

**CO-3 · Tryout → offers → roster, no spreadsheet** — 🎥 Walkthrough *(flagship)*
- **Replaces:** tryout-list spreadsheet + email offers + who-said-yes tracking + an order sheet
- **Login:** `owner-lords@sportshub.demo`
- **Featured:** Toronto Lords → the **Lords Fall** tryout (12 signups, 5 checked in, 3 accepted)
- **Click path:**
  1. `Tryouts` tab → open the Lords Fall tryout → **`Signups`**.
  2. Open **`Check-in (x/total)`** — tap a name to mark arrived (mobile roll-call).
  3. Back on Signups, click **`Make Offer`** on a player → modal `Make Offer` (pick a package /
     template, set `Expires in`) → **`Send Offer`**.
  4. Use the header **`Send Offers (N)`** to bulk-offer the rest → `Send to N players`.
  5. Go to the `Offers` tab — click the Accepted tile; statuses move as families respond.
  6. Click **`Order Sheet`** (`/clubs/[id]/offers/summary`) — `Club Order Totals` (uniforms/tracksuits/
     shoes by size, balls, bags) + per-team tables + **`Download CSV`**.
  7. Team `Roster` (`/clubs/[id]/teams/[teamId]/roster`) is populated from accepted offers; **`Finalize
     Roster`** assigns jersey numbers from preferences.
- **Narration beats:**
  - "From tryout signup to a finalized, jersey-numbered roster — no spreadsheet, every step feeds the next."
  - "An accepted offer *becomes* a roster spot, a jersey size, and a line on the order sheet — automatically."
  - "The equipment order sheet writes itself and exports to CSV. I never re-typed a name or a size."
- **Duration:** 4–5 min

**CO-4 · The money is handled** — 🎬 Vignette
- **Replaces:** e-transfer + a payments spreadsheet + "did you pay?" texts
- **Login:** `owner-lords@sportshub.demo` (real outstanding balances) or `owner-huskies@`
- **Featured:** Toronto Lords
- **Click path:**
  1. `Payments` tab → `Collected` / `Outstanding` / `Waived` tiles.
  2. Show **`Owed to {club}`** obligations (record cash, waive, refund) and per-family installment status.
  3. Show **`PaymentSettingsCard`** — Stripe Connect (`✓ Stripe account connected`) so money settles to the club.
- **Narration beats:**
  - "Every fee, every family, every installment — one ledger, reconciled automatically."
  - "Money settles straight to the club; I'm not chasing e-transfers or updating a sheet."
- **Duration:** 45–60s

**CO-5 · A branded announcement, live in one click** — 🎬 Vignette
- **Replaces:** posting the club update to Instagram / the website separately
- **Login:** `owner-huskies@sportshub.demo`
- **Featured:** North Toronto Huskies
- **Click path:**
  1. `Customize page` tab → Announcements section → title + content → **`Post announcement`** (optionally `Pin`).
  2. Open `/club/north-toronto-huskies` in a second tab — it's live in the `Announcements` block.
- **Narration beats:**
  - "Post once — it's live on my branded club page, no Instagram, no web guy."
  - *(Honesty: this publishes to the page; it does NOT email followers. For push-to-families, that's the
    team practice/announce flow — CS-4.)*
- **Duration:** 30–45s

**CO-6 · Brand your club page (no web designer)** — 🎥 Walkthrough
- **Replaces:** paying for a Jersey Watch / SportsEngine club website + a separate IG bio link
- **Login:** `owner-huskies@sportshub.demo`
- **Featured:** North Toronto Huskies (purple) — or West United (teal) for contrast
- **Click path:**
  1. `Customize page` tab (`/clubs/[id]/customize`) — header **`View public page ↗`**.
  2. **Brand**: banner + logo upload, `Tagline`, primary/secondary/accent colors.
  3. **Contact info** + **Follow us** (Instagram/Facebook/X/YouTube/TikTok).
  4. **Page layout** (@dnd-kit): drag blocks between **`Main column (wide)`** and **`Right rail (compact)`**,
     toggle `Visible`, `Pin to top on mobile`. Blocks: About, Announcements, Open programs, Teams,
     Schedule & scores, News & highlights, Reviews, Next game, Contact, At a glance, Follow us.
  5. **`Save changes`** → open `/club/north-toronto-huskies` (branded purple hero, sticky sub-nav
     `About / Teams / Programs / Schedule / Contact`, live blocks).
- **Narration beats:**
  - "A branded club website — schedule, results, recaps, reviews baked in — no designer, no separate site."
  - "It's *live* from the same data I run the club on, not a static page I maintain twice."
- **Duration:** 3–4 min

**CO-7 · Post a camp / house league, take registrations** — 🎬 Vignette
- **Replaces:** a Google Form + a payments spreadsheet
- **Login:** `owner-huskies@sportshub.demo`
- **Featured:** North Toronto Huskies
- **Click path:**
  1. `Camps` tab → **`Create Camp`** → set `Per Week ($)` + `All N Weeks ($)` (discount %), `Includes`, publish.
  2. (Or `House League` tab → **`Create Program`** → single `Fee ($)`, `Days of Week`, publish.)
  3. Open the public program page `/camp/[id]` — listing + `Register` ready.
- **Narration beats:**
  - "A camp goes live with real weekly + full-camp pricing and online registration in one screen — no form."
- **Duration:** 45–60s

**CO-8 · Submit a team to a league** — 🎬 Vignette
- **Replaces:** Exposure/league software the club can't see into + an emailed roster sheet
- **Login:** `owner-west@sportshub.demo` (West already has a pending Fall submission) or `owner-huskies@`
- **Featured:** club → **NPH Fall League** (REGISTRATION open)
- **Click path:**
  1. `/browse-leagues` → open the NPH Fall season → `/browse-leagues/[id]`.
  2. `Register Your Team`: `Select Team`, `Select Division`, then the **`League roster version`** checklist
     (from `/api/seasons/[id]/roster-preview`; players rostered elsewhere show `ineligible`).
  3. **`Submit Team`** → appears as a PENDING submission for the league to approve; roster locks on finalize.
- **Narration beats:**
  - "I enter a league from inside the app I run my club in — my roster's already here, nothing re-typed."
  - "The league and I are looking at the same data, not two disconnected tools."
- **Duration:** 45–60s

**CO-9 · Invite & manage staff** — 🎬 Vignette
- **Replaces:** email threads + a "who's coaching what" spreadsheet
- **Login:** `owner-huskies@sportshub.demo`
- **Featured:** North Toronto Huskies
- **Click path:**
  1. `Staff` tab → **`Invite Staff`** (email + role `Staff`/`Manager`).
  2. Show `Staff Requests`, `Current Staff` (role + team-assignment chips), `Pending Invitations`.
- **Narration beats:**
  - "Coaches join by email invite and land in the right team with the right access — one directory."
- **Duration:** 30–45s

---

### 2b. League owner / operator

Login: `owner-nph@sportshub.demo` (owns NPH Summer + NPH Fall). Season console tabs (exact):
`Overview` · `Divisions` · `Venues` · `Sessions` · `Scheduling` · `Tiebreakers` · `Teams` ·
`Referees` · `Schedule` · `Standings`.

---

**LG-1 · Run a whole season from one console** — 🎥 Walkthrough *(flagship)*
- **Replaces:** Exposure Events / segregated league scheduling software + spreadsheets
- **Login:** `owner-nph@sportshub.demo`
- **Featured:** NPH Summer League
- **Click path:**
  1. `/manage/leagues` → open NPH → `/manage/leagues/[id]`.
  2. Open the season → `/manage/leagues/[id]/seasons/[seasonId]/manage`.
  3. Tour tabs: `Divisions` (Grade 8–11), `Teams` (approve club submissions with **`Approve`**/`Reject`,
     mark fees paid, lock rosters), `Venues`, `Sessions` (game days), `Scheduling` (philosophy + rules),
     `Schedule`, `Standings`.
  4. Show the `Overview` finalize checklist and the single status-advance button
     (`Open Registration` → `Close Registration` → `Finalize Season` → `Start Season` → `Mark Completed`).
- **Narration beats:**
  - "A whole season — divisions, team entries, venues, schedule, standings — on one console the clubs already live in."
  - "Clubs submit here, games are scored here, standings compute here. No separate exposure/events tool, no reconciliation."
- **Duration:** 4–5 min

**LG-2 · Generate a schedule with a capacity check** — 🎬 Vignette
- **Replaces:** hand-built schedule spreadsheets + venue double-booking
- **Login:** `owner-nph@sportshub.demo`
- **Featured:** NPH Fall (a DRAFT/registration season is cleaner to generate) — *or narrate over NPH Summer's committed slate*
- **Click path:**
  1. Season console → `Schedule` → **`Preview schedule`**.
  2. Show the **`Capacity planner`** (per-session "N spare / N short", red = over capacity) — catch overbooking before committing.
  3. **`Commit schedule`** (enabled once the season is `Finalize`d) → games publish to the public page.
- **Narration beats:**
  - "Generate a full slate, catch venue overbooking before it happens, commit — one app, not three spreadsheets."
- **Duration:** 45–60s
- **Note:** commit is gated on season status FINALIZED/IN_PROGRESS; `Preview` works anytime.

**LG-3 · Live results roll up automatically** — 🎬 Vignette
- **Replaces:** manually updating standings after collecting scores
- **Login:** `owner-nph@sportshub.demo` (or logged out for the public view)
- **Featured:** NPH Summer public page
- **Click path:**
  1. Public league page (`/league/[seasonId]`) — `Scores & schedule` (Live/Upcoming/Final), `Standings`.
  2. Open a live game `/live/[gameId]`; open `Full leaders board →` (`/league/[seasonId]/leaders`).
- **Narration beats:**
  - "Games are scored on the same platform, so standings and leaders are always current — nobody re-enters scores."
- **Duration:** 45–60s

**LG-4 · The league that publishes itself** — 🎬 Vignette
- **Replaces:** Instagram + manual MaxPreps-style score/recap posting
- **Login:** logged out (public) or `owner-nph@`
- **Featured:** NPH Summer
- **Click path:**
  1. `/league/[seasonId]` → `League news` → open a recap → `/news/[slug]` (box score + AI recap + highlight video).
- **Narration beats:**
  - "Every final writes its own recap and box score on the league's branded page — no one posting to Instagram at 11pm."
- **Duration:** 45–60s

**LG-5 · Approve a roster change the right way** — 🎬 Vignette
- **Replaces:** email + re-sent roster sheets
- **Login:** `owner-nph@sportshub.demo`
- **Featured:** NPH Summer → the seeded **Burloak G9** pending roster-change request
- **Click path:**
  1. Season console → `Teams` tab → `Roster changes` panel → **`Approve`** (confirm) or `Deny`.
  2. (Optional) show the policy select and the audited **`Override a team's roster (audited)`**.
- **Narration beats:**
  - "Mid-season roster changes flow as requests I approve — versioned, audited, no email chain."
- **Duration:** 30–45s

**LG-6 · Brand the league page** — 🎬 Vignette
- **Replaces:** a separate league website
- **Login:** `owner-nph@sportshub.demo`
- **Featured:** NPH Summer
- **Click path:**
  1. `/manage/leagues/[id]/customize` — banner, logo, `Tagline`, `Primary color`, socials (fixed branding
     form, not a block builder) → **`Save changes`**.
  2. View `/league/[seasonId]`.
- **Narration beats:**
  - "The league's public home — schedule, standings, recaps — branded in minutes, live from the real season data."
- **Duration:** 30–45s

---

### 2c. Coach / Staff

Best staff login for populated chat/polls: **`coach-lords-gr9@sportshub.demo`** (head coach & chat admin
of **Toronto Lords Grade 9** — the team with seeded polls, unread messages, announced practices).

---

**CS-1 · Team chat that's tied to the roster** — 🎬 Vignette
- **Replaces:** WhatsApp / TeamSnap group chat
- **Login:** `coach-lords-gr9@sportshub.demo`
- **Featured:** Toronto Lords Grade 9
- **Click path:**
  1. `/teams/[teamId]/chat` — read the thread (staff `STAFF` badges + family replies), post a message
     (**`Send`**), optionally a quick poll (📊). Staff can `Remove` any message.
- **Narration beats:**
  - "The team group chat lives *with* the roster, schedule, and payments — not in a separate app that forgets who's on the team."
- **Duration:** 30–45s
- **Note:** no threaded replies / @mentions / attachments — plain text + inline polls.

**CS-2 · Ask the team a question (poll)** — 🎬 Vignette
- **Replaces:** WhatsApp thumbs-up chaos / TeamSnap availability
- **Login:** `coach-lords-gr9@sportshub.demo`
- **Featured:** Toronto Lords Grade 9 (seeded "Summer tournament plans" poll)
- **Click path:**
  1. `/teams/[teamId]/polls` → **`New Poll`** → title, question(s), options, `Allow multiple choices` →
     **`Publish Poll`** (or open the seeded poll).
  2. Show votes + per-option **voter names** (not anonymous); `Close` when done.
- **Narration beats:**
  - "One poll, clean tally, tied to the actual roster — no scrolling a chat to count thumbs."
  - *(If framed as availability, say "poll," not a per-game RSVP grid — that's not built.)*
- **Duration:** 30–45s

**CS-3 · Schedule practices → every family's phone** — 🎥 Walkthrough
- **Replaces:** TeamSnap scheduling + manual calendar entry + a reminder email
- **Login:** `coach-lords-gr9@sportshub.demo`
- **Featured:** Toronto Lords Grade 9
- **Click path:**
  1. `/teams/[teamId]/calendar` → **`Manage`** practice days (day/time/duration/location, `+ Add practice day`).
  2. **`Announce schedule to families`** → expands 10 weeks of dated practices **and notifies every family
     by bell + email**.
  3. Show practices + games on the merged agenda; add a one-off with `+ Add event`.
  4. Tap **`📅 Add to phone`** → subscribe via the `iPhone / Apple Calendar` (webcal) or `Google Calendar` link.
- **Narration beats:**
  - "Set practices, announce them, and they hit every family's phone calendar AND their inbox automatically."
  - "Practices and games in one feed; move a time and everyone's updated — no group-text telephone game."
- **Duration:** 2–3 min

**CS-4 · Change a practice, notify everyone** — 🎬 Vignette
- **Replaces:** email chain + WhatsApp scramble
- **Login:** `coach-lords-gr9@sportshub.demo`
- **Featured:** Toronto Lords Grade 9
- **Click path:**
  1. On the calendar, `Move` or `Cancel` a single practice → families are notified; the calendar/iCal feed updates.
- **Narration beats:**
  - "Gym change at 6pm? One tap updates the calendar and notifies every family — this is the one flow that DOES email everyone."
- **Duration:** 30–45s

**CS-5 · Everything the manager needs, one team page** — 🎥 Walkthrough
- **Replaces:** TeamSnap (the whole app)
- **Login:** `coach-lords-gr9@sportshub.demo`
- **Featured:** Toronto Lords Grade 9
- **Click path:**
  1. `/clubs/[id]/teams/[teamId]/dashboard` — roster, staff, `Quick Actions` (Roster, Order Sheet, Team Chat,
     Polls, Calendar, Edit Team, New Tryout).
  2. `/teams/[teamId]/chat` → comms · `/teams/[teamId]/calendar` → schedule + iCal · `/teams/[teamId]/polls` → questions.
- **Narration beats:**
  - "Roster, chat, schedule, polls, payments — the team manager's whole job on one page, in the same system the club and league use."
- **Duration:** 3–4 min

**CS-6 · Your team's results publish themselves** — 🎬 Vignette
- **Replaces:** Instagram recaps
- **Login:** staff (or logged out for public)
- **Featured:** Toronto Lords Grade 9 public team page
- **Click path:**
  1. `/team/[id]` — `Schedule & results`, `Player stats`, `Team news` (box scores + recaps update after each game).
- **Narration beats:**
  - "After every game the team page updates itself — box score and a written recap — so I'm not the club's Instagram intern."
- **Duration:** 30–45s

**CS-7 · Request a roster change** — 🎬 Vignette
- **Replaces:** emailing the league office
- **Login:** `owner-lords@sportshub.demo` (staff on the submitted team)
- **Featured:** a Toronto Lords team in an NPH season
- **Click path:**
  1. `/clubs/[id]/teams/[teamId]/league-rosters` → **`Request change`** (or `Edit roster` if the policy allows)
     → `/api/seasons/[id]/submissions/[submissionId]/roster`.
  2. Show it queued for league approval (pairs with LG-5).
- **Narration beats:**
  - "Swap a player mid-season? I request it in-app; the league approves it in-app. Versioned, audited — no email."
- **Duration:** 30–45s

---

### 2d. Referee

Login: `ref-mike@sportshub.demo` (sign-off PIN **1234**). Mike has 40 assigned games **and an open
broadcast shift** (Sat Jul 11, 09:00–15:00) he can claim live.

---

**RF-1 · Claim shifts like an Uber driver** — 🎥 Walkthrough
- **Replaces:** ref-coordinator group texts / phone tree / an assignments spreadsheet
- **Login:** `ref-mike@sportshub.demo`
- **Featured:** NPH Summer open shift
- **Click path:**
  1. `/referee/profile` — `Become a Referee` / `Save Changes`: `Certification Level`, `Standard Fee`,
     `Available Regions`; add availability.
  2. `/referee/requests` (`Shifts & availability`) → the `Offers (n)` list shows the open broadcast shift
     ("first accept wins") → **`Accept`**.
  3. Toast: "You're booked — assigned to N games that day"; the games now show him as ref.
- **Narration beats:**
  - "The league posts open games, refs claim the ones they want — like ride-share, not a phone tree."
  - "My availability, my shifts, my assigned games — one place, tied to the real schedule."
- **Duration:** 2–3 min

**RF-2 · Sign off on the final** — 🎬 Vignette
- **Replaces:** paper scoresheet signatures / "trust me on the score" texts
- **Login:** `ref-mike@sportshub.demo` (PIN 1234)
- **Featured:** a game being finalized (pairs with SK-1)
- **Click path:**
  1. On the scoring console review screen, the `Referee approval` panel appears.
  2. Toggle `Referee PIN` (pick the assigned ref) or `Signature` (SignaturePad). Enter PIN **1234** → verified
     server-side against the ref's account.
  3. **`Mark final`** → result locks (`refereeVerified`).
- **Narration beats:**
  - "The official verifies the final on the spot — PIN or signature — and the result is locked and trusted. No paper, no disputes."
- **Duration:** 45–60s

---

### 2e. Scorekeeper

Login: `scorekeeper@sportshub.demo`. **Setup caveat (verified):** the `Score a game` page only shows games
you own/staff/are assigned to — a bare global scorekeeper sees nothing. Either **assign `scorekeeper@` to
the target game first** (owner does this via `GameScorekeeperControl` on `/score`) **or score as
`owner-nph@`** (sees all league games).

---

**SK-1 · Score a game live — no GameChanger** — 🎥 Walkthrough *(flagship)*
- **Replaces:** GameChanger live scoring + box score
- **Login:** `owner-nph@sportshub.demo` (simplest) or an assigned `scorekeeper@`
- **Featured:** a Sat-Jul-11 scheduled game (score from scratch) or resume a LIVE game
- **Click path:**
  1. `/score` (`Score a game`) → open a game → **`Score →`**.
  2. Console `/games/[id]/score`: `Attendance` roll-call → **`Continue to starting lineups →`** → pick starting
     fives → **`Start game`**.
  3. Score with the two-tap action pad (`+2`, `+3`, `FT ✓`, `REB`, `AST`, `FOUL`, misses, `STL/BLK/TO`), run the
     clock, use `UNDO`, check `BOX`.
  4. In a second tab open `/live/[gameId]` — the public score updates for spectators (polls every 10s).
  5. **`End game →`** → review screen → hand to **RF-2** for referee sign-off → **`Mark final`**.
  6. Show the `Public box score →` and the auto-published recap.
- **Narration beats:**
  - "Live scoring, a full box score, stat leaders — everything GameChanger does — but it feeds *this* league's standings and recaps directly."
  - "Spectators follow the live score on the public page while I score. One tap, one place."
- **Duration:** 4–5 min

**SK-2 · The official scoresheet, as a PDF** — 🎬 Vignette
- **Replaces:** paper scorebook / photographing a scoresheet
- **Login:** `owner-nph@sportshub.demo` (or assigned scorekeeper/ref — **not** families)
- **Featured:** a finalized game
- **Click path:**
  1. From the console `Final` screen → `Official scoresheet (print) →` → `/scoresheet/[gameId]`.
  2. Scorebook-notation sheet → **`Download PDF (landscape)`** or `Print / Save as PDF`.
- **Narration beats:**
  - "A real, scorebook-notation scoresheet as a PDF for the record — generated, not photographed."
- **Duration:** 30–45s

---

### 2f. Parent

Login: `parent@sportshub.demo` (Jordan Reyes). Kids **Miles Reyes → Toronto Lords Grade 9**, **Trey Reyes →
Burlington Force Grade 10**. Live seeded state: a **PENDING offer** (Toronto Lords Fall Elite), two
**PARTIALLY_PAID** $3,000 obligations, **2 unread** Lords G9 chat, an unvoted Lords G9 **poll**, announced
practices + team events, follows on both teams + NPH Summer.

---

**PA-1 · Find a club and register a kid** — 🎥 Walkthrough *(flagship)*
- **Replaces:** googling clubs + a Google Form + an e-transfer
- **Login:** logged out → sign in as `parent@sportshub.demo` (or fresh signup)
- **Featured:** North Toronto Huskies (or Toronto Lords)
- **Click path:**
  1. `/club` (directory `Find a Basketball Club`) → open `/club/north-toronto-huskies` — programs band, teams,
     reviews.
  2. Open an `Open programs` item — a tryout `/tryout/[id]` (or `/camp/[id]` / `/house-league/[id]`) →
     **`Sign Up Now`**.
  3. Platform signup: `Select Player` (Miles/Trey) → **`Sign Up (Free)`** / **`Sign Up ($X)`** (if no player yet,
     `Add a Player First`).
  4. Land back on `/dashboard` — the registration is now under `Registrations`; the fee shows in `/payments`.
- **Narration beats:**
  - "Find the club, see real programs and reviews, register the kid — one flow, one app, no Google Form."
  - "It's on my dashboard instantly, and the fee's on my payments page — nothing to reconcile later."
- **Duration:** 3–4 min
- **Note:** registration creates the obligation; the *card* is charged at offer acceptance (PA-2), not here.

**PA-2 · Accept the offer and pay** — 🎬 Vignette *(this is the "money on camera" shot)*
- **Replaces:** an emailed offer + a reply + an e-transfer
- **Login:** `parent@sportshub.demo`
- **Featured:** the seeded **Toronto Lords Fall Elite** pending offer (two packages)
- **Click path:**
  1. `/offers` (`My offers`) → `Pending (n)` → **`Accept Offer`**.
  2. Choose the package (`Returning Player` vs `New Player`), enter `Uniform`/`Tracksuit`/`Shoe` sizes +
     `Jersey Number Preferences`.
  3. `Pay in full` or `Payment plan` → Stripe test card `4242 4242 4242 4242` → **`Pay $X & Accept`**.
- **Narration beats:**
  - "The team offer, the jersey size, and the payment — accepted and paid in one place."
  - "The club's roster and order sheet update the moment I tap accept. No e-transfer, no back-and-forth."
- **Duration:** 45–60s

**PA-3 · One inbox for the whole season** — 🎬 Vignette
- **Replaces:** email + WhatsApp + IG DMs
- **Login:** `parent@sportshub.demo`
- **Featured:** Toronto Lords / NPH
- **Click path:**
  1. `/notifications` — offer, team practice schedule, chat, poll, team-event notifications in one feed.
- **Narration beats:**
  - "Every message that matters — the team, the money, the schedule — in one inbox I actually check. No app-hopping."
- **Duration:** 30–45s

**PA-4 · Pay once, track everything** — 🎬 Vignette
- **Replaces:** a payments spreadsheet + "how much do I still owe?" texts
- **Login:** `parent@sportshub.demo`
- **Featured:** the two PARTIALLY_PAID $3,000 obligations
- **Click path:**
  1. `/payments` (`My payments`) → `Payment plan` card (Deposit / Installment rows, `Paid`/`Upcoming`/`Processing`),
     `Manage cards →`, and the obligations table across both kids; pay a due installment.
- **Narration beats:**
  - "All my fees across both kids, with installments — one ledger. I always know exactly what I owe."
- **Duration:** 45–60s

**PA-5 · The team's group chat & calendar** — 🎬 Vignette
- **Replaces:** WhatsApp + TeamSnap
- **Login:** `parent@sportshub.demo`
- **Featured:** Toronto Lords Grade 9 (2 unread, seeded poll)
- **Click path:**
  1. `/teams/[teamId]/chat` — read/post (2 unread cleared).
  2. `/teams/[teamId]/calendar` — practices + games; **`📅 Add to phone`**.
  3. `/teams/[teamId]/polls` — **`Vote`** in "Summer tournament plans".
- **Narration beats:**
  - "The group chat, the schedule on my phone, and the coach's polls — all in the app my kid's already registered in. No separate group to get added to."
- **Duration:** 45–60s

**PA-6 · Watch and relive the game** — 🎬 Vignette
- **Replaces:** GameChanger (following) + Instagram (the recap)
- **Login:** `parent@sportshub.demo`
- **Featured:** an NPH LIVE game + a finished game
- **Click path:**
  1. `/live/[gameId]` — follow the live score + `Play-by-play` (phone tabs `Box score` / `Play-by-play`).
  2. After: `/team/[id]` or `/news/[slug]` — box score + recap + highlight video.
- **Narration beats:**
  - "Follow the score live, then read the recap and see my kid's box score — I never open GameChanger *or* Instagram."
  - *(Say "follow the live score / play-by-play" — not "watch the stream.")*
- **Duration:** 30–45s

**PA-7 · Follow your teams and your kid** — 🎬 Vignette
- **Replaces:** IG follows / bookmarking pages
- **Login:** `parent@sportshub.demo`
- **Featured:** Toronto Lords club + Lords G9 team + a player page
- **Click path:**
  1. On `/club/toronto-lords-basketball` (or `/team/[id]`) tap **`Follow`** (→ `Following`).
  2. Show followed content on the homepage `Your teams` rail and `/scores` under `Your games`.
- **Narration beats:**
  - "Follow the club, the team, or my kid — their scores, news, and highlights come to me. My whole basketball world, one feed."
- **Duration:** 30–45s

**PA-8 · Join by invite (new parent)** — 🎬 Vignette
- **Replaces:** "email me your info" + manual add to the roster
- **Login:** open the invite link logged out (or fresh signup)
- **Featured:** a staff or player invitation — **must be created live** (none seeded)
- **Click path:**
  1. *Setup:* as `owner-huskies@`, invite by email (Staff tab, or team roster `Invite by email`) → copy the link.
  2. Open `/invitations/[id]/accept` (staff) or `/player-invitations/[id]/accept` (player) → **`Create account`** /
     `Sign in` → accept → role + team access created.
- **Narration beats:**
  - "One invite link: sign up, accept, and I'm on the team with the right access — no forms emailed back and forth."
- **Duration:** 30–45s
- **Note:** no invitations are seeded — create one on camera in the setup step (or pre-stage it right before recording).

---

### 2g. Player

Public player pages for the parent's kids (`/player/[id]` — Miles, Trey). Names render privacy-safe as "First L."

---

**PL-1 · Your own highlight page** — 🎬 Vignette
- **Replaces:** a recruiting spreadsheet / DM'd stats / MaxPreps
- **Login:** logged out (public) or `parent@sportshub.demo`
- **Featured:** `/player/[id]` for Miles (Lords G9)
- **Click path:**
  1. `/player/[id]` — the six StatBlocks (Points/Rebounds/Assists/Steals/Blocks per game, Games played) + `Game log`.
- **Narration beats:**
  - "Every player gets a real page — stats, teams, game log — built automatically from games played here. Exposure without a recruiting spreadsheet."
  - *(Names show "First L." for privacy; game-log depth is `hasFamilyPass`-gated — free today.)*
- **Duration:** 30–45s

**PL-2 · Stats & leaders that update themselves** — 🎬 Vignette
- **Replaces:** GameChanger stats + manual leaderboards
- **Login:** public
- **Featured:** NPH Summer leaders
- **Click path:**
  1. `/league/[seasonId]/leaders` — `Stat leaders` (Points/Rebounds/Assists per game) → click into a player page.
- **Narration beats:**
  - "Score the games here and the league leaderboards and player stats build themselves — no separate stats app."
- **Duration:** 30–45s

**PL-3 · A 13+ player runs their own team life** — 🎬 Vignette
- **Replaces:** everything routed through a parent + multiple apps
- **Login:** a 13+ self-registered player account — **confirm one exists before filming; else [skip]**
- **Featured:** their team
- **Click path:**
  1. `/dashboard` → their teams → `/teams/[teamId]/chat` + `/teams/[teamId]/calendar`.
- **Narration beats:**
  - "Older players manage their own team life — schedule, chat, results — in the same hub."
- **Duration:** 30–45s
- **Note:** the seed does not clearly include a self-registered 13+ player login — verify or **[skip]**.

---

### 2h. Cross-cutting / admin (optional B-roll)

**AD-1 · Platform admin console** — 🎬 Vignette
- **Login:** `admin@sportshub.demo`
- **Click path:** `/dashboard/admin/clubs` · `/dashboard/admin/claims` · `/dashboard/admin/payments` ·
  `/dashboard/admin/audit`.
- **Narration beats:** "Behind it all: club claims, payments oversight, an audit trail — the platform is operated, not improvised."
- **Duration:** 30–45s
- **Note:** credibility footage, not a core GTM story.

---

## 3. Hero reel — the flagship walkthroughs

Record these four first and polished; each proves "one hub, never leave" for a different audience, and
each visibly reuses data another persona created.

1. **HERO-1 · "A parent's whole season in one app"** *(PA-1 → PA-2 → PA-4 → PA-5 → PA-6)*
   Find club → register kid → accept the team offer and pay (Stripe test card) → team chat + calendar on
   the phone → follow the live game → read the recap and see your kid on their player page. **~5 min.**
   *Killer line:* the parent never opened a Google Form, e-transfer, TeamSnap, WhatsApp, GameChanger, or
   Instagram — and every step fed the next.

2. **HERO-2 · "Run a club without a spreadsheet"** *(CO-1 → CO-2 → CO-3 → CO-4 → CO-6)*
   Club dashboard → create a team → tryout signups → check-in → offers (single + bulk, packages) → roster
   auto-built and finalized → Order Sheet + CSV → payments ledger → branded public page. **~5 min.**
   *Killer line:* one connected pipeline from tryout to a paid, rostered, published team — zero spreadsheets.

3. **HERO-3 · "Game day: schedule → live score → recap, no GameChanger"** *(SK-1 + RF-2 → LG-3 → LG-4)*
   From the season schedule → open the game → live scoring with a public live view → referee signs off with
   PIN → result locks → standings + stat leaders update → AI recap + box score auto-publish to team/league/
   player pages. **~5 min.**
   *Killer line:* GameChanger scores a game; SportsHub scores a game *and* updates the league, the standings,
   the recruiting page, and the family — automatically.

4. **HERO-4 · "Run a league on the same rails the clubs use"** *(LG-1 → LG-2 + CO-8)*
   Season console → divisions → clubs submit teams (shown from CO-8's side) → generate schedule with the
   capacity planner → commit → games get scored → standings + recaps roll up on the branded league page. **~5 min.**
   *Killer line:* the club and the league aren't emailing spreadsheets between two tools — they're the same graph.

---

## 4. Recording notes

### Order to record in
1. **Reset the world first (two commands):**
   `npx tsx scripts/seed-nph-demo.ts` (wipes + reseeds the demo world, ~30s) **then**
   `npx tsx scripts/enrich-demo-clubs.ts` (restores `scorekeeper@` and repopulates the Huskies/West public
   pages — the reseed wipes both). Run both before every session. Then **re-query the live league/season/
   game/tryout IDs** (they regenerate each reseed).
2. **Operator-first, then family**, so family demos show data the operator just created:
   Club owner (CO-*) → League operator (LG-*) → Coach/Staff (CS-*) → **game day** (SK-1 + RF-2 together, two
   tabs/devices, sign-off is a live hand-off) → Parent (PA-*) → Player (PL-*).
3. **Hero reels last**, once the individual vignettes are proven and you know the exact seeded IDs.

### Reusable setup
- App: `export PATH="/usr/local/opt/node@18/bin:$PATH" && npm run dev` → `http://localhost:3000`.
- All logins password **`TestPass123!`**:
  | Persona | Login | Use for |
  |---|---|---|
  | League operator | `owner-nph@sportshub.demo` | NPH Summer + Fall, season console, live scoring |
  | Club owner (purple, enriched) | `owner-huskies@sportshub.demo` | branding / public page / camps / staff |
  | Club owner (teal, enriched) | `owner-west@sportshub.demo` | branding contrast; pending Fall submission |
  | Club owner (Lords, rich signups) | `owner-lords@sportshub.demo` | tryout→offer→order-sheet, payments, kids' club |
  | Coach / staff | `coach-lords-gr9@sportshub.demo` | chat/polls/calendar with voter names (Lords G9) |
  | Parent | `parent@sportshub.demo` | Miles → Lords G9, Trey → Force G10; offer/pay/chat |
  | Second parent | `parent2@sportshub.demo` | declined/expired-offer history |
  | Referee | `ref-mike@sportshub.demo` | PIN **1234**; open Sat shift to claim; sign-off |
  | Scorekeeper | `scorekeeper@sportshub.demo` | needs enrich + per-game assignment (see gotcha) |
  | Admin | `admin@sportshub.demo` | admin console B-roll |
- Keep two browser profiles open (operator + family/public) to show a post and its public result, or live
  scoring and its spectator view, side by side.

### Gotchas (all verified)
- **IDs are not stable** — the seeder regenerates league/season/game/tryout ids every run. Don't hardcode;
  navigate to them (`/leagues`, `/scores`, `/manage/leagues`, the club Tryouts tab) at record time. The
  brief's `8d1b540d-…` league URL works *now* but dies on the next reseed. Public league routes key off the
  **season** id (`/league/[seasonId]`), while `/manage/leagues/[id]` uses the **league** id.
- **Scorekeeper visibility** — `scorekeeper@` only exists after `enrich-demo-clubs.ts`, and even then the
  `Score a game` page shows nothing until the owner **assigns it to a specific game** (via
  `GameScorekeeperControl` on `/score`). Simplest: **score as `owner-nph@`** (sees all league games).
- **Stripe test mode IS configured locally** (`sk_test_…`/`pk_test_…` in `.env.local`). A parent CAN complete
  a real checkout with **`4242 4242 4242 4242`**, any future expiry, any CVC — at **offer acceptance**
  (PA-2). If keys were ever removed, online pay returns 503; pivot to the `/payments` ledger.
- **Club announcements do NOT email/notify followers** — page-only. The notify-families flow is **team
  practice announce** (CS-3/CS-4). Don't cross the wires in narration.
- **No invitations are seeded** — for PA-8 / invite-accept, create one live (owner invites by email → open
  the link) or pre-stage it right before the take.
- **Live-scoring targets:** 3 LIVE games (resume) or 8 games scheduled **Sat Jul 11** (score from scratch).
  Leave one scheduled; if you finalized them all, reseed.
- **Consent-safe naming:** public player names render "First L." — that's a feature; confirm it on camera (PL-1).
- **Don't film [not built]:** video streaming, per-game RSVP grid, tryout evaluations, playoff brackets,
  and the tournament *competition* (registration/divisions only). See §1c.
- **Lock the exact labels on first run** — this doc's `Fixed width` strings are verified, but re-confirm any
  ambiguous ones (e.g. `Make Offer` vs `Send Offer`) once and hold your script steady.
- **Env hiccups:** `rm -rf apps/web/.next` (cache corruption); `kill -9 $(lsof -ti:3000)` (zombie port).

### Marked [not built — skip] (do not promise on camera)
- Native video **streaming** (we do live score + play-by-play + recaps + embedded YouTube only).
- Dedicated per-game **RSVP / availability grid** ([[attendance-rsvp]]; use a poll).
- **Tryout evaluations** / numeric player scoring ([[tryout-evaluations]]; check-in only).
- **Playoff / bracket generation** ([[playoff-generation]]; regular season + standings are real).
- **Tournament competition** (schedule/brackets/scores) — registration/divisions/venues only; the rest is
  unbuilt.
- **Real-time push notifications** to phones ([[native-mobile-platform]] FCM push track; in-app + email only today).
- Club-announcement **follower/email broadcast** (page-only).
- **PL-3** self-registered 13+ **player login** — confirm it exists before filming; else skip.
