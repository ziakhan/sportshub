---
updated: 2026-07-08
status: planned
tier: 0
area: compliance
effort: M
source: layer2
tags: [theme/compliance, type/plan, status/planned]
---

# ✍️ Liability waivers + e-signature

**Tier 0 · effort M · from layer2.** Universal youth-sport requirement and the club's core legal shield; today the only signature capture is the referee scoresheet.

## Problem
No waiver model or e-signature capture on any registration path (tryout/camp/house-league/offer). Clubs are legally exposed.

## Scope
- Waiver document model (per club/league, versioned)
- E-signature capture (reuse SignaturePad) at registration, tied to participant + guardian
- Block participation until signed; store signed copy + timestamp + version
- Admin view of who signed what

## Acceptance
- A parent must sign the club's waiver before a signup completes
- Signed record is retrievable with version + timestamp

## Dependencies
registration-forms (can render as a form step)

## Refs
[[registration-forms]] · [[requirements-map]] · [[coverage-audit]] · [[_moc-compliance]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-compliance]]
