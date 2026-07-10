---
updated: 2026-07-08
status: superseded
tier: 3
area: platform
effort: L
source: layer2
tags: [theme/platform, type/plan, status/superseded]
---

# 📱 Installable PWA + web push (+ SMS)

> **❌ SUPERSEDED 2026-07-10 (owner decision):** the platform is going straight to the
> **native React Native app** with FCM push and the WebSocket realtime backbone —
> see [[native-mobile-platform]]. A PWA/web-push interim step no longer buys anything.
> Kept for reference only; the SMS notes below are the one piece worth revisiting if a
> no-smartphone audience ever materializes.

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
