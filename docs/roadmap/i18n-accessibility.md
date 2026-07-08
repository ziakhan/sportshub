---
updated: 2026-07-08
status: planned
tier: 2
area: platform
effort: L
source: layer2
tags: [theme/platform, type/plan, status/planned]
---

# 🌐 Bilingual FR-CA + AODA/WCAG accessibility

**Tier 2 · effort L · from layer2.** Ontario LAW (AODA) plus a bilingual-Canada expectation; currently zero i18n and only cosmetic a11y. Gets harder to retrofit the longer we wait.

## Problem
No i18n framework; only 4 role= / 7 alt= across the app; no jsx-a11y lint.

## Scope
- i18n framework (next-intl) + FR-CA translations of core flows
- Accessibility pass to WCAG 2.1 AA (roles, alt text, focus, contrast) + add jsx-a11y lint
- Language switcher

## Acceptance
- Core public + family flows available in French
- Key pages pass automated a11y checks

## Dependencies
none

## Refs
[[design-strategy]] · [[requirements-map]] · [[coverage-audit]] · [[_moc-platform]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-platform]]
