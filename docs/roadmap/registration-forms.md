---
updated: 2026-07-08
status: planned
tier: 0
area: onboarding
effort: L
source: layer2
tags: [theme/onboarding, type/plan, status/planned]
---

# 📝 Configurable registration + custom fields

**Tier 0 · effort L · from layer2.** The container every Tier-0 safety requirement rides on; also core competitor parity (OBA runs on RAMP for exactly this).

## Problem
There is no way for a club/league to define a registration form with custom fields/questions. Waivers, medical info, consent, and eligibility questions all need a place to live at signup/registration.

## Scope
- Form/field model (per program or per tenant): field types (text, select, checkbox, date, file, signature)
- Attach a form to tryout/camp/house-league/offer registration
- Render + validate on the family registration path; persist responses
- Operator builder UI to add/reorder/require fields

## Acceptance
- A club can add a custom question and see answers on the signup
- Required fields block submission
- Responses visible in the signups/roster views

## Dependencies
none (foundation)

## Refs
[[waivers-esign]] · [[player-safety-medical]] · [[privacy-pipeda-casl]] · [[requirements-map]] · [[coverage-audit]] · [[_moc-onboarding]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-onboarding]]
