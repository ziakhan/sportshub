---
updated: 2026-07-11
status: in-progress
tier: 1
area: platform
effort: L
source: owner
tags: [theme/platform, type/plan, status/in-progress]
---

# 📱 Responsive design concept — phone web vs desktop vs native

> **✅ WAVE 1 SHIPPED overnight 2026-07-11 (owner-approved, 5 independent commits — revert any
> subset):** `cbccfba` nav one-owner-per-level (sidebar workspaces de-duped, club tabs → scroll
> pills w/ edge fade) · `9b24ad5` camp/tournament forms single-column on phones · `70513d4`
> StandingsTable + team player-stats sticky identity column + in-card scroll (GB/STRK no longer
> dropped) · `a94bc3c` tryout/camp/HL signups → phone cards w/ tap-open detail · `81bca7f`
> customize editor ▲▼ touch reorder (drag stays desktop). Plus `f268742` TeamSnap agenda
> (Shape 0). Verified 16/16 live checks at 390px + desktop
> (`scripts/demo/verify-responsive-batch.mjs`). Concept mocks: the artifact page from
> 2026-07-11. Remaining offenders land opportunistically per the rules below.

**Owner direction (2026-07-11):** many views don't render well in a phone
browser. This is the CONCEPT (not a page audit): how views should adapt,
and how native stays crisp. Rule zero everywhere: **a page never scrolls
horizontally — content reshapes instead.**

## The four shapes every view falls into

1. **Temporal lists** (calendars, schedules, feeds) → agenda-first.
   Phone = the TeamSnap-style `AgendaList` (sticky month, date rail,
   scroll-to-today); desktop may ADD a grid/board projection, never
   instead. Grid simply doesn't exist below `sm` (shipped 2026-07-11).
2. **Tables** (registrants, rosters, standings, payments) → two honest
   modes, chosen per table: **(a) card-ify** — each row becomes a stacked
   card with the 2–3 fields that matter and a detail popover for the rest
   (right for registrants/rosters, where rows are people); **(b) contained
   scroll** — keep the table for truly numeric grids (standings, box
   scores) but scroll it inside its own card with a sticky first column,
   never the page. ESPN-bar rule stays: desktop shows all columns.
3. **Consoles** (scoring, customize editor, admin) → purpose-built
   layouts per form factor, not squeezed ones. The scoring console
   already does this right (thumb-zone action pad, width AND height
   media queries) — it's the house pattern for any future console.
4. **Forms & detail pages** → single column below `sm`, `sm:grid-cols-2`
   up; primary action full-width bottom on phones. Mostly already true.

## Working rules (apply as pages get touched — no big-bang audit)

- Phone-first Tailwind: base styles are the phone layout, `sm:`/`lg:`
  add width. A `min-w-[…]` is a smell unless inside rule 2b's container.
- One primary action per row on phones; secondary actions live in the
  row's popover/sheet (ItemPopover is the shipped primitive).
- Sticky context beats headers: month label, team name, section — small
  sticky strips (like AgendaList's month bar) keep orientation on phones.
- Fix offenders opportunistically (the page you're already editing), and
  smoke every new page at 390×844 (`document.scrollWidth === innerWidth`
  is the check in `scripts/demo/verify-*`).
- Known conceptual offenders to hit when their features come up next:
  registrants/signups tables → card-ify; standings/leaders → contained
  scroll + sticky column; league scheduler surfaces → desktop-only tools
  with a phone read-view.

## Native (Expo app, M4)

Native never inherits web layouts — every surface is a purpose-built RN
screen consuming the same APIs (bearer auth), which is why the web can
stay imperfect on phones without blocking the app:

- **Lists all the way down**: FlatList/SectionList with virtualization —
  agenda = SectionList with sticky month headers (the exact TeamSnap
  pattern, natively free), scores, chat, offers already follow this.
- **No horizontal scroll by construction**: RN screens are built at
  device width with flex; the only sideways motion allowed is a
  deliberate carousel/tab swipe.
- **Safe areas + thumb zone**: react-native-safe-area-context on every
  screen; primary actions bottom-anchored; tab bar is the nav.
- **Shared design tokens**: the app's theme mirrors the Tailwind palette
  (ink/court/hoop/play) + spacing scale so web and native read as one
  product; RsvpControl's ✓/?/✕ colors carry over 1:1.
- **My Calendar in the app**: a Calendar tab reusing `/api/calendar/mine`
  verbatim (lenses → native filter chips; RSVP → same PUT) — queued with
  the M4 leftovers.
- **The one webview exception**: the scoring console (already decided) —
  it's a dense landscape tool; wrap, don't rebuild, until usage demands.

## Refs
[[my-calendar-plan]] · [[design-system-elevation]] · `docs/roadmap/native-app-execution-plan.md`
