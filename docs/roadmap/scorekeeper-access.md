---
updated: 2026-07-08
status: planned
tier: 1
area: scoring
effort: S
source: layer1
tags: [theme/scoring, type/plan, status/planned]
---

# 📋 Scorekeeper can actually score

**Tier 1 · effort S · from layer1.** The Scorekeeper role is seeded and shows a 'Score games' nav link, but authorization 403s a scorekeeper-only user — the persona can't do its one job.

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
