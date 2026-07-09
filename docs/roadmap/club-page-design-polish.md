---
updated: 2026-07-08
status: shipped
tier: 1
area: content-ux
effort: M
source: owner
tags: [theme/content-ux, type/plan, status/shipped]
---

# 🎨 Club/league page — visual design polish (UI/UX audit)

**Tier 1 · effort M · from owner · ✅ SHIPPED 2026-07-08 (scope (a): club/league-page-only, LOCAL/UNPUSHED).**
The customizable pages were functionally complete but visually flat. This redesign carries
each org's brand color through the page, adds athletic condensed type, and gives the blocks
hierarchy + variety. Grounded in the ui-ux-pro-max skill (Vibrant & Block-based / Barlow Condensed).

## ✅ What shipped (2026-07-08)
- **Dynamic brand-carry engine** — `apps/web/src/lib/club-page/brand.ts` derives accessible tokens
  from one `primaryColor` hex (WCAG-safe `ink` darkened to ≥4.5:1 on white, `on` for text on fills,
  soft/softer/line tints), exposed as `--brand*` CSS vars via `brandStyle()` on the page wrapper.
  Blocks read them through static Tailwind classes → the club's color flows through section bars,
  links, prices, badges, monograms, active sub-nav, and tinted bands. Verified per-org: Toronto Lords
  (maroon), NPH Summer League (teal), North Toronto Huskies (purple) all render distinctly.
- **Athletic typography (page-scoped)** — Barlow Condensed (headings) + Barlow (body) loaded in
  `layout.tsx` as `--font-condensed`/`--font-barlow`, wired as `font-condensed`/`font-barlow` in
  the Tailwind config. Applied ONLY on the club/league pages (`font-barlow` wrapper + condensed
  headers) — app-global fonts (Outfit/Work Sans) untouched. Big uppercase condensed hero H1 + a
  consistent condensed brand-accent-bar section header.
- **Hero upgrade** — richer diagonal scrim + soft geometric accent, overlap-scale logo, gold
  primary CTA ("View programs"), and a quick-stats strip (Teams · Open programs · Next game · Rating).
- **Block variety** — Programs = colored brand-tint **band** w/ green "Registering" pills + green
  FREE prices; Teams = **chip grid** with brand monograms; News = **featured-first** cover layout;
  Schedule = score pills + LIVE badge; branded rail widgets (Next game, Contact w/ SVG icons, At-a-glance).
- **Scroll-spy sub-nav** (`club-subnav.tsx`, client) — highlights the in-view section in brand color.
- **"Edit page" affordance** — owner/manager/admin-gated pill on both public heros →
  `/clubs/[id]/customize` and `/manage/leagues/[id]/customize`.
- **League page** — condensed hero + stat strip + status pills (gold "Season underway" / green
  "Registration open") + brand-carried register CTA & fee + edit button. (Kept its multi-accent
  SectionHeaders for block variety; the shared `SectionHeader` component was left untouched.)
- **Accessibility kept** — brand-ink ≥4.5:1, `.brand-focus` visible rings, `prefers-reduced-motion`
  guards (card-lift + smooth-scroll), SVG icons (no emoji), verified responsive at 390/1440.

**Files:** `lib/club-page/brand.ts` (new), `(public)/club/[slug]/{page,club-blocks,club-subnav}.tsx`,
`(public)/league/[id]/page.tsx`, `app/layout.tsx`, `tailwind.config.ts`, `globals.css`.
Typecheck (no new errors) + lint clean; driven in-browser (3 orgs, desktop + mobile).

## ⏭️ Follow-ups (not done)
- **Scope (b) — app-wide design-system refresh** (fonts/tokens/component pass, incl. condensing the
  shared `SectionHeader`) is still open; this was the contained club/league-only pass.
- Demo tip: **Toronto Lords has 0 open programs**, so its colored programs band + gold hero CTA don't
  render — add a tryout/camp to it before recording, or demo the band on North Toronto Huskies.

## Original brief (below) — grounding for the above

## The problem (owner + audit, verified in code)
- **Brand color used 0× in page content** — the club's `primaryColor` only appears in
  the hero; everything below is default ink/hoop, so *every club looks identical*.
- **11 identical white `<Card>`s stacked** — no hierarchy, rhythm, or variety → reads "simple/flat."
- **All-dark typography** (17 `text-ink-950/900/800/700` refs) — no color, weight, or scale hierarchy.
- **Generic fonts** — Outfit + Work Sans; not athletic. No display treatment.
- **No "Edit page" affordance on the public page** — owners can't find the editor
  (it's a tab under `/clubs/[id]` → "Customize page"; unintuitive).

## Recommended direction (ui-ux-pro-max: "youth sports club page")
- **Style:** *Vibrant & Block-based* — bold, energetic, high color contrast, block layout, duotone/geometric accents, large type, bold hover.
- **Typography:** athletic/condensed headings — **Barlow Condensed** (headings) + **Barlow** (body). Establish a scale: hero H1 40–48px, section H2 24–28px; vary weight + tracking; color the headings.
- **Color:** warm, brand-forward. **Carry the club's brand color through the page** (section accents, links, active states, price, block backgrounds at ~8% tint). Gold CTA. **Activity green** for open/live/registration-open badges.
- **Layout:** large section gaps (48px+), a quick-stats strip under the hero, differentiated blocks (colored programs band, team grid with color chips, featured news w/ imagery), alternating section treatments.
- **Effects:** bold hover (color shift), 200–300ms transitions, scroll-snap optional.

## Redesign checklist (next session)
1. **"Edit page" button on the public hero** for owners/managers → `/clubs/[id]/customize` (+ a "Manage club" entry from the dashboard). *(quick, high value)*
2. **Carry brand color** into blocks: section header accent (bar/underline in brand), links/prices in accent, active sub-nav in brand, ~8% brand tint on select block backgrounds.
3. **Hero upgrade**: overlap logo, richer gradient, CTA hierarchy (primary gold), a quick-stats strip (teams · players · next game).
4. **Typography**: introduce a condensed display face for headings + a real type scale + heading color. *(Font swap is app-global — decide club-page-only vs broader refresh, see below.)*
5. **Block variety**: programs as a colored band; teams as a chip grid; news with cover imagery (already have media); differentiate rail widgets.
6. **Hover/interaction energy**: color-shift hovers, cursor-pointer (present), 200–300ms.
7. Apply the same to the **league** hero/page.

## Keep (accessibility — from the skill)
4.5:1 contrast (brand color for accents/large text only; keep body dark on light), visible focus rings, `prefers-reduced-motion`, 44px touch targets, responsive at 375/768/1024/1440, SVG icons (not emoji).

## Scope decision for the owner (next session)
- The **font change is app-global** (affects every page), so choose: **(a)** club/league-page-only polish (color-carry + layout + hero + edit-button — contained, fast), or **(b)** a broader **design-system refresh** (fonts + tokens + component pass across the app — bigger, but lifts everything for demos). Recommend starting with (a) for the demo, then (b) as a separate track.

## Refs
[[customizable-pages]] · [[design-strategy]] · [[ux-audit-2026-07-06]] · [[_moc-content-ux]] · [[requirements-map]]

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-content-ux]]
