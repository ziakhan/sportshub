---
updated: 2026-07-08
status: draft
tier: 2
area: identity
effort: L
source: owner
tags: [theme/identity, type/plan, status/draft]
---

# 🎨 Customizable club/league pages ("your website")

**Tier 2 · effort L · from owner · DRAFT (rough plan; detail later).** Let a club or
league run its SportsHub page like a real website — the Facebook-Page-for-business
idea. Many clubs can't afford a site; the platform becomes it, powered by data we
already hold (stats, schedule, tryouts).

## Problem
The public club page (`/club/[slug]`) is fixed and lightly branded (only
`primaryColor`, write-once logo). Clubs/leagues can't shape it into a presentable
"home on the web," so they undervalue the platform and go build sites elsewhere.

## Scope (rough)
- **Branding**: hero/banner image, logo (uploadable — see the branding gap in
  [[coverage-audit]]), primary/secondary/accent colors, tagline. Extends `TenantBranding`.
- **Content blocks** (arrangeable): announcements (scrolling/rotating), upcoming
  tryouts/camps/programs rail, featured teams + live stats/standings, photos/recaps,
  custom links (register, socials), contact.
- **Auto-pulled data**: schedule, scores, standings, leaders, open programs — no
  manual upkeep; it stays live because it's the same platform data.
- **League variant**: same builder scoped to a league (divisions, standings, schedule, teams).
- Served at the entity's [[handles-identity|@handle]] (and existing slug/subdomain).

## Acceptance (rough)
- A club can set a hero + colors + logo and add/reorder announcement + program blocks.
- The public page renders the customized layout with live data and looks like "their site."

## Dependencies
[[handles-identity]] (address) · club logo-upload + branding-edit gap (from [[coverage-audit]]).
Competitor context: Jersey Watch / SportsEngine / PlayMetrics sell website builders.

## Open questions (for the detailed plan)
- How much layout freedom (fixed sections vs. free blocks vs. templates)? Themes?
- Moderation of custom content? Custom-domain tie-in for premium?

## Refs
[[handles-identity]] · [[player-profile-privacy]] · [[_moc-identity]] · [[requirements-map]] · [[coverage-audit]] · [[design-strategy]] · [[_moc-content-ux]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-identity]]
