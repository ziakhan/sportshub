---
updated: 2026-07-08
status: draft
tier: 2
area: identity
effort: M
source: owner
tags: [theme/identity, type/plan, status/draft]
---

# 🔓 Player profile public/private toggle

**Tier 2 · effort M · from owner · DRAFT (rough plan; detail later).** A simple switch:
a player profile is public or private. **No follows, no permission requests, no
add-people** — just on/off.

## Problem
Player pages (`/player/[id]`) exist with stats + a game log, but there's no
owner-controlled visibility switch. Families should decide whether a profile is
publicly viewable.

## Scope (rough)
- `profileVisibility` (PUBLIC | PRIVATE) on the player (or user) profile.
- Public → visible at its [[handles-identity|@handle]]/id to anyone; Private →
  visible only to the family + participating club/league (reuse existing viewer-scope).
- Toggle in settings; no follows/requests/notifications.

## ⚠️ Minor-safety guardrail (important)
Public profiles of **minors** are sensitive. This must respect what we already
built and the compliance work:
- Default **minors → PRIVATE**; making a minor public should be **parent-gated**
  (COPPA), and honor existing name-privacy (`MediaConsent` / `publicPlayerName`).
- Ties to [[privacy-pipeda-casl]] (consent) and [[player-safety-medical]] (never
  expose medical/emergency data regardless of profile visibility).

## Acceptance (rough)
- A profile owner (or a parent for a minor) can flip PUBLIC/PRIVATE.
- Private profiles 404/blur for non-participants; medical/PII never public.

## Dependencies
Reuses `lib/privacy` viewer-scope + name-privacy. Pairs with [[handles-identity]].

## Open questions (for the detailed plan)
- Granularity — whole profile only, or per-section (stats public, contact private)?
- Adult self-registered players vs. parent-managed minors — same toggle, different gating.

## Refs
[[handles-identity]] · [[customizable-pages]] · [[privacy-pipeda-casl]] · [[player-safety-medical]] · [[_moc-identity]] · [[requirements-map]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-identity]]
