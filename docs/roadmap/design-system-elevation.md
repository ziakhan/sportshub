---
updated: 2026-07-09
status: in-progress
tier: 1
area: platform
effort: XL
source: owner
tags: [theme/platform, type/plan, status/in-progress]
---

# ✨ App-wide design-system elevation ("make the app look like the demos")

**Tier 1 · effort XL · owner-directed · IN PROGRESS.**
The owner loves the look of the interactive pitch demos (responsiveness, animation, buttons +
their transitions, colors, tick marks) and wants the **whole app** to look and feel that way.
This is the app-wide design-system refresh (previously flagged as "scope b").

> **⏭️ RESUME HERE for a fresh session.** Read this doc top-to-bottom, then start at
> **§4 Phase 1 (build the kit)** — it isn't built yet. The owner has approved
> **"build a kit and do the workflow sweep."** The kit must be built + verified BEFORE the
> workflow sweep (agents import it).

---

## 1. The target aesthetic (what "the demos" means)

Interactive HTML pitch demos, published as Claude Artifacts (owner-approved look):
- Parents (phone): https://claude.ai/code/artifact/a43625ae-acd1-4dc1-a0bb-d968a932b60c
- Clubs (laptop): https://claude.ai/code/artifact/b3fb679c-4858-41a5-9de5-f6b3a31680d8
- (yesterday's, owner-made) Leagues: https://claude.ai/code/artifact/d5f346a1-2bd7-4483-b891-0835580b8108 ·
  How it works: https://claude.ai/code/artifact/ae270640-34f7-4559-958e-5e2adde6a917
- Game-day (Fable-authored HTML, **not yet published** — full HTML is in the 2026-07-09 chat transcript if wanted).

The look: brand palette used confidently; **animation** (count-ups, staggered card reveals, a bar
that grows in); **buttons** with icons + **press-scale** + hover; **tick marks / status** (colored
severity dots, status pills, segmented bars); athletic **condensed** headings (Barlow Condensed);
responsive. NOTE: demos are hand-drawn mockups (idealized). The app is a real product — aim for
~90% of that feel applied *tastefully and systematically*, not maximal motion on every element.

## 2. Proof it works in the real app (already shipped this session)

- **Public club + league pages** — already elevated (Barlow Condensed, brand-carry, programs band,
  card-lift, "Registering" pills). See [[club-page-design-polish]] (shipped).
- **★ REFERENCE IMPLEMENTATION — the club dashboard** (owner said "I like what I see"):
  - `apps/web/src/app/(platform)/clubs/[id]/page.tsx` — elevated overview (stat tiles, needs-attention
    with severity dots, offer-pipeline segmented bar, quick-action buttons, staggered reveals, brand-carry).
  - `apps/web/src/app/(platform)/clubs/[id]/overview-ui.tsx` — `StatTile` + `AnimatedNumber` (count-up).
  - **Every surface in the sweep should mirror this file's patterns.**
- Motion utilities already in `apps/web/src/app/globals.css`: `@keyframes reveal` + `.reveal`,
  `@keyframes grow-x` + `.grow-x`, both guarded under `prefers-reduced-motion`.
- Brand-carry engine: `apps/web/src/lib/club-page/brand.ts` — `brandStyle(hex)` sets `--brand`,
  `--brand-on`, `--brand-ink`, `--brand-soft`, `--brand-softer`, `--brand-line` on a wrapper.

## 3. The brand rule (decided default; owner may revisit)

- **Operator surfaces** (club + league admin) → wrap in `brandStyle(orgColor)` so accent bars +
  primary buttons take the **org's brand color** (Huskies purple, Lords maroon, West teal). Owner
  liked this.
- **Global / consumer surfaces** (parent/player dashboards, app chrome) → no brand wrapper; kit
  "brand" tone falls back to the app **indigo** (see §4 default `:root` tokens). One consistent look.
- (Owner was mid-decision on uniform-vs-branded when we paused — this is the working default.)

## 4. Phase 1 — BUILD THE KIT (do this first; ~not started)

**4a. Default `--brand*` tokens on `:root`** in `globals.css` so kit "brand" tone works app-wide
even with no brand wrapper (indigo fallback). Add to `:root`:
```
--brand:#4f46e5; --brand-on:#ffffff; --brand-ink:#4338ca;
--brand-soft:#eef2ff; --brand-softer:#f5f7ff; --brand-line:#c7d2fe;
```
(Public club/league pages + operator wrappers override these via `brandStyle`.)

**4b. Build kit components in `apps/web/src/components/ui/`** (match existing conventions: `cn`
helper, barrel `index.ts`; existing `Card`, `Badge`, `SectionHeader`, `StatBlock` are there):
- `animated-number.tsx` — move `AnimatedNumber` out of `overview-ui.tsx` (count-up + rAF + safety
  setTimeout + reduced-motion; already written — just relocate).
- `stat-tile.tsx` — generalize `StatTile` from `overview-ui.tsx`. Change `icon` from a fixed registry
  to `icon?: ReactNode` (caller passes SVG) so it's reusable. Keep tones + count-up + hover-lift + reveal.
- `button.tsx` — polished action button: renders `<Link>` when `href`, else `<button>`; props
  `variant` (primary/secondary/subtle), `tone` (brand/court/hoop/play/ink), `icon?: ReactNode`, `size`;
  press-scale (`active:scale-[0.97]`), hover, focus-visible, disabled. Primary uses `bg-[var(--brand)]`
  + `text-[color:var(--brand-on)]`. (Reference: the `ActionButton` in `clubs/[id]/page.tsx`.)
- `panel-header.tsx` — compact condensed accent-bar header used inside cards/panels: a `bg-[var(--brand)]`
  bar + `font-condensed uppercase` title (reference: the section headers in `clubs/[id]/page.tsx`).
  (Distinct from the existing marketing `SectionHeader`.)
- Update `components/ui/index.ts` to export all of the above.
- Refactor the club dashboard to import from the kit (prove it; delete/re-export `overview-ui.tsx`).
- **Verify:** `cd apps/web && npx tsc --noEmit` (ignore pre-existing test errors) + `next lint --file` the kit files.

## 5. Phase 2 — WORKFLOW SWEEP (owner opted in: "do the workflow sweep")

Use the `Workflow` tool. Fan out `general-purpose` agents (they have Edit/Write), one per surface,
each: reads its file(s) + the kit + the reference dashboard, rewrites the surface to use the kit
(Button/StatTile/PanelHeader/Badge/Card + `.reveal`/`.grow-x`/count-up + the §3 brand rule),
**preserving all data, props, links, and functionality** — presentation only. Agents must NOT edit
the kit, `globals.css`, or the barrel (main agent owns those). Assign **distinct files per agent**
(no two agents share a file). After the workflow: full `tsc --noEmit` + `next lint` + spot-check
screenshots (harness in `scripts/demo/` — `node run.mjs`, or a quick Playwright shot with a cached
session), then fix any breakage.

**Target surfaces (wave 1 — discover exact files first with a quick Explore):**
- Dashboard persona sections: `apps/web/src/app/(platform)/dashboard/sections/*` (parent-section.tsx
  confirmed; find club-owner/league/staff/referee/player/admin sections).
- League management overview: `apps/web/src/app/(platform)/manage/leagues/[id]/*` + season manage page.
- High-traffic club subpage lists: teams / tryouts / offers list pages under `clubs/[id]/*`.
- Registration surfaces (mobile): the tryout/camp/house-league signup pages.
Later waves: the long tail (settings, templates, tournaments, scoring console is iPad-tuned — leave it).

## 6. Verify + ship

Typecheck + lint + drive key pages in the browser (dev: `export PATH="/usr/local/opt/node@18/bin:$PATH"
&& npm run dev`). Screenshots via `scripts/demo/` harness. Everything stays LOCAL/UNPUSHED — the
owner approves pushes per-session (see [[feedback-no-prod-push-without-approval]]).

## Refs
[[club-page-design-polish]] · [[native-mobile-platform]] · [[demo-shot-list]] · `scripts/demo/` (recorder)

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-platform]]
