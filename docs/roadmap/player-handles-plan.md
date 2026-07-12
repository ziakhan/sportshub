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

**P2 — Posting, social sync & the content ripple (owner direction 2026-07-12):**

*The social-sync ladder (build in this order — each rung is value on its own):*
1. **Embed-by-link (no API walls):** player/creator pastes an Instagram /
   TikTok / YouTube / X URL → renders on their page via oEmbed. This IS
   "my page shows my socials" for 80% of the value and works for personal
   accounts, which the platform APIs largely don't.
2. **Share-OUT kit (the watermark flywheel):** every highlight on our
   platform is one-tap shareable/downloadable with a burned-in watermark:
   the player's `/p/handle` + platform mark. Kids post to IG/TikTok
   themselves (share-sheet intents; TikTok Share Kit) — their audience
   funnels back to the page we host. Distribution we don't pay for.
3. **True API cross-posting — creators first:** Instagram content-publishing
   and TikTok posting APIs require business/creator accounts + app review;
   X's API is paid. Videographers HAVE creator accounts → "post once,
   publish everywhere" ships for the creator tier first; personal-account
   teens keep rungs 1–2. Full two-way sync of a minor's personal feed is
   also a moderation liability we don't want — **curated, not mirrored**:
   they choose what appears on their page.

*The ripple (plumbing already exists — MediaAsset, PostTag, team/league/news
surfaces):* a highlight tagged (player, club/team, game) fans out: player
page → team hub → league hub → /news. Policy reconciling the owner's
org-vetted-creators decision (content plan §0): **kid posts live on their
OWN page** (plus team page with coach approval); **vetted-creator posts
ripple all the way up** to league/news. League reels become sponsor
inventory (raises the League Media tier's value).

*Engagement loops:* auto-generated shareable "moment cards" from verified
stats (career high, tournament win — data already flows); "you were tagged
in a recap — share it" notifications; weekly league Top-10 plays assembled
from creator + AI-camera clips.

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
- Free page includes: tagged-in creator content, up to **3 pinned
  embeds/highlights**, watermarked share-outs (the watermark is our ad).
- **Player Pro $19.99/mo or $149/yr** (page control/theming, unlimited
  embeds + film room, watermark-free or custom-watermark downloads,
  cross-post tools, pinned mixtapes, who-viewed later). Club-bundled
  wholesale $99/yr via obligation engine (the SportsRecruits channel
  lesson).
- **Creator tier (videographers/photographers):** free tagging + portfolio
  page (they are a GTM channel — they bring audiences); **Creator Pro
  ~$19/mo** (API cross-posting, analytics, booking/lead surface) +
  **marketplace 70/30** on paid mixtape/photo packages sold through us
  (owner's P4 paid-syndication direction).
- Recruiter seats (P3): $299–499/yr per verified recruiter — they pay for
  organized, verified, filterable talent; families never pay for exposure
  itself (anti-NCSA positioning).
- Supply stays free: kids posting/tagging costs nothing — their content is
  the inventory that makes team/league pages and sponsor reels valuable.

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
