---
updated: 2026-07-08
status: planned
tier: 3
area: platform
effort: L
source: layer2
tags: [theme/platform, type/plan, status/planned]
---

# 📱 Installable PWA + web push (+ SMS)

**Tier 3 · effort L · from layer2.** Every consumer incumbent (TeamSnap, GameChanger, Spond) is app-first; families live in the app. A PWA + push is the fast path to parity before a native build.

## Problem
Web-only; no manifest/service worker/push; no SMS channel.

## Scope
- Installable PWA (manifest + service worker + offline shell)
- Web push notifications (reminderPush flag exists, no delivery)
- SMS channel for critical notifications

## Acceptance
- Families can install the app to their home screen and receive push
- Critical alerts can go out via SMS

## Dependencies
privacy-pipeda-casl (consent/prefs)

## Refs
[[privacy-pipeda-casl]] · [[requirements-map]] · [[coverage-audit]] · [[_moc-platform]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-platform]]
