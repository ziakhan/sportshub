---
updated: 2026-07-19
tags: [theme/marketing, type/proposal, status/awaiting-owner]
---

# Showing the product: proposal after the walkthrough reset

Owner verdict (2026-07-19): the simulated design-system walkthroughs are
dead. Two days of iterations never got close enough to the real product,
and drawn screens will always be a step behind reality. Requirement that
remains: from the homepage, clubs, leagues and parents each reach a page
that shows the FULL capability of the system as realistically as possible.
Not only admin: content matters (parents), power matters (leagues: live
push-based scoring, recaps, scheduling, referees).

## What the research says

- Consensus for complex B2B products: show the REAL product. Device-frame
  screenshots, short UI motion, and interactive tours built from real
  captures. Illustrations/mockups are recommended only for abstract
  concepts. (Exactly the failure we hit.)
- Interactive demos convert dramatically better than static screenshots
  (Storylane cites 24% vs 3% baseline; Navattic ~3x trial lift; Arcade
  +70% booked meetings), and only ~4% of SaaS use them.
- Our competitors (TeamSnap, SportsEngine, GameChanger) rely on videos and
  book-a-demo calls. None embeds an interactive or live product experience
  on the page. Open lane.

## The proposal: show the actual product, three layers

**Layer 1 — real screenshots, automatically captured (baseline, ~1 day).**
A Playwright script signs into the seeded demo world as each persona and
captures the real screens: tryout pipeline, offer summary with sizes,
payments ledger, scheduler, standings, game page, scoring console; family
screens captured at a true iPhone viewport (390x844) so phone shots have
real proportions by construction. Persona pages return to clean, static,
benefit-led sections, each illustrated with a real capture in an honest
device frame. UI changes? Re-run the script; screenshots never drift and
nothing is ever invented.

**Layer 2 — "See it live": the real system, running (the closer, ~2-3 days).**
The platform is live with a real demo world, so stop imitating it:
- "Explore the live demo" on each persona page opens the ACTUAL app signed
  in as a read-only demo persona (parent view, club view, league view).
- Centerpiece: a PERPETUAL LIVE GAME in the demo tenant. A small bot
  replays a real game's event log on a loop, so any visitor at any moment
  watches the score flip, the play-by-play tick, and the standings move.
  Genuine websocket push, no refresh, because it is the real product.
  This sells live scoring better than any video, and no competitor has an
  answer to it.
- Guardrails: isolated demo tenant, read-only viewer accounts, nightly
  reset (seed-nph-demo already resets in ~30s), rate limits.

**Layer 3 — interactive click-through tours (optional, later).**
Arcade/Storylane-style guided flows for two or three money journeys (send
offer -> family accepts with sizes; generate a schedule). Built FROM the
Layer 1 captures, so fidelity is automatic. Could be a purchased tool
(Arcade free tier / Storylane ~$40+/mo) or DIY. Decide after 1+2 land.

## Per-persona content map (sections, each = copy + real capture)

- **/for-clubs**: tryout pipeline -> offers with sizes -> payments ledger
  and installments -> roster and staff -> team comms and practices -> club
  public page with news, recaps, reviews -> one-click league submission.
- **/for-leagues**: season and session builder -> scheduler and capacity ->
  referee assignment and confirmations -> LIVE scoring (push, gamesheets,
  guest scorekeeper links) -> standings and stat leaders -> AI recaps and
  the league news page -> playoff wizard -> fees.
- **/for-parents**: find and register -> pay by card or installments -> one
  calendar with RSVP and phone sync -> follow live from anywhere -> your
  kid's stats, recap mentions, player pages -> team chat without the
  chaos -> My Kids. Content gets equal billing with admin: scores hub,
  news, recaps are the parent-facing product.

## Cleanup
All demo/walkthrough components get deleted once the owner approves this
direction (kept in git history).

## Status
Awaiting owner call on Layers 1+2 (recommended together) and whether Layer
3 is wanted later.
