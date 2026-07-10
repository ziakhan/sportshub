---
updated: 2026-07-08
status: shipped
tier: 1
area: leagues
effort: L
source: layer2
tags: [theme/leagues, type/plan, status/shipped]
---

# 🔄 Season rollover / returning-player re-registration

> **✅ SHIPPED 2026-07-09 as the season-continuity build (Phase 3, `6199986`)** — team archive +
> lineage, 4-step "Start next season" wizard w/ carry-over offers, league close-out, camp/HL
> duplicate-as-new, season-open notifications. See [[season-continuity-plan]] for what shipped;
> this doc remains as the original requirement statement.

**Tier 1 · effort L · from layer2.** The retention loop is the SaaS revenue engine and it does not exist; Team.season is free text and rosters are rebuilt by hand every season.

## Problem
No clone/carry-forward of teams/rosters; families re-enter everything each season.

## Scope
- Clone a team/roster into a new season; invite returning families to re-register (reuses invitation-continuity)
- Carry player profiles forward; prompt to confirm/update
- Returning-player discount hook (ties to financial-aid-discounts)

## Acceptance
- A club can roll a team into next season and returning families re-register in a few clicks

## Dependencies
invitation-continuity

## Refs
[[invitation-continuity]] · [[league-v2-plan]] · [[requirements-map]] · [[coverage-audit]] · [[_moc-leagues]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-leagues]]
