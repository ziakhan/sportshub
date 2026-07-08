---
updated: 2026-07-08
status: planned
tier: 0
area: compliance
effort: M
source: layer2
tags: [theme/compliance, type/plan, status/planned]
---

# 🛡️ Vulnerable-sector background-check tracking

**Tier 0 · effort M · from layer2.** Mandated by Ontario associations for anyone working with minors; coaches are assigned today with zero screening gate.

## Problem
No screening status/expiry on staff; UserRole/StaffInvitation grant coach roles with no check.

## Scope
- Screening status + issue/expiry date on staff (self-report + admin verify; provider integration later)
- Gate staff/coach team assignment on a valid, non-expired check (warn/block per club policy)
- Expiry reminders

## Acceptance
- A coach without a valid check is flagged (or blocked) on assignment
- Club can see each staffer's screening status + expiry

## Dependencies
none

## Refs
[[invitation-continuity]] · [[requirements-map]] · [[coverage-audit]] · [[_moc-compliance]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-compliance]]
