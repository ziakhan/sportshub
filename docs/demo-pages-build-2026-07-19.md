# Demo pages build (2026-07-19)

Built to [[demo-brief]] (owner's verbatim instructions). Local only, not deployed.

## What shipped

Four public pages host a click-through walkthrough of a whole season, every screen
drawn from the real product:

- `/how-it-works`: the full end-to-end flow, 63 steps (58 screens + 5 chapter
  dividers), in season order with persona switches: league setup → club claims its
  page → tryouts and offers (both sides) → league entry → live season → playoffs →
  championship recap.
- `/for-leagues` (25 steps), `/for-clubs` (37 steps), `/for-parents` (18 steps):
  persona slices assembled from the same scene library, each in season order.

## How it meets the brief

- **Fidelity**: every screen was transcribed from its real product screen first.
  The verbatim inventories live in `docs/demo-inventory/` (league.md, club.md,
  parent.md, season.md): every label, placeholder, select option, button string,
  badge and empty state quoted from source. Scenes reuse the real UI kit
  (`components/ui`: Button, Card, Badge, StandingsTable, PanelHeader, StatTile).
  Nothing invented; two brief items were adjusted to product truth: tryout signup
  shows the real fee-pending notice (the fee is then paid through the real
  obligations flow on /payments, which is wired), and offer templates carry
  fee/installments/practices/included kit (no season dates exist on templates).
  No public playoff bracket page exists in the product, so playoffs are shown via
  the real operator wizard + bracket panel and the championship recap.
- **Framing**: operator screens render in a desktop browser frame at 1160px
  logical width; parent screens in a proportioned iPhone frame (390x844). Live
  scoring is a duo: console and public game page visible together (side by side
  on desktop, stacked with pan mode on phones).
- **Playback**: manual by default; the glowing control on each screen advances,
  with green-tick confirmations (real success copy where the product has it).
  Autoplay is opt-in, dwell scales with how much text is on the screen, clicking
  the demo pauses/resumes. Back link and chapter pills included. Instruction
  line always visible.
- **Data**: one consistent story from the seeded demo world: NPH Summer League
  Summer 2026 ($3,990 team fee, 4 divisions, 5 weekend sessions, 4 real venues,
  4 referees), Burlington Force Grade 10 (full 12-player roster, born 2010,
  single birth years), Maria and Jayden Thompson, $3,000/$2,700 packages with
  25% deposit + 3 monthly installments. Box score sums to the final (62-58),
  linescores and standings are internally consistent.

## Code map

- Engine: `apps/web/src/components/flow-demo/` (player.tsx, frames.tsx,
  advance.tsx, types.ts, data.ts, flows.tsx) + demo CSS at the end of
  `apps/web/src/app/globals.css`.
- Scenes: `flow-demo/scenes/` (league-setup, club-setup, tryouts, offers,
  league-entry, season, shared).
- Pages: `(public)/how-it-works`, `(public)/for-clubs`, `(public)/for-leagues`,
  `(public)/for-parents`.
- Dead code from the earlier voided approach (`components/demo/*`) deleted.

## Verification (2026-07-19, local dev server)

- All four pages load 200; all four flows walked end to end by Playwright with
  zero page errors (`scripts/demo/walk-flow-demo.mjs <route> <outDir> [--mobile]`).
- Every one of the 63 full-flow screens + end screen screenshotted and reviewed
  by eye; mobile (390px) walk of /for-parents reviewed including the duo scene.
- Autoplay verified: self-advances, click-to-pause works.
- ESLint clean; tsc clean (the only errors are stale `.next/types` refs to the
  deleted `(public)/demo` page, gone on next .next rebuild).
- Copy sweep: no em-dashes in authored copy (verbatim product strings keep
  theirs), single birth years only.

## Status

Committed locally on `wip/2026-07-09-design-demos-elevation`. NOT deployed:
production push needs the owner's explicit go (standing rule). Note the live-site
check in the brief can only happen after that deploy.
