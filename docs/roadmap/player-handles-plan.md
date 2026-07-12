---
updated: 2026-07-12
status: in-progress
tier: 1
area: engagement
effort: L
source: owner
tags: [theme/engagement, type/plan, status/in-progress]
---

# 🏷️ Player handles & player-owned pages — the social/recruiting layer

**Owner direction (2026-07-12):** every kid/player gets their own handle —
marketable, controllable. The player page becomes their hub: their look &
feel, their image, their highlights — and a destination for recruiters.
Potentially the highest-ARPU consumer product on the platform ("we can
probably charge a lot of money on a monthly basis"). Owner is meeting
league executives before locking the overall business direction — this doc
captures the product plan + the questions that meeting should answer.

## Why this can out-earn the Family Pass

Market anchors ([[business-model]]): SportsRecruits Pro **$399/yr**
(family-paid, often club-bundled below retail); NCSA reported
**$1,500–$6,000+**. Both are *profile sites bolted onto nothing* — no
verified stats, no live games, no weekly content. Our player page sits on
top of real verified season data, AI recaps that already name the player,
and (soon) AI-camera highlights. A **$19.99/mo "Player Pro"** page
(~$240/yr) undercuts SportsRecruits while being categorically better —
and it's per-PLAYER, not per-family, in a market where serious rep
families already spend $2,500+/season.

## Phases

**P0 — Reserve the handle (SHIPPED with this doc, see below).** Unique
handle per player, claimable by the parent (or 13+ self), `/p/<handle>`
resolves to the player page. Land-grab mechanics: get handles claimed
early, they're free, they're identity.

**P1 — Page control (the paid tier begins here):** owner-chosen accent/
banner (reuse the club-branding pattern), featured highlight pinning,
bio/measurables (height, position, grad year), achievements, "about me,"
visibility controls. Free = the verified basics (name-per-consent, team,
stats). **Pro = control + depth** (customization, full game logs, pinned
film, downloadable highlights).

**P2 — Posting & content:** what a player can post — see content policy
below. Highlights from our media pipeline + creator uploads tagged to
them; text posts gated by age/consent; comments OFF by default.

**P3 — Recruiter hub:** verified-viewer program for coaches/recruiters
(creator/recruiter roles already in backlog), "who viewed" for Pro
subscribers (the SportsRecruits gating pattern), contact ALWAYS mediated
through parent/club — never direct DMs to minors.

## Content policy for minors (draft — safety first, it's also the moat)

- **Co-ownership:** parent owns the page for <13 (COPPA pattern we already
  enforce); 13–17 = player controls, parent retains veto + visibility
  controls; 18+ full control. Maps to existing `parentId`/`canLogin`.
- **Naming/imagery:** rides the existing `mediaConsent` gates ("First L."
  vs full name; photo/video consent) — already built and enforced.
- **CAN post:** game highlights (platform-sourced or approved uploads),
  season milestones (auto-generated cards: career high, tournament wins),
  training clips, commitments/announcements, team content re-shares.
- **CANNOT:** open comments (off by default; parent can enable
  followers-only), direct messages (none — recruiter interest routes to
  parent/club), location/school/schedule details beyond what consent
  allows, third-party ads on minor pages.
- **Moderation:** upload review queue for non-platform media (the review
  moderation queue in the backlog generalizes to this); report button;
  platform-admin takedown (exists for recaps).

## Pricing hypothesis (validate at the exec meeting)

- Handle + verified basics: **free forever** (the land grab + SEO surface).
- **Player Pro $19.99/mo or $149/yr** intro (page control, full logs,
  highlight downloads, who-viewed later). Club-bundled wholesale $99/yr
  via obligation engine (the SportsRecruits channel lesson).
- Recruiter seats (P3): $299–499/yr per verified recruiter — they pay for
  organized, verified, filterable talent; families never pay for exposure
  itself (anti-NCSA positioning).

## Open questions for the owner's league-exec meetings

1. Will operators co-market player pages as a league benefit (their brand
   on the jersey of every page) — or see them as competitive to their own
   media ambitions?
2. Is exclusivity (league content only on our pages) tradeable for the
   design-partner discount?
3. Appetite for revenue share on recruiter seats sourced through league
   showcases?
4. Volleyball timeline (affects TAM assumptions in [[business-model-scenarios]]).

⬅ [[business-model]] · [[business-model-scenarios]] · [[feature-backlog]]
