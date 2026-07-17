---
updated: 2026-07-17
tags: [theme/design, type/plan, status/awaiting-owner-review]
---

# Persona screen review — principles + the Home briefing design

Owner directive (2026-07-17): capture these ideas, then review **all screens
persona by persona** (coach, parent, player, league owner, club owner —
parent is the #1 audience) TOGETHER before building. Nothing below is
implemented; the Home design is a PROPOSAL the owner reacted positively to
but wants to place inside a full-screen review first.

## Design principles (accumulated owner rulings — apply to EVERY screen)
1. **A screen is a briefing, not a directory.** The five tabs (Home, Chat,
   Calendar, context, Account) own their domains completely. Any screen
   that repeats another tab's content is dead weight. Ask of every module:
   *what does this show that isn't one tap away already?*
2. **Quiet is good.** If nothing needs the user, the screen is short.
   Empty-but-calm beats filled-but-irrelevant.
3. **"Mine" beats "all."** Show the user THEIR game/score/news, never the
   hub-wide feed (that lives in Browse). A coach doesn't register for
   tryouts; a parent doesn't care about other clubs' games.
4. Every entity is clickable, on all three surfaces (law, 2026-07-17).
5. Phone = phone: mobile web and native are the same design; desktop is the
   wide layout. No "native extras."
6. No redundant navigation (tab bar/nav/entity-name already covers it → no
   extra pill/section).
7. Max 5 tabs, full-size capsules.

## The Home briefing design (PROPOSED — owner: "maybe apply elsewhere too")
Skeleton for every signed-in persona: **Needs attention → the one card →
new since last visit → quiet "Browse the hub →" row.** Nothing else.

| Persona | Needs attention | The card | New since last visit |
|---|---|---|---|
| Parent (#1) | offers to answer, payments due, RSVPs owed | next event PER KID; game-day card w/ live score when a kid plays today | kids' teams' results, club announcements |
| Player 13+ | RSVPs owed | their game-day card | their own line from the last game + team result |
| Coach | RSVP gaps for next game, requests, unread team chat | their team's next/live game (practices stay in Calendar) | team result + org announcements |
| Referee | open shift requests | next assignment | — |
| Club owner / league owner | approvals pending, staff invites | live games in their org today | registrations this week |
| Anonymous | — | — | marketing/browse home unchanged (discovery IS the product for prospects) |

Key owner critiques that produced this (don't relitigate):
- "Your week" duplicates the Calendar tab under the thumb → cut.
- "My teams" duplicates the My Team tab → cut.
- Programs/tryouts/clubs/leagues/news on a coach's home → cut (Browse).
- Home only earns score content when it's YOUR team's score.

## The review the owner wants (next working session — WITH him)
Walk every screen per persona, applying principles 1–7, before building:
- **Coach**: Home · My Team (context tab) · team home · chat · calendar ·
  scoring console entry · account
- **Parent**: Home · My Kids · kid detail · offers/payments · calendar ·
  chat · account
- **Player 13+**: Home · player page · team · calendar · chat
- **Club owner**: Home · My Club (operator) · club dashboard screens ·
  staff/teams management · programs
- **League owner**: Home · My League (operator) · league screens ·
  scheduling · standings
Output per screen: keep / cut / move / merge for every module, then ONE
implementation pass per screen across all three surfaces.

## Status
- NOT built. Awaiting the joint review session. The element-sweep ledger
  (native-parity-audit.md) continues separately for visual parity of what
  already exists.
