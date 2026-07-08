---
updated: 2026-07-08
tags: [theme/content-ux, type/plan, status/in-progress]
---

# Logged-in home & landing redesign — scoping (2026-07-07, owner ask)

Owner: after logging in — especially as an established parent/staff/club
owner — the home page still spends real estate on **promotional** content
("what the platform is about", "for parents / coaches / families / league
owners", "what the club is about"). Signed-in members don't need the
pitch; they need their **content**. Maximize the real estate, drop the
marketing once someone is in. Explicitly a **separate project** from the
tutorials/demos work.

## Why this is its own project

It overlaps the long-parked **Site IA reorganization** (docs/site-ia-plan.md
— the two-worlds model, programs-vs-marketplace overlap, menu order,
Scores→Leagues). The home/landing surface is exactly where those decisions
become visible. Do them together: one pass that decides (a) what the
signed-out landing sells, and (b) what the signed-in home shows.

## Principle

**Anonymous = a pitch + a taste of live content. Signed-in = content-first,
zero pitch.** (ESPN/MaxPreps model — the moment you have favorites, the
promo rails disappear and your stuff takes the space.)

## Section-by-section inventory (done 2026-07-07, `(public)/page.tsx`)

The promo blocks are **NOT gated by sign-in today** — a signed-in parent
scrolls their teams + scores, then hits the full marketing wall.

| # | Section (line) | Type | Signed-in verdict |
|---|---|---|---|
| 1 | YourTeamsRail (100) | content | **KEEP — lead with it** |
| 2 | ScoreboardStrip (101) | live content | **KEEP** |
| 3 | Hero "Youth basketball…" (126) | promo | **REMOVE** when signed-in w/ teams |
| 4 | NewsAndLeaders (168) | content | **KEEP** |
| 5 | HighlightsRow (170) | content | **KEEP** |
| 6 | "One platform, three ways in" (182) | promo (audience doors) | **REMOVE** signed-in |
| 7 | "Programs families can act on now" (307) | real tryouts, promo tone | **KEEP, REFRAME** ("Near you / Open programs") |
| 8 | "Clubs with active teams…" (386) | real clubs | **KEEP, REFRAME** ("Discover clubs") |
| 9 | "Everything you need to run your program" bento (471–660) | promo (feature wall) | **REMOVE** signed-in |
| 10 | "Built to replace the patchwork" (667) | promo | **REMOVE** signed-in |
| 11 | "Bring your club online" CTA (703) | promo | **REMOVE** signed-in (maybe keep a slim "run a club? →" link) |

So: **4 content + 2 reframeable discovery** sections stay; **5 promo walls
drop** the moment a member has teams. That's most of the page's real estate
freed.

## What fills the freed space — borrow modules from the deep pages

The league/club/team pages already render polished modules we can surface on
the signed-in home (personalized to the viewer's world):
- **Standings snapshot** (from `/league/[id]`) — your leagues, your team's row highlighted.
- **Upcoming games + next practice/event** (from the team calendar) — your week at a glance.
- **Stat leaders you're in / following** (from `/league/[id]/leaders`, `/player/[id]`).
- **Unread chat + open polls** (team spaces) — the "act on this" row.
- **Followed players' latest lines** (from player pages) — the GameChanger retention hook.
- **Your payment due soon** (from /payments) — one line if something's owed.

## Original design targets (kept):
- **Signed-out**: hero pitch + audience doors (parents/clubs/leagues) + a
  live-content taste (real scores/news) so it's not all marketing.
- **Signed-in (has teams/role)**: lead with Your-teams, next games,
  unread chat/polls, schedule, followed leaders/standings, news for your
  world. Cut every "for coaches/for families" promo block. Role-aware but
  content-first.
- **Signed-in but empty (new account, no teams yet)**: the ONE place a
  signed-in user still sees guidance — the getting-started checklist
  (from the onboarding plan), not marketing.

## Open questions for the owner (at design time)

1. One home route that swaps content by auth+role (recommended), or a
   distinct `/` (marketing) vs `/home` (app) split?
2. How much live-content taste on the signed-out landing — a real
   scoreboard strip, or static marketing only?
3. Fold in the Site IA menu decisions (Scores→Leagues, programs vs
   marketplace) in the same pass? (Recommended — same surface.)

## External signal (light research, 2026-07-07)

Youth-sports web research reinforces content-first for members: 82% of
parents have high expectations of club tech, <half are satisfied
([PlayMetrics](https://home.playmetrics.com/blog/youth-sports-website-best-practices)).
LeagueApps' 2025 push was a redesigned, mobile-responsive **member portal**
centered on messages, schedules, game-day tools and payments —
not marketing ([LeagueApps product updates](https://leagueapps.com/product-updates/)).
The website is "a central hub for schedules, registration, announcements"
([Jersey Watch](https://www.jerseywatch.com/blog/youth-sports-website-hosting)).
Confirms: anonymous = pitch + live taste; member = hub of their stuff.

## Status

**PHASE 1 SHIPPED 2026-07-07:** signed-in members now get a content-first
home — the 5 promo walls (hero, "three ways in", logo marquee, org feature
bento, "patchwork" + club CTA) are gated to anonymous visitors via a single
`marketing = !userId` flag in (public)/page.tsx. Content + discovery (Your
teams, scoreboard, news/leaders, highlights, Programs, Clubs) carry the page
for members. Anonymous unchanged. NEXT (optional): reframe the Programs/Clubs
headings for members, a getting-started nudge for the signed-in-but-empty
state, and fold in the Site IA menu decisions (Scores→Leagues, programs-vs-
marketplace). Originally scoped — Sequenced after the current demo/tutorial work
unless the owner reprioritizes. Related: docs/site-ia-plan.md,
docs/onboarding-tutorials-plan.md (getting-started checklist is the
signed-in-empty state).
