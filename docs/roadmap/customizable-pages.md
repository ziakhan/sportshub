---
updated: 2026-07-08
status: shipped
tier: 1
area: identity
effort: L
source: owner
tags: [theme/identity, type/plan, status/shipped]
---

# 🎨 Customizable club/league pages ("your website")

**Tier 1 · effort L · from owner · ✅ SHIPPED (2026-07-08, local).** Club page fully
customizable (hero + two-zone drag-drop block editor + upload + contact + socials +
announcements); league variant = branded hero + editor. Verified end-to-end.
Turn the public club/league page
into a branded, mostly-auto "microsite" the org can shape — the Facebook-Page-for-
business idea. Lives at the existing `/club/[slug]` (and later the [[handles-identity|@handle]]);
no separate site to maintain. Demo centerpiece for the polish push.

## Concept: customize the *shell*, auto-fill the *content*
The org controls branding + a few curated blocks; everything heavy is read live from
platform data so it never goes stale — a zero-effort club still gets a rich page.

| Org customizes (editable) | Platform auto-fills (no upkeep) |
|---|---|
| Banner/hero image, logo, colors | Teams → team pages |
| Tagline **+ description paragraph** | Open programs: tryouts / camps / house leagues → register |
| **Contact info**: phone, address, email, website, socials | Schedule + recent scores of the org's teams |
| Announcements (org-posted) | News, recaps, photos, highlights |
| Which blocks show, their order + zone | Standings / leaders, reviews |
| Featured/pinned items, custom links | (league) divisions, participating clubs |

## Layout: two responsive zones + drag-and-drop (not a freeform canvas)
- **Full-width HERO** (spans both zones): banner image *or* brand-color gradient
  fallback; logo; name; tagline; **description paragraph**; primary CTAs (View programs · Follow · Contact).
- **Sticky anchor sub-nav** under the hero: Home · About · Teams · Programs · Schedule · News · Contact — smooth-scrolls to sections (one page, not sub-routes).
- **Body = Main zone (wide) + Right rail (compact).** Blocks are dragged/reordered
  within and between zones; **a block renders size-appropriately for its zone**
  (rich card in Main, tight widget in Rail). This gives "free" drag-and-drop feel
  while staying responsive-safe (no pixel canvas).
- **Mobile:** rail **stacks under** main → one smart single column; any rail widget
  can be flagged **pin-to-top-on-mobile** (e.g. "Register now" jumps up).

## Blocks (starter set)
`hero` (full) · `about/description` · `announcements` · `open-programs` · `teams` ·
`schedule-scores` · `news-recaps` · `contact` (phone/address/email/website/socials) ·
`next-game` (rail widget) · `reviews` · `socials/links` (rail). Each declares which
zone(s) it supports + a wide vs compact variant.

## Editing UX
Club owners/managers get an **"Edit page"** toggle → panel to set banner/logo/colors,
edit tagline + **description**, edit **contact info**, post announcements, toggle
block visibility, drag to reorder across zones, pin rail widgets for mobile — with
**live preview**. Everyone else sees the finished page.

## League variant
Same shell + editing; league-shaped auto sections: **Divisions & Standings · full
Schedule/Scores · Leaders · Participating clubs/teams · News · "Register your team".**

## Build phasing
- **1a (first, demoable):** editable identity — banner/hero + **logo upload** + colors
  + tagline + **description paragraph** + **contact block** (phone/address/email/website/
  socials), rendered on the public page + a settings editor. *No drag/blocks engine yet;
  fixed sensible section order.* Closes the Layer-1 branding/logo gaps.
- **1b:** two-zone responsive block renderer (Main + Rail) with per-block visibility
  toggles + mobile stacking + pin-to-top; announcements + next-game + auto blocks.
- **1c:** drag-and-drop reorder across zones + live-preview editor; league variant.
- *Later:* themes/templates, custom-domain tie-in, more block types.

## Acceptance (1a)
- A club can set banner + logo + colors + tagline + description + contact info and it renders on `/club/[slug]`.
- Contact shows phone, address, email, website, socials when provided; hidden fields don't render.

## UX guardrails (from ui-ux-pro-max)
44×44px touch targets · visible focus rings · 4.5:1 text contrast (light + dark) ·
≥16px mobile body text · alt text on hero/logo · reserve space for async blocks (no
layout jump) · `prefers-reduced-motion` on any scroll/animation · SVG icons (not
emoji) · `cursor-pointer` on interactive cards · no horizontal scroll ≤375px.

## Schema (rough)
Extend `TenantBranding` (bannerUrl, tagline, description, contactPhone, contactAddress,
contactEmail, website, socials JSON) + a `PageBlock`/page-config store (block type,
zone, order, visible, pinMobile, settings JSON) for 1b/1c. Confirm before `db push`.

## Dependencies
[[handles-identity]] (nicer URLs, optional) · reuses `TenantBranding` + name-privacy.

## Refs
[[handles-identity]] · [[player-profile-privacy]] · [[_moc-identity]] · [[requirements-map]] · [[coverage-audit]] · [[design-strategy]] · [[_moc-content-ux]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-identity]]
