# Logged-in home & landing redesign — scoping (2026-07-07, owner ask)

Owner: after logging in — especially as an established parent/staff/club
owner — the home page still spends real estate on **promotional** content
("what the platform is about", "for parents / coaches / families / league
owners", "what the club is about"). Signed-in members don't need the
pitch; they need their **content**. Maximize the real estate, drop the
marketing once someone is in. Explicitly a **separate project** from the
tutorials/demos work.

## Why this is its own project

It overlaps the long-parked **Site IA reorganization** (docs/site-ia-plan.md
— the two-worlds model, programs-vs-marketplace overlap, menu order,
Scores→Leagues). The home/landing surface is exactly where those decisions
become visible. Do them together: one pass that decides (a) what the
signed-out landing sells, and (b) what the signed-in home shows.

## Principle

**Anonymous = a pitch + a taste of live content. Signed-in = content-first,
zero pitch.** (ESPN/MaxPreps model — the moment you have favorites, the
promo rails disappear and your stuff takes the space.)

## Current state to audit (before designing)

`apps/web/src/app/(public)/page.tsx` + `home-sections.tsx` render a
density-graceful home that already personalizes by sign-in (scoreboard
strip, Your-teams rail, news/leaders rails) BUT still also carries
promotional/marketing sections (for-clubs / for-leagues style blocks, "what
the platform is"). The redesign needs a section-by-section inventory tagged
**keep-signed-in / promo-only / both**, then:
- **Signed-out**: hero pitch + audience doors (parents/clubs/leagues) + a
  live-content taste (real scores/news) so it's not all marketing.
- **Signed-in (has teams/role)**: lead with Your-teams, next games,
  unread chat/polls, schedule, followed leaders/standings, news for your
  world. Cut every "for coaches/for families" promo block. Role-aware but
  content-first.
- **Signed-in but empty (new account, no teams yet)**: the ONE place a
  signed-in user still sees guidance — the getting-started checklist
  (from the onboarding plan), not marketing.

## Open questions for the owner (at design time)

1. One home route that swaps content by auth+role (recommended), or a
   distinct `/` (marketing) vs `/home` (app) split?
2. How much live-content taste on the signed-out landing — a real
   scoreboard strip, or static marketing only?
3. Fold in the Site IA menu decisions (Scores→Leagues, programs vs
   marketplace) in the same pass? (Recommended — same surface.)

## Status

Scoped only — NOT started. Sequenced after the current demo/tutorial work
unless the owner reprioritizes. Related: docs/site-ia-plan.md,
docs/onboarding-tutorials-plan.md (getting-started checklist is the
signed-in-empty state).
