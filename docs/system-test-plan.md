---
updated: 2026-08-21
tags: [theme/testing, type/plan, status/living]
---

# System Test Plan

Owner doctrine (2026-08-21, supersedes the manual-execution framing of `e2e-test-plan.md`):

- **Tier 1 — scenario integration tests** (`*.scenario.int.test.ts`): the matrix. Real local database, real route handlers and domain functions, multi-actor stories with volume, every ordering and edge. Fast, deterministic, run on every change. Template: `apps/web/src/app/api/clubs/[id]/tryout-pool/route.scenario.int.test.ts` (30 kids, two grades, three assignment/offer orderings).
- **Tier 2 — browser journeys** (Playwright): the wiring proof. ONE continuous journey per domain, real clicks, small numbers, screenshots. Run per feature completion and after UI changes, never as a matrix.

Legend: ✅ covered · ◐ partial (feature-level tests exist, no scenario) · ❌ gap (scenario to write).

## Actors

Anonymous visitor · Parent · Player 13+ (self-owned) · Kid under 13 (COPPA) · ClubOwner · ClubManager · Staff/Coach (HeadCoach, AssistantCoach) · Referee · LeagueOwner/Manager · PlatformAdmin.

## A. Identity and family

| # | Scenario | Tier 1 | Notes |
|---|---|---|---|
| A1 | Parent signs up, adds two kids, kids appear in one household | ◐ | family-linking.int.test.ts is feature-level |
| A2 | 13+ player self-signs, later links a guardian when a paying offer arrives (money gate) | ◐ | gate tested in offers; no end-to-end story |
| A3 | **No-stranding matrix**: share-code and email invitation crossing every state — invite sent then expires, resent, accepted after the kid already self-signed, duplicate invite, parent deletes account mid-invite. Assert NOBODY ends stranded where one side cannot accept | ❌ | owner-named priority; family-invitations.int.test.ts covers happy paths only |
| A4 | Under-13 cannot self-own; parent registers them; consent threading | ◐ | |

## B. Clubs

| # | Scenario | Tier 1 | Notes |
|---|---|---|---|
| B1 | Club self-creation → publicly visible (profile, directory, event pages) → staff invited → teams made | ◐ | publishedAt-at-birth fixed by the tryout scenario (32c4b9a); no full story test |
| B2 | Census club claimed → ACTIVE → owner customizes → visibility unchanged | ✅ | claim-v2.int.test.ts |
| B3 | Merge and undo with live data hanging off both clubs | ✅ | merge-clubs.int.test.ts |
| B4 | Staff invitation lifecycle: invite by email, accept, designation lands, removal | ◐ | route-level only |

## C. Programs and tryouts

| # | Scenario | Tier 1 | Notes |
|---|---|---|---|
| C1 | Team-posted tryout (legacy kind): post, signups, check-in, offers from signups | ✅ | tryouts suites + check-in |
| C2 | **Club tryout event, two grades one floor, three offer/assignment orderings, 10-player teams, finalize** | ✅ | route.scenario.int.test.ts — THE template |
| C3 | Camps: multi-week pricing (weeklyFee vs fullCampFee), signup, capacity | ❌ | no tests found |
| C4 | House league signup lifecycle | ❌ | |
| C5 | Parent registers same kid for overlapping programs across two clubs | ❌ | cross-club story |

## D. Offers, uniforms, jerseys, team formation

