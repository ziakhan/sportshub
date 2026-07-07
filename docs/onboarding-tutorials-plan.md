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

## 3. Content catalog (v1 — owner's list, structured)

**Parents (4 shorts):**
P1 Sign up & add your child · P2 Discover programs (marketplace: tryouts,
camps, house leagues; club pages, follow) · P3 Register your kid + accept
an offer (incl. package choice, sizes, payment) · P4 Follow the season
(team page, live scores, stats, chat, polls, practice calendar + phone
iCal sync).

**Club owners (8 shorts):**
C1 Create your club · C2 Create teams · C3 Hand off to managers (invite
staff, designations, what managers can do) · C4 Create programs (tryout /
camp / house league) · C5 Tryout day (signups, mobile check-in) · C6 Send
offers (incl. multi-package Returning-vs-New + bulk send) · C7 Finalize
teams (accepts → roster → league submission, Order Sheet) · C8 Money
(payment posture, obligations, who-paid-what).

**Leagues (the owner's two-video ask):**
L-short **"Run your league on SportsHub" (3-4 min sizzle)** — club intake
→ scheduling substrate → live scoring + recaps → standings/leaders →
referee booking → payments. Demo-world screen capture, tight cuts; doubles
as the GTM/outreach asset for the NPH-style operators.
L-long **full feature tour (15-25 min, chaptered)** — every feature with
YouTube chapter stamps; each chapter is reusable as a standalone clip.
Chapters: league+season setup, divisions/scheduling groups, venues+
sessions, club submissions & roster locks, scheduling, referee pools +
Uber-style booking, live scoring console + scoresheet + sign-off, recaps/
news, standings/leaders, payments, comms (chat/polls/practices).

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

## 6. Phasing

- **T1 (build week):** /help skeleton + parent & club checklists + the 16
  scripts written. Videos can be recorded any time after.
- **T2:** record P1-P4 + C1-C8 shorts; embed; empty-state links.
- **T3:** L-short sizzle (voiceover) + L-long chaptered tour + R1-R2;
  league checklist; pointer dots if still wanted.

## 7. Owner decisions needed

1. Voice: silent+captions v1 (recommended) or voiceover from day one?
2. Who records: owner from my scripts, vs. scripts+captions fully
   prepared and owner just screen-drives?
3. Green-light T1 build (help center + checklists + scripts)?
4. Priority order confirmation: parents first, then club owners, then
   league videos — or league sizzle first for GTM outreach?
