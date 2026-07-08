---
updated: 2026-07-08
status: planned
tier: 2
area: leagues
effort: M
source: layer1
tags: [theme/leagues, type/plan, status/planned]
---

# 🏅 Playoff / bracket generation

**Tier 2 · effort M · from layer1.** Configured but not generated: playoffFormat/playoffTeams are saved, but the scheduler only produces REGULAR games.

## Problem
No bracket generation surfaced.

## Scope
- Generate a bracket (single/double elim, pools) from standings + playoffFormat
- Seeded matchups; venue/time assignment via the existing scheduler
- Bracket view (operator + public)

## Acceptance
- A league can generate + commit a playoff bracket from final standings

## Dependencies
none

## Refs
[[league-v2-plan]] · [[requirements-map]] · [[coverage-audit]] · [[_moc-leagues]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-leagues]]
