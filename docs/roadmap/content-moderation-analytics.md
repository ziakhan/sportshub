---
updated: 2026-07-08
status: planned
tier: 2
area: content-ux
effort: M
source: layer1
tags: [theme/content-ux, type/plan, status/planned]
---

# 🛠️ Admin content moderation + operator analytics

**Tier 2 · effort M · from layer1.** Moderation fields exist (Review.flaggedAt, Post.status) but there's no UI to unpublish/take down; admin analytics are count tiles only.

## Problem
No moderation surface; no time-series analytics.

## Scope
- Admin moderation queue: review/unpublish reviews, news/recaps
- User-facing report/flag flow
- Operator analytics: registrations/revenue/engagement over time

## Acceptance
- An admin can take down a flagged review/post
- Operators see trend charts, not just counts

## Dependencies
none

## Refs
[[coverage-audit]] · [[requirements-map]] · [[_moc-content-ux]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-content-ux]]
