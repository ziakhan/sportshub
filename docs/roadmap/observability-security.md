---
updated: 2026-07-08
status: planned
tier: 2
area: platform
effort: M
source: layer2
tags: [theme/platform, type/plan, status/planned]
---

# 🔭 Sentry + rate limiting + MFA

**Tier 2 · effort M · from layer2.** SaaS ops/liability baseline for a product handling minors' data + real payments — all three absent today.

## Problem
No error tracking, no rate limiting on public endpoints, no MFA for admin/money accounts.

## Scope
- Error + performance monitoring (Sentry / web-vitals)
- Rate limiting on signup/review/chat/auth endpoints
- MFA/2FA for PlatformAdmin + payment-capable accounts
- Session maxAge/rotation

## Acceptance
- Prod errors are captured and alertable
- Abusive request rates are throttled
- Admins can enable 2FA

## Dependencies
none

## Refs
[[architecture-review]] · [[requirements-map]] · [[coverage-audit]] · [[_moc-platform]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-platform]]
