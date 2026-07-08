---
updated: 2026-07-08
status: planned
tier: 0
area: compliance
effort: L
source: layer2
tags: [theme/compliance, type/plan, status/planned]
---

# 🔒 PIPEDA/CASL: consent, prefs, export, deletion

**Tier 0 · effort L · from layer2.** Required to operate lawfully in Canada; the spec wrongly frames privacy as GDPR-future.

## Problem
No Privacy Policy/ToS acceptance at signup, no purpose consent, no notification preferences/unsubscribe (CASL), no self-serve data export or deletion.

## Scope
- Privacy Policy + ToS pages + acceptance record at signup
- Notification preferences (per-channel/per-event) + unsubscribe (CASL)
- Self-serve data export (access request) and account/child deletion (erasure) — build on existing soft-delete
- Data-retention policy for minor data

## Acceptance
- Signup records ToS/privacy acceptance
- A user can export their data and delete their account/child
- Every email has a working unsubscribe

## Dependencies
none

## Refs
[[registration-forms]] · [[requirements-map]] · [[coverage-audit]] · [[_moc-compliance]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-compliance]]
