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
