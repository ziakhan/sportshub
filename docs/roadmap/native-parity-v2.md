---
updated: 2026-07-24
status: proposed
area: native
source: owner
---
# Native parity v2 — closing the iOS/web gap (owner audit request 2026-07-24)

Audit facts: 34 mobile screens vs 146 web routes. Missing verticals: social
feed/stories, venues, waivers, trainer; POTG share = bare OS sheet vs web's
full dialog. Home: mobile misses StoriesRail, HighlightsRow, stat leaders;
/api/mobile/browse/home is a bespoke fork (as are clubs/[slug], leagues,
programs/[type]/[id], operator — 5 drift-prone endpoints; the other half
correctly reuse lib/queries). Tokens: packages/design-tokens exists but WEB
DOESN'T IMPORT IT (hand-synced copy in tailwind.config.ts); mobile has NO
typography tokens (system font ≠ web display/condensed fonts — the single
biggest "looks different" cause, and why iOS ≠ Android feel).

## Why the gap keeps reopening (honest)
1. Two hand-built UIs; web ships daily, native lags — every feature costs 2x.
2. Bespoke mobile endpoints silently drift from web logic.
3. No shared type scale/fonts → nothing can look identical even when copied.
4. Slow native verify loop (EAS) → polish skipped under deadline.

## Plan
- **P0 Foundation (1 session):** tailwind.config.ts imports design-tokens
  (kill the hand-sync); add typography tokens + load the same brand fonts in
  RN (expo-font); rewrite the 5 bespoke /api/mobile routes onto lib/queries.
- **P1 Home + social (1 session):** mobile home renders the same sections as
  web signed-in home (stories rail, highlights, leaders); native Feed tab
  (FeedCard/StoriesRail ports); full share dialog incl. instagram-stories://
  deep link (the native-only superpower).
- **P2 Screen sweep (2-3 sessions):** all 34 screens onto the shared kit
  (cards/radii/shadows/type); add venues + waiver signing; keep operator
  read-only by design.
- **P3 Guardrail:** all-platforms rule enforced via release screenshot pass
  (screens diffed against web before every OTA).

## Pixel-identical caveat (owner decision)
RN gets ~95% visual identity (same palette/type/layout). TRUE pixel-identity
across three platforms only comes from web-rendered surfaces (Capacitor/
webview hybrid) — currently banned (owner 2026-07-15 NO WEBVIEWS). If
"identical" is non-negotiable, selectively revisit for content surfaces
(feed/news/game pages); native shell keeps tabs/push/share/camera.
