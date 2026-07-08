---
theme: [onboarding]
type: plan
status: planned
updated: 2026-07-07
tags: [theme/onboarding, type/plan, status/planned]
---

# Onboarding, Tutorials & Video Plan (2026-07-07, owner ask)

Owner: focus on onboarding — tutorials, pointers/arrows for what users can
do, videos for every major use case; parent + club-owner tutorial lists;
league needs a comprehensive short video AND a full-length feature tour;
figure out short-tutorials-during-onboarding vs longer help-section content.

## 0. First: the "missing 'I am a parent' selection" — resolved, not a bug

Verified live (fresh signup on dev server, 2026-07-07):

- The role selection ("I'm a Parent" / "I run a Club" / Staff / Referee /
  Player 13+ / "I run a League") **still exists** — it is step 1 of
  `/onboarding`, shown once, immediately after account creation. A fresh
  test signup rendered all cards correctly.
- Two deliberate changes explain why the owner stopped seeing it:
  1. **Every demo account is pre-onboarded** — visiting `/onboarding` as
     parent@/owner-*@sportshub.demo 307s to `/post-login`. You can only
     see the screen with a brand-new email.
  2. The `/settings/roles` picker was **removed on purpose** (2026-06-08,
     action-driven roles): roles now accrue from actions — Add a child →
     Parent, Create a club → ClubOwner, Create a league → LeagueOwner,
     Become a referee → Referee — via the "+ New" menu and "Do more" card.
- Implication for this plan: onboarding ≠ that one screen. The role cards
  fire once; everything after must be carried by the dashboard, empty
  states, and help content.

## 1. Current state (audit)

- Signup → `/onboarding` (role cards → role-specific profile form) →
  `/post-login` (role-aware landing, IA-N1). ClubOwner branches to
  `/clubs/create`.
- After that: **nothing guides anyone.** No checklists, no tours, no help
  section, no contextual "learn how", no videos. Density-graceful
  homepage + "Do more" card are the only nudges.
- Assets we already have: **NPH demo world = the film set** (built for
  demos; reseeds in ~30s to a photogenic state); YouTube embedding
  already shipped (MediaAsset VIDEO_EMBED, used for highlights) — a help
  center can embed videos with zero new infra.

## 2. Architecture: three layers of guidance

**Layer 1 — In-product first-run (build):**
- **"Getting started" checklist card** per role on the dashboard,
  progress derived from REAL data (no fragile tour state):
  - Parent: Add your child → Find a program → Register/sign up for a
    tryout → Follow their team (auto-checks when offer accepted).
  - ClubOwner: Create club → Create first team → Invite staff / hand off
    to a manager → Create a program (tryout/camp/house league) → Send
    first offer → Finalize roster → Connect payments.
  - LeagueOwner: Create league → Season + divisions → Invite clubs →
    Schedule → Referees → Go live.
  Each item = deep link + "Watch how (60s)" link into the help center.
  Dismissible; reappears from the user menu ("Getting started").
- **Empty states that teach**: every list page's empty state gets one
  sentence + primary action + "watch how" link (many empty states exist;
  this is copy + link work, not new machinery).
- Recommendation: **checklists + teaching empty states over interactive
  arrow overlays.** Coach-mark/arrow tours (react-joyride etc.) break on
  every UI change and test poorly on mobile. If we want pointers later,
  build a tiny in-house "pulse dot + popover" for at most 2-3 anchors
  (e.g. "+ New" menu, Manage door) — not a step-by-step walkthrough.

**Layer 2 — Short task videos (60-120s each, produce):**
One task per video, recorded on the demo world, silent-with-captions
first (voiceover optional later — captions make them language-proof and
re-recordable piecemeal). Embedded in help center + linked from
checklists and empty states.

**Layer 3 — Help center `/help` (build):**
- Public route group page: audience tabs (Parents / Clubs / Leagues /
  Referees), searchable card grid, each guide = written steps + embedded
  video. Written version matters: SEO, skimmable, cheap to update when
  UI drifts ahead of a video.
- Surface: footer link, user menu "Help & tutorials", `?` icon in
  platform top nav.

## 3. Content catalog (v2, 2026-07-07 — LEAGUE FIRST, owner's storylines verbatim)

**Leagues — the most important content (owner).** Two videos sharing one
storyline; the long one is the master recording, the sizzle is cut from it.

L-long **full feature tour (15-25 min, chaptered)** — the owner's demo
storyline, in order:
1. Create a league (action-driven: "+ New" → instant LeagueOwner)
2. Create a season (fees, games guaranteed, registration deadline)
3. Divisions + club intake (submissions → approve → roster locks)
4. Within the season: create SESSIONS and session DATES
5. Assign venues to session days; define venue START/END times + courts
6. Allocate referees (pool + availability + Uber-style shift offers)
7. Generate the schedule for ONE session (preview → commit)
8. **The payoff shot**: the moment the schedule commits — club managers
   get a bell; every team's coach, assistant coach, team manager, parents
   and players get a bell + EMAIL; then cut to a parent's team calendar
   showing the games, and the same games on a phone via the iCal feed.
   *(This fan-out was a GAP — built 2026-07-07, this commit.)*
9. League-wide touch: push a TeamEvent (e.g. "NPH Media Day") across the
   division's teams — every family's calendar + a bell, one click
   *(multi-team events built 2026-07-07)*