| # | Scenario | Tier 1 | Notes |
|---|---|---|---|
| D1 | Offer with package options: family picks package, chosen option overwrites snapshot | ✅ | options.int.test.ts |
| D2 | Installments: accept with deposit, schedule created, missed installment path | ◐ | installment-accept covers accept; dunning story untested |
| D3 | Uniform/shoe/tracksuit sizes at accept flow into roster row | ✅ | asserted in C2 scenario |
| D4 | Jersey preferences at accept → conflict (two kids want #23) → resolution at finalize → numbers stamped | ❌ | prefs collected; conflict-resolution story untested |
| D5 | Team finalize: roster locks, families notified once, late joiner after finalize | ◐ | teams/finalize.int.test.ts + C2 cover finalize; late-joiner edge untested |
| D6 | Rescind, expire, re-offer; waitlist when committed roster full | ◐ | TEAM_FULL tested; story untested |

## E. League intake (the owner's volume scenario — cannot be staged by hand)

| # | Scenario | Tier 1 | Notes |
|---|---|---|---|
| E1 | **League intake at volume**: 12 clubs apply to a season; league questionnaire answered per club; league approves 7, rejects 3, leaves 2 hanging; approved clubs finalize teams and submit; league approves most teams, rejects some, leaves stragglers; rosters freeze on submit; hanging clubs/teams neither block the season nor lose data; late resubmission after rejection | ❌ | THE next scenario to write; submissions/roster-versions + seasons/submit are feature-level pieces of it |
| E2 | Club-level question answers: required vs optional, edited after submission, visible to league only | ◐ | |
| E3 | Season fees: club-to-league payment on approval, refund on rejection | ❌ | payment rails tested (obligations ×4); this wiring untested |
| E4 | Roster version resubmitted after rejection; league sees diff | ✅ | roster-versions.int.test.ts |

## F. Scheduling and play

| # | Scenario | Tier 1 | Notes |
|---|---|---|---|
| F1 | Planner: venues, courts, buffers, residency, publish | ✅ | 5 planner suites |
| F2 | Schedule commit + scenarios + weekends | ✅ | |
| F3 | **Season at volume**: 40 teams, generate, one team drops mid-season, reschedule ripple, standings correct** | ❌ | pieces exist; no volume story |
| F4 | Live scoring: score, sign-off, standings update | ✅ | scoring + signoff suites |
| F5 | Playoffs: bracket from standings, upsets propagate | ✅ | playoffs.int.test.ts |
| F6 | Referee booking: request, accept, conflict (double-booked ref), payment | ◐ | referee-booking covers booking; conflict story untested |

## G. Payments

| # | Scenario | Tier 1 | Notes |
|---|---|---|---|
| G1 | Obligations, Stripe flow, webhooks, platform policy | ✅ | 4 suites + invoice-webhooks |
| G2 | Withdrawals | ✅ | withdrawals.int.test.ts |
| G3 | **Family at volume**: two kids, three programs, mixed offline/online clubs, installments + one-shot, a refund — the family ledger stays truthful | ❌ | |

## H. Tier 2 — browser journeys (one per domain, in priority order)

1. **Tryouts journey** (ready to run, slim): owner builds event with same-slot duplicate → publish → public cards → one registration per grade through the real form → sync → offer → both accept paths clicked → assign → finalize → notification in the parent's bell. 4 kids, not 30.
2. Family journey: signup, add kid, email invite crossing accounts.
3. Club journey: create club → visible publicly → invite staff → make team.
4. League intake journey: one club applies, answers questions, approved, submits team.
5. Season journey: mini-plan → publish → score one game → standings.
6. Payments journey: accept a paid offer through the real payment sheet (test keys).
7. Referee journey: request → accept → game assignment visible.

## Working rules

- Every ❌ becomes a `*.scenario.int.test.ts` in the template's style: named actors, volume where hand-staging is impossible, every ordering the story allows, asserts on notifications and public shapes, world seed registered in the harness.
- Scenarios may NOT paper over found bugs: a bug found is fixed (or filed with the owner) before the scenario merges green.
- Tier 2 journeys live in `scripts/demo/journeys/` as re-runnable scripts with screenshot trails; they are rerun after any UI change to their domain.
- This document is the ledger: update the table the moment a scenario lands, with the file path.

## Proposed order (owner to reorder)

A3 (no-stranding) → E1 (league intake volume) → D4 (jersey conflicts) → G3 (family ledger) → F3 (season volume) → C3/C4 (camps, house league) → the rest. Tier 2 journey #1 whenever the owner wants the tryouts wiring confirmed.
