---
updated: 2026-07-05
tags: [theme/content-ux, type/plan, status/in-progress]
---

# Site Information Architecture — Two Worlds, One Account

> **STATUS: DECISIONS CONFIRMED (2026-07-06) — build not yet started.**
> Owner confirmed forks 1–4 (§9): personalized dropdowns; parents/players
> land on the personalized public homepage; My Hub in N3; full /manage/*
> migration in N2. Forks 5–6 stand as recommended defaults (league-id
> canonical URLs in N2; subdomain deferred to deploy time) unless the owner
> objects. Phasing in §10 is the roadmap.

## 1. Owner's vision (2026-07-06 brief)

- The public-facing website is **a list of leagues, a list of clubs, and
  relevant content** — news, scores, stat leaders, schedules — on every page.
- Public browsing and the admin dashboard are **two different worlds**, maybe
  even hosted separately someday. For now: separate them clearly on one site.
  Everybody browses the public stuff; anyone who manages something goes to
  the dashboard *deliberately* — club owners, league owners, but also parents
  (manage kids), players (13+), referees.
- **The main public audience is parents and players.** They care about *their*
  stuff: their leagues on top of any list, their kids' teams, their stats.
  Once rostered, they have very little day-to-day admin.
- Club/league owners visiting the site are *usually there to work*, not to
  read news — their door to the tools should be obvious and fast.
- Navigation instinct: **dropdowns** over intermediate pages — "Leagues"
  should open a menu with *my* leagues on top, then everything else.
- Idea worth designing: a **"my home/my stats" page** — one place where a
  parent/player sees all their stats, schedules, teams across leagues.

## 2. What the established platforms do (research, 2026-07-06)

| Platform | Pattern | Lesson for us |
|---|---|---|
| **SportsEngine** | Hard split: public club/league websites vs "HQ" admin product. Members land on a member dashboard; admins switch into HQ via a "My Organizations" dropdown; page-level public/private permissions. | The two-world model is the industry standard. The "door" between worlds is an explicit control, not mixed navigation. |
| **TeamSnap** | Role-split product: families get the consumer app (schedules, chat, streams, highlights); club/league admins get a separate management platform ("TeamSnap for Clubs & Leagues"). Same brand, two experiences. | Parents/players are *consumers*; managers are *operators*. Build for the consumer by default. |
| **ESPN** | One public site, **personalized navigation**: "MyESPN" favorites appear first in the menu bar and are highlighted in the scoreboard; menu = sports/leagues dropdowns, "scores" always one click away. | Owner's dropdown instinct is exactly ESPN's pattern: personalization *reorders* the same public nav — it never hides the rest. |
| **GameChanger** | App-centric, team-first: you open the app to *your* teams; public/fan access flows from being invited/following a team. | "My teams first" is the retention engine. Our signed-in homepage rail already started this. |
| **MaxPreps** | Pure public destination: Scores · Standings · Stat Leaders · Rankings · News per sport/state; teams and athletes are SEO pages. No management tooling in the public nav at all. | The public site should read like a *sports media site*, with zero admin vocabulary in it. |

**Synthesis:** every successful platform lands on the same architecture the
owner described independently — a consumer-grade public surface (personalized,
media-like) + an operator back office (task-like), joined by one account and
an explicit door. Nobody mixes the two navigations.

## 3. Design principles (proposed)

1. **Two worlds, one account.** PUBLIC (browse/consume) and MANAGE (operate).
   Every URL belongs to exactly one world. No dashboard chrome ever appears
   on a public page and vice versa.
2. **Consume by default, manage by intent.** The public site is the default
   landing for everyone. Entering MANAGE is always a deliberate click on a
   clearly-labeled door. (Exception: roles whose *whole job* is the tools —
   see post-login routing, §7.)
3. **Personalization reorders, never restricts.** Signed-in users see *their*
   leagues/teams first in menus, rails and scoreboards — but all public
   content stays reachable (ESPN model). Anonymous users see the same nav,
   just unpersonalized.
4. **The public site talks like a sports site, not like software.** Scores,
   standings, leaders, news, schedule. Words like "dashboard", "manage",
   "settings" appear only behind the door.
5. **URL namespaces make the future split free.** Everything operator-facing
   lives under `/manage/*`. If we later move MANAGE to `app.` or `my.`
   subdomain, it's a rewrite rule, not a migration.

## 4. Audience → surface matrix

| Audience | Public site (default world) | MANAGE world | Time split (est.) |
|---|---|---|---|
| Parent | Homepage w/ "Your teams" rail; kid's stats/schedule; league hubs; news; follows | Kids' profiles, registrations/payments, media consent, settings | 90 / 10 |
| Player 13+ | Same as parent + own player page, leaders ("am I on the board?") | Own profile, availability | 95 / 5 |
| General public / grandparent | Browse everything, no account | — | 100 / 0 |
| Club owner/manager/staff | Occasional: own club/team public pages, league standings | Teams, tryouts, offers, payments, staff — daily work | 20 / 80 |
| League owner/manager | Own league hub (as spectators see it) | Seasons, scheduling, standings config, payments | 20 / 80 |
| Referee | Public game pages | Assignments, profile, PIN, availability | 40 / 60 |
| Platform admin | — | Admin console | 0 / 100 |

## 5. The PUBLIC world (spec)

### 5.1 URL map (spectator surface — all SEO pages)
```
/                     homepage (density-graceful; personalized when signed in)
/scores               NEW: full scoreboard by date/league (strip → page)
/leagues              league directory (exists)
/league/[season]      league hub: scores·standings·leaders·news·teams (exists)
/league/[season]/leaders   full stat leaders (exists)
/club                 club directory (exists)   /club/[slug] club hub (exists)
/team/[id]            team hub (exists)         /player/[id] player page (exists)
/news                 feed (exists)             /news/[slug] story (exists)
/events, /marketplace, /tryout/*, /camp/*   program marketplace (exists)
/live/[gameId]        live game page (exists)
/for-clubs, /for-leagues   acquisition pitches (exist)
```
Open question: `/league/[seasonId]` vs canonical `/league/[leagueId]` with a
season picker (NBA.com pattern: the league is the destination; the season is
a filter). Recommend migrating to league-id URLs with season switcher in N2.

### 5.2 Header (public), signed-out
`Logo · Scores · Leagues ▾ · Clubs ▾ · News · Programs — [Log in] [Start free]`

### 5.3 Header (public), signed-in — the personalized dropdowns
- **Leagues ▾** — "MY LEAGUES" section first (leagues of my kids' teams +
  follows, each linking straight to its hub), divider, "All leagues" list
  (top ~6 by activity), footer "Browse all leagues →" (/leagues page stays
  for SEO/browse-all). If the user has exactly one league and no others
  exist, the top-level click can go straight to that hub.
- **Clubs ▾** — same shape: MY CLUBS (kids' clubs, follows) → featured →
  "Browse all clubs →".
- **My Hub** (see §6) replaces nothing — it's a new first-class nav item for
  signed-in parents/players.
- **The door**: right side shows `[Manage ▾]` (or role-labeled: "My Club",
  "My League") for users who hold operator roles; parents see a lighter
  `[Account]` menu (kids, payments, settings) since their "management" is
  shallow. Notification bell stays.

### 5.4 Scoreboard everywhere
`/scores` page + the homepage strip; signed-in users get *their* games pinned
first (ESPN favorites-in-scoreboard pattern).

### 5.5 Multi-sport navigation — OWNER CONFIRMED 2026-07-12
Decided during the expansion/SEO discussion ([[expansion-strategy-2026-07]],
[[seo-strategy]]):
- **One domain, one site.** Public nav gets ESPN-style top-level SPORT
  sections: `Basketball ▾ · Volleyball ▾ · …` (only sports we operate).
  Each section carries the subnav `Scores · Leagues & Standings · Clubs ·
  Camps & Programs · Tournaments · News` — these are the EXISTING global
  pages, re-scoped to `/basketball/...` URLs (identical to the SEO plan's
  URL scheme; one build, two payoffs). Ship the section nav even while
  single-sport (Basketball tab from day one).
- **Homepage = cross-sport mix.** News/scores/featured from ALL sports,
  localized; plus a "lock my default homepage" preference (user can pin
  e.g. Basketball-Mississauga as their landing view). Search bar + operator
  side-door stay.
- **Signed-in users do NOT get the public sport-link nav** — dashboards stay
  role/entity-organized with sport badges (a parent's calendar never forks by
  sport). Owner notes the logged-in/public nav seam "seems a little broken —
  figure it out later" → OPEN ITEM for N2/N3 design.
- Sport lives on League/Team/Program (single-sport each); Tenant = primary
  sport + supported list. Region enters INSIDE a sport section (city chip),
  never in the top nav.

## 5.6 N3-v2 — Task-first navigation redesign (OWNER-DIRECTED 2026-07-13, planning only — NOT built)

Owner walked the live site on a phone (ysportshub.com) and course-corrected
the N3 "My Hub" concept. Supersedes §6 below where they conflict. UI/UX
consultation run (ui-ux-pro-max: 44px targets, 8px gaps, bottom-bar
ergonomics, back-button integrity).

**Diagnosis:** the "two worlds" (public vs dashboard) split is an OPERATOR
mental model. Parents think "my kid's basketball life"; coaches think "my
team". Only club/league staff think "dashboard".

**1. Three layers:** Browse (public content, ESPN sport sections §5.5) ·
**My basketball** (any signed-in participant) · Operate (staff only).
Parents/coaches live in the middle layer, embedded in surfaces they already
touch — they never "choose a world".

**2. Entity-graph navigation (multiplicity rules):** roles grant
CAPABILITIES, the entity graph (my kids, my teams, my ref assignments)
drives NAVIGATION. Aggregate all contexts → tag with context chips (kid
avatar / team color / whistle) → dedupe overlaps (parent-coach of same team
= ONE context, coach powers in composer) → sort by urgency/recency, never
by role guess. Kid state is player-centric, parent-agnostic, attributed
("RSVP'd by Sarah", "Paid by Alex"). Requires a shared "my contexts"
resolver all surfaces use (chat list, calendar, week band must never
disagree). Calendar lenses (shipped 2026-07-12) = the house pattern for
every aggregated surface.

**3. Home = the living surface; "My Hub" name is DEAD.** Signed-in
participants get a personal band at top of the homepage they already land
on: Your Week (next events per context, RSVP inline, stacked actions for
dual-role: "RSVP for Maya" + "11/12 confirmed"), unread chats, actions due
(pay/vote/RSVP). Public content below. No separate hub destination.

**4. Account = the filing cabinet** (monthly speed): kid profiles, payment
methods/cards, registration history, receipts, notification prefs,
security. Real pages under /account/* (linkable; sheets are for toggles
only), presented as full-height sheets on phone. NEVER called a dashboard —
"dashboard" is reserved for operators. Two speeds: Home=weekly,
Account=monthly.

**5. Badge menu = canonical switchboard** (everything, role-aware, 44px
rows): Home · Dashboard (operators) · My Team(s) (coaches, ordered by next
event) · Calendar · Messages · Account & Settings (kids/payments/
registrations/notifications/security) · Sign out. Header icons (desktop:
chat w/ unread badge + calendar) and bottom tabs are SHORTCUTS to its
hottest rows — nothing exists only as an icon.

**6. Mobile = bottom tab bar** (signed-in): Home · Chat · Calendar ·
[context slot: Dashboard→operators / My Team→coaches / My Kids→parents] ·
Profile(badge sheet). Persistent everywhere incl. Account and dashboard
(the escape hatch). Always-home invariant: logo→Home always, bottom Home
tab always, no surface >1 tap from Home, manage keeps "← Back to site".

**7. Chat = never guess, the list answers:** chat icon → one WhatsApp-style
conversation list (all contexts), unread-first + recency, context chips,
badge = total unread. Coach multi-team landing: single team → straight in;
multiple → picker ordered by next upcoming event.

**8. Dropdowns vs pills principle (owner dislikes pill-only nav):**
dropdown menus = navigating ACROSS things ("go to": badge, browse menus,
team switcher, dashboard sidebar sub-groups — RESTORE the wave-1-removed
sidebar sub-items as collapsible groups); tabs/pills = views WITHIN one
thing ("look at": club page sections, team tabs), max ~6 visible + "More ▾"
overflow on desktop — horizontal-scroll pills acceptable on MOBILE only.
Sidebars = operator workspaces only; parents/coaches never see one.

**9. Device scoping — "MOBILE IS MOBILE" invariant (owner rule):** native
app and mobile web are ONE surface in two wrappers; identical capabilities
by design (native may TRAIL in ship timing via app-store cycles, never in
scope). Three classes: **Mobile-full** (road tasks — my-layer, coach kit
incl. roster/attendance/polls/quick-practice, referee kit, scoring console,
pay/register) = everywhere · **Mobile-visible** (operator worlds read-only
+ "finish on computer" defer + email-me-a-link; native renders these as
embedded webviews of the mobile-web pages = single source, no drift) ·
**Desktop-only** (config/editing: program setup, season scheduling, staff,
Stripe onboarding, page customization, exports — ABSENT from both mobile
surfaces, never a broken form). Native's raisons d'être: push, home-screen
habit, Payment Sheet, later offline scoring. Defer-never-dead-end: mobile
shows read-only + emails a deep link, never hides silently.

**10. Post-login routing changes (§8 amendment):** coaches land on their
team (or next-event-ordered picker), not the dashboard; operator+parent
lands on Home-personal (dashboard is one badge tap); parents/players Home.

**Proposed defaults awaiting explicit owner sign-off at build time:** coach
team-page landing · operator+parent → Home · chat as global header icon.
Build order NOT decided — this section is the spec, nothing implemented.

## 6. "My Hub" — the parent/player home (SUPERSEDED by §5.6 — kept for history)

One page (`/home` or `/my`) answering "what's happening with MY basketball":
- Per kid (or self, for 13+): next game (time/venue/opponent), last game
  result + their line, season averages, team standings position.
- Aggregated schedule across all kids/teams/leagues (the "family calendar").
- Their leagues' latest recaps/highlights, follow suggestions.
- Shortcuts into the shallow admin bits parents actually do (register for a
  program, pay a fee, media consent) — WITHOUT entering the operator world.

Notes:
- This is the natural **Family Pass surface** (content-plan §12): free tier
  shows the summary; premium depth (full logs, clip downloads, live "your
  kid" alerts) lights up here at P3.
- Relationship to today's signed-in homepage rail: the rail is the teaser;
  My Hub is the full page. Rail card "See everything →" links here.
- Players 13+ get the same page scoped to themselves ("My stats").

## 7. The MANAGE world (spec)

- **Namespace:** everything operator-facing migrates under `/manage/*`:
  done: `/manage/leagues`* · to move: `/teams`, `/clubs`, `/players`,
  `/tryouts`, `/offers`, `/payments`, `/referee`, `/settings`, `/dashboard`
  itself → `/manage` (the overview). Old URLs get redirects.
- **Chrome:** current sidebar + top bar stays; add a prominent
  **"← Public site"** link (and per-entity "View public page" buttons on
  club/team/league management screens — operators constantly want to see
  what parents see).
- **Role-aware landing:** `/manage` renders the role-appropriate overview
  (club owner → club ops; league owner → league ops; referee → assignments;
  parent → redirected out to My Hub, since parents' admin is shallow).

## 8. Post-login routing (by primary role)

| Role | Lands on |
|---|---|
| Parent / Player | **Public homepage (personalized)** — or My Hub once built |
| Club owner/manager, League owner/manager | `/manage` (their ops overview) |
| Referee | `/manage/referee` (assignments) |
| Platform admin | `/manage/admin` |
| Multi-role (e.g. parent + club owner) | Highest-commitment operator role wins; the door makes switching one click |

Deep links always win over role routing (post-auth redirect already shipped).

## 9. Decision forks — OWNER CONFIRMED 2026-07-06

1. **Nav pattern for Leagues/Clubs**: ✅ (a) personalized dropdown, my
   leagues/clubs first, "Browse all" keeps the directory pages for SEO.
2. **Parent/player post-login landing**: ✅ (a) personalized public homepage
   now; My Hub becomes the landing once N3 ships.
3. **My Hub**: ✅ (a) build as its own page in N3.
4. **`/manage/*` migration of remaining areas**: ✅ (a) do it in N2 with
   redirects, while the repo is unpushed and renames are cheap.
5. **League URL canonicalization** to `/league/[leagueId]` + season picker:
   recommended default stands (yes, in N2) — owner may veto.
6. **Subdomain split** (`app.`/`my.`): deferred to deploy time (default:
   same domain until traffic justifies it).

## 10. Phasing (proposed — nothing started)

| Phase | Scope | Est. |
|---|---|---|
| **N1 — Personalized nav + the door** | Header dropdowns (my-leagues/my-clubs first), `/scores` page, Manage/Account door in public header, "← Public site" in dashboard, post-login routing by role | 1–2 sessions |
| **N2 — Namespace + canonical URLs** | Move remaining ops pages under `/manage/*` w/ redirects; `/league/[leagueId]` canonical + season picker; per-entity "View public page" buttons | 1–2 sessions |
| **N3 — My Hub** | `/home` for parents/players (multi-kid, cross-league); homepage rail links into it; groundwork for Family Pass surfaces | 1–2 sessions |
| **N4 — Subdomain call** | Deploy-time decision; rewrite rules if split | — |

## 11. Research sources

- SportsEngine HQ admin/public separation: help.sportsengine.com (admin
  welcome, page-visibility, website guide); sportsengine.com/hq
- TeamSnap ONE families-vs-operators split: teamsnap.com/one, TeamSnap for
  Clubs & Leagues intro
- ESPN personalized navigation (MyESPN favorites in menu bar + scoreboard):
  espn.com "A guide to the new ESPN.com navigation"
- GameChanger team-first app model: gc.com app features
- MaxPreps public-destination nav (Scores/Leaders/News): maxpreps.com