10. Season runs: live scoring console → scoresheet + referee sign-off →
    AI recap publishes → standings/leaders update
11. Money: league fees, who-paid-what
L-short **"Run your league on SportsHub" (3-4 min sizzle)** — cut from
L-long's chapters 1→8 payoff + one live-scoring beat + standings. Doubles
as the GTM/outreach asset for NPH-style operators.

**Club owners (the owner's corrected sequence, one short each):**
C1 Create a club · C2 Create a team · C3 Assign staff (coach designations,
handoff to club/team managers — what each can do) · C4 Post a tryout —
by owner, club manager, coach, OR team manager *(TeamManager was a GAP —
built 2026-07-07)* · C5 Tryout day: signups + mobile check-in ·
C6 Create offer TEMPLATES (the reusable packages) · C7 Send offers —
attach one or several templates as package options, bulk-send to checked
players · C8 (parent POV interlude) Accept the offer + pick the package
(Returning vs New) + sizes + jersey prefs · C9 Finalize the team (accepts
→ roster → league submission + Order Sheet) · C10 ONE team calendar:
practice days → announce → games land automatically → team events (photo
day, film session — club managers can push one event across several
teams) → phone sync · C11 Finances: payment posture, obligations,
who-paid-what · C12 Communications: team chat, quick polls in chat,
surveys. *(C10-C12 features all exist — shipped 2026-07-06/07; team
events + multi-team push built 2026-07-07.)*

**Parents (4 shorts):**
P1 Sign up & add your child · P2 Discover programs (tryouts, camps, house
leagues; club pages, follow) · P3 Register for a tryout; accept an offer +
choose your package · P4 Follow the season (team page, live scores, stats,
chat + polls, practice/game calendar + phone iCal sync).

**Referees (2 shorts):** R1 Profile + availability + accepting session
offers · R2 Scoring a game + PIN sign-off.

**Referees (2 shorts, add):** R1 Profile + availability + accepting
session offers · R2 Scoring a game + PIN sign-off.

## 4. Production workflow

- **Set**: `npx tsx scripts/seed-nph-demo.ts` before each session — same
  photogenic state every time; accounts per docs/nph-demo-seed-plan.md.
- **Record**: 1280×800 browser window (or iPhone simulator for mobile
  flows like check-in/scoring). Screen Studio (nicest zooms) or QuickTime
  (free) on macOS.
- **Style v1**: silent + on-screen captions + cursor emphasis. Fast to
  make, easy to redo when UI changes, no voice-talent dependency. L-short
  is the one video worth a scripted voiceover.
- **Scripts**: I write every script/shot-list (step-by-step click paths
  on the demo world) into `docs/tutorials/` so any session (or the owner)
  can record from them. Owner records, or hands them back to be recorded.
- **Hosting**: YouTube unlisted + embeds (infra exists). Free, chaptered,
  speed controls, no bandwidth cost.

## 5. Build items (in-product, when green-lit)

1. `/help` help center (route + guide content model — start as MDX/static
   config, no DB) — ~half day.
2. Getting-started checklist component + per-role progress derivation —
   ~1 day incl. tests.
3. Empty-state copy + "watch how" links sweep — ~half day.
4. `docs/tutorials/` scripts for all 16 videos above — writing work.
5. (Later, optional) pulse-dot pointers for "+ New" and Manage door.

## 6. Demo-readiness gaps (owner: "build them all first") — status

Audited both storylines end-to-end 2026-07-07:
- ✅ BUILT (this commit): **schedule commit fan-out** — club-level bell for
  owners/managers + bell+EMAIL to every team's staff + rostered families
  with a team-calendar link (was: club managers only, silently). Int test
  seed 1125 (no double-bell; calendar link; game counts).
- ✅ BUILT (this commit): **TeamManager can post tryouts** (was: owner/
  manager/Staff only). Int test seed 1126.
- ✅ BUILT (2026-07-07, follow-up): **team events in the ONE calendar**
  (owner rule: no separate calendars/links) — TeamEvent/TeamEventTeam,
  add/edit/cancel by coach/TM/club managers/league owner; club + league
  scopes push one event across multiple teams; members get ONE deduped
  bell + email; events ride the same calendar endpoint AND the phone iCal
  feed. Int test seed 1127; demo world seeds a Lords photo day + NPH
  Media Day across 6 G9 teams. Runbook #15.
- ✅ Already existed (verified): session-day venue start/end times +
  courts; referee pools/booking; games in team calendar AND phone iCal
  feed; multi-package offers + bulk send; practices; finances; chat/polls.
- Both storylines are now recordable start-to-finish on the demo world.

## 7. Phasing

- **T1 (build week):** /help skeleton + checklists + all scripts written
  (league scripts FIRST).
- **T2:** record L-long master → cut L-short sizzle.
- **T3:** C1-C12 + P1-P4 shorts; embed; empty-state links; R1-R2.

## 8. Owner decisions needed

1. Voice: silent+captions v1 (recommended) or voiceover from day one?
   (L-short sizzle should get a voiceover either way.)
2. Who records: owner from my scripts, vs. scripts+captions fully
   prepared and owner just screen-drives?
3. Green-light T1 build (help center + checklists + scripts)?
