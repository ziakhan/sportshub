---
updated: 2026-07-08
status: shipped
tier: 1
area: scoring
effort: S
source: layer1
tags: [theme/scoring, type/plan, status/shipped]
---

# 📋 Scorekeeper can actually score

**Tier 1 · effort S · from layer1 · ✅ SHIPPED 2026-07-08 (LOCAL/UNPUSHED).**

## ✅ What shipped (no schema change — `Role.Scorekeeper` + `UserRole.gameId` already existed)
- `canScoreGame` now honors a game-scoped Scorekeeper (`UserRole role=Scorekeeper, gameId`) —
  one branch unblocks all 6 scoring call sites (console bootstrap, events, lock, finalize,
  scoresheet, referee-assign).
- New assignment API `/api/games/[id]/scorekeeper` (GET pool / POST assign / DELETE) — a clone of
  the referee route, fully audited (`SCOREKEEPER_ASSIGN|UNASSIGN`, added to the AuditAction union),
  notifies the assignee.
- New `GameScorekeeperControl` widget on the `/score` hub beside the referee control; the `/score`
  game-list query gained a branch so an assigned scorekeeper actually sees their games.
- Demo scorekeeper account seeded: `scorekeeper@sportshub.demo` / TestPass123! (global Scorekeeper role).
- Verified end-to-end: scorekeeper 403 on an unassigned game → operator assigns → 200 (console opens)
  → game appears on `/score`.

Original scope below.

The Scorekeeper role is seeded and shows a 'Score games' nav link, but authorization 403s a scorekeeper-only user — the persona can't do its one job.

## Problem
canScoreGame only allows league owner + club staff; per-game Game.scorekeepers scoping is deferred.

## Scope
- Allow a user assigned as scorekeeper (per-game or per-league) to open the console
- Implement Game.scorekeepers assignment (or league-scoped Scorekeeper) in authz
- Assignment UI for league/club to designate a scorekeeper

## Acceptance
- A scorekeeper-only account can open and score an assigned game
- No regression to existing scorer access

## Dependencies
none

## Refs
[[live-scoring-design]] · [[requirements-map]] · [[coverage-audit]] · [[_moc-scoring]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-scoring]]
