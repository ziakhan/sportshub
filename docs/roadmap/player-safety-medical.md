---
updated: 2026-07-08
status: planned
tier: 0
area: compliance
effort: M
source: layer2
tags: [theme/compliance, type/plan, status/planned]
---

# 🚑 Emergency contacts + medical/allergy info

**Tier 0 · effort M · from layer2.** Life-safety and table-stakes; you cannot responsibly run a practice/game/camp with minors without this. The Player model captures none of it today.

## Problem
Player has DOB/gender/jersey only — no emergency contact, allergies, medications, or conditions.

## Scope
- Add emergency contact(s), allergies, medications, conditions to Player
- Capture at registration (via registration-forms); editable by guardian
- Surface to staff on game-day/roster/check-in (privacy-scoped)

## Acceptance
- Every player record can hold ≥1 emergency contact + medical notes
- Coaches see medical/emergency info for their rostered players only

## Dependencies
registration-forms

## Refs
[[registration-forms]] · [[co-guardian-households]] · [[requirements-map]] · [[coverage-audit]] · [[_moc-compliance]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-compliance]]
