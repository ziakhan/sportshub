---
updated: 2026-07-18
tags: [theme/design, type/audit, status/in-progress]
---

# Complete UX audit — every screen, every platform (overnight 2026-07-18)

Method: 32 mobile-web captures (390px, PNG + text outline) across anonymous
/ parent / coach / club-owner / referee + native code-reads, critiqued
against the owner's laws: briefing-not-directory · mine-beats-all ·
quiet-is-good · every-entity-clickable · no-redundant-nav · phone=phone.
Severity: 🐛 defect · 🔴 structural (wrong content for the persona) ·
🟡 improvement · ✅ good as-is.

## Bugs found by the harness itself
- 🐛 **/events (anonymous) has 72px horizontal overflow at 390px** — the
  only screen that fails the no-sideways-scroll rule.
- 🐛 **Offers rows concatenate text**: "Toronto Lords Fall Elite**for**
  Miles Reyes" — missing separator between team name and "for X" (web
  /offers list).
- 🐛 **Referee shift offers concatenate**: "09:00–15:00**Summer 2026** ·
  Week 5**first accept wins**" — three fields run together (web
  /referee/requests).

## Parent (persona #1)
- ✅ **Home** — post-redesign it leads exactly right: color-coded
  attention cards (5 payments due · 4 RSVPs · 1 unread), day-grouped week
  with kid names + RSVP pills, teams rail. This is now the reference
  screen.
- 🟡 **Calendar** — opens at the top of the month (July 11 first): a
  parent scrolls past a week of dead events every visit. Anchor at TODAY
  with a small "earlier this month" link up top.
- 🔴 **Payments** — headline is right ("5 open items — CA$2,418
  outstanding") but the list starts with PAID deposits. The 5 things
  needing money must sort first; paid history collapses below
  (mine-beats-all: action before record).
- 🟡 **Offers** — structure fine (open then past), plus the join bug above.
- ✅ **Messages** — DMs + team chats with unread badges; clean.
- ✅ **Notifications** — clear, actionable, dismissible.

## Coach
- ✅ **Home** — mirrors the parent band correctly.
- 🔴 **Team home (web /teams/[id])** — leads with FIVE nav tiles
  (Calendar & RSVPs / Team chat / Polls / Public page / Register for a
  league) before any content. On mobile web the bottom tabs ALREADY have
  Chat + Calendar + My Team → the first three tiles are the same
  redundant-nav sin as the old chat pills. Keep "Public team page" +
  "Register for a league" (real actions not in nav), lead with the
  game-day card + roster.
- 🟡 **Team polls page** — "Team Chat / Team Home" pills at top =
  redundant nav; team name should be the link (chat-header ruling applies
  here too).
- ✅ Team chat, team calendar — consistent with recent fixes.

## Club owner
- 🔴 **Dashboard** — "Welcome back, Nathan!" + a **Browse programs**
  button as the primary CTA. A club owner does not browse programs — they
  RUN programs (mine-beats-all violation at the top of their most
  important screen). The stat row (2 Leagues · 36 Teams · 161 Games · "81
  games per league") reads as vanity numbers — none are actionable; no
  pending-approvals / unread / registrations-this-week (the operator
  briefing from the persona table).
- 🟡 Getting-started 75% card is good but shouldn't outrank operations.

## Referee
- ✅ **Requests** — offers with accept/decline + availability declaration
  = exactly the briefing shape. (Join bug noted above; "first accept
  wins" should be a pill, not run-on text.)

## Anonymous
- ✅ Home/scores/game/news — marketing + discovery is the product here.
- 🐛 /events overflow (above).

(continued below as the audit proceeds)

## Cross-platform parity state (native vs mobile web)
Native screens are all natively-built with parity intent (no webviews).
Remaining ELEMENT-level gaps are the known sweep rows: calendar detail
pass, team home (3 variants), scores list, game page detail, chat body.
New from this audit:
- 🟡 Native "My Team" context tab (coach) vs web /teams/[id]: web version
  has "Register for a league" action — native team screen doesn't. Add to
  native or accept as desktop-only admin (owner call).
- 🟡 Native operator tab is read-only by design ("what needs me on the
  road") — GOOD design, but the WEB club-owner dashboard should learn from
  it (see below), not the other way around.

## Discovery IA — the confirmed overlap (owner flagged this weeks ago)
🔴 THREE anonymous discovery surfaces do one job: /marketplace ("Tryout
Marketplace"), /events ("Find Programs & Tryouts — tryouts, house leagues,
camps, tournaments"), and the Programs section pill. /events is a superset
of /marketplace. Recommendation: ONE "Programs" destination with type
filters; /marketplace 301s to it; nav pill count drops to 5
(Scores·Programs·Clubs·Leagues·News), matching the 5-tab rule in spirit.

## Features that should be MORE available (day-by-day value, buried today)
1. **RSVP from the week rows** — home band rows link to /calendar; the RSVP
   pill names who owes but you can't answer from home. One-tap Going/Can't-go
   on the home card = the single highest-frequency parent action.
2. **Pay from the payments card** — home says "5 payments due"; /payments
   then buries the 5 due under paid history (fix ordering + a Pay button per
   row at top).
3. **Operator briefing on web home/dashboard** — club owner's most-visited
   screens show them browse content and vanity stats. They need: approvals
   pending · registrations this week · live games in their org · unread org
   messages. (The NATIVE operator tab already has the right shape — port its
   content priorities to the web dashboard.)
4. **Referee next-assignment on home** — refs get a generic scoreboard;
   their next assignment + open offers should be the home card.
5. **Coach's team rail on web home** — getYourTeams excludes coached teams
   on web; native shows them. Fix the query, not the layout.

## LESS priority (currently over-weighted)
- Hub-wide HIGHLIGHTS video row renders high on participant homes (coach,
  club owner) — move below personal content or behind Browse.
- The 6-pill section nav (incl. Marketplace) on every signed-in page —
  becomes 5 after the Programs merge.
- Vanity stat rows on operator dashboard (36 Teams · 161 Games) — replace
  with actionable counts.
- "Browse programs" CTA on the operator dashboard — remove.

## Priority order (recommendation for the owner's morning)
1. 🐛 Fix the 4 defects (events overflow; 3 text-join bugs: offers rows,
   referee offers, players jersey join).
2. 🔴 Payments ordering (due first) + calendar anchors at today — two small
   changes, both high-frequency parent pain.
3. 🔴 Operator web dashboard rebuild to the briefing shape (native operator
   tab is the template) + drop Browse-programs CTA.
4. 🔴 Coach team rail on web home (query fix) + referee home card.
5. 🔴 Team-home nav-tile cleanup (web /teams/[id]) per no-redundant-nav.
6. 🟡 Programs/Marketplace/Events merge (IA decision — needs owner sign-off
   on naming).
7. Then: the persona Home briefing rebuild (persona-screen-review.md) —
   items 2–5 above are compatible stepping stones toward it.

## Status: audit complete; NOTHING implemented from this doc yet.
