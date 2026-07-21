---
updated: 2026-07-20
tags: [theme/compliance, type/security, status/shipped-local]
---

# 🔒 Coach role-scoping security fix (2026-07-20)

> **Owner report**: logged in as Lisa Reid (coach of ONE team — Burlington Force
> Grade 10) and could see all four club teams, create tryouts, admit teams to
> leagues, and reach every admin surface. "This could be a huge security
> problem." Fixed locally (unpushed); runtime-verified against Lisa's account.

## Root cause
A coach's `Staff` UserRole carries BOTH `tenantId` and `teamId`. Every authz
check of the shape `{ tenantId, role: { in: [...,"Staff"] } }` therefore matched
a one-team coach **club-wide**. Compounded by `invitations/[id]` accept, which
minted a SECOND unscoped (`teamId: null`) tenant-level Staff row per coach.

## The rule now (lib/authz/team-scope.ts)
- **ClubOwner / ClubManager / PlatformAdmin** → club-wide (unchanged).
- **Staff / TeamManager** → only the team(s) their role rows reference by
  `teamId`. A `teamId: null` tenant row grants NO authority (just staff-pool
  membership). Helpers: `isClubAdmin`, `canActOnTeam`, `coachedTeamIds`,
  `coachedTeams`, `actorRoleAtTenant`.

## What changed
**Visibility (the loud bug):**
- `clubs/[id]/layout.tsx` — single choke point. Reads `x-pathname` (now set in
  `middleware.ts`); a non-admin may ONLY be on `/clubs/[id]/teams/<own-team>/*`
  (+ the public preview). Anything else redirects to their team dashboard (one
  team) or `/teams` (multiple). Coach tabs = their team(s) only; no club-wide
  tabs exist for them.
- `clubs/[id]/teams/[teamId]/layout.tsx` — NEW defense-in-depth: `canActOnTeam`
  → notFound. Blocks URL-hacking straight to another team.
- Nav (`nav-config.ts` + `(platform)/layout.tsx`) — staff workspace links to
  the coach's own team dashboard(s), never the club root.

**Mutation APIs locked (team-scoped or admin-only):**
- Tryout creation (`api/tryouts` POST) → **club-admin only** (owner ruling:
  fees/payments hang off it; superseded the 2026-07-07 coach-can-post call).
- Roster finalize, offers, bulk offers, player-invitations (POST + revoke),
  tryout check-in → **team-scoped** (`canActOnTeam`).
- Club announcements (blast every member+parent) → **admin only**.
- Payments: `lib/payments/authz.ts` default dropped Staff → **admin only**;
  `clubs/[id]/payments/page.tsx` now `isAdmin`-only (was Staff-visible +
  Staff-could-record-cash).
- `api/waivers/remind` → team-scoped for club staff.
- League submission was already admin-only with a coach request→approve flow
  (unchanged, correct).

**Data:** `invitations/[id]` accept no longer mints the unscoped duplicate role.
⚠️ Existing coaches already carry that stray `teamId: null` Staff row in
prod/box/local — harmless now (all checks are team-scoped or admin), but a
cleanup migration could delete them. NOT done yet (owner call).

## Verification
- Integration: seed 1135 `authz/coach-scope.int.test.ts` (8) + updated
  `tryouts/route.int.test.ts` (coach/TM now 403, owner 201). Full suite
  **334/334**, tsc + lint green.
- Runtime: `scripts/demo/verify-coach-scope.mjs` drove Lisa Reid — overview
  redirects to her team; all-teams/tryouts/offers/payments/staff/settings and a
  sibling team all blocked; own team reachable. ALL PASS.

## Tryout correction (owner clarified 2026-07-20)
Coaches CAN create tryouts **for their own team** (the initial fix over-blocked
to admin-only). Now: `POST /api/tryouts` allows admin (any/club-wide) or a
coach naming a team they coach (`canActOnTeam`); edit + publish are team-scoped
so a coach runs their own team's tryout end to end (delete stays admin-only).
The tryouts area is re-opened to coaches in the layout gate but every surface
is scoped — list + create-dropdown + `GET /api/tryouts?tenantId` +
`GET /api/teams?tenantId` all filtered to `coachedTeamIds`; `[tryoutId]` pages
guarded by their own layout.

## Fable security audit follow-up (2026-07-20) — FIXED
A Fable subagent (which fanned out to helper agents — noted for cost) swept
~90 API routes for the same bug class. Fixed:
- **CRITICAL** `lib/teams/roster-access.ts` — `canManageTeamRoster` matched a
  `teamId: null` staff-pool row, so any staff-pool member / legacy-row coach
  could add/release/re-jersey **any** team's roster. Removed the null branch.
- **HIGH** `api/obligations` GET `?tenantId` — coach read every family's owed
  amounts + payer identity + payment history. Now admin-only.
- **HIGH** `api/tournaments` POST — unscoped LeagueOwner/Manager branch + an
  attacker-controlled `tenantId` let a throwaway-league owner spoof a
  tournament as any club. Attributing to a club now requires that club's admin.
- **MED read-leaks** now scoped to coached teams: `api/offers` GET (list +
  `?teamId` + `?tenantId`), `api/offers/[id]` GET, `api/player-invitations`
  GET `?tenantId`, `api/mobile/operator` (admin-only club summary),
  `api/tryouts/[id]` GET (draft visibility was ANY tenant role incl. Player).
- **LOW** `api/venues` POST — any signed-in user could inject global venue
  records; now `canManageVenues` (operator) like its sibling routes.
Audit CLEARED as correctly scoped: program staff, referee scoring assignment,
parent/player IDOR, impersonation, chat/polls/practices/events, comms,
payment-methods, RSVP, reviews, calendar, league/season/tournament approval
routes (all derive scope from the resource).

## ✅ RESOLVED — game scoring restricted to the playing teams (owner ruling 2026-07-20)
`lib/scoring/authz.ts` `canScoreGame` now allows: platform admin · the game's
assigned **Scorekeeper** (gameId-scoped — how the LEAGUE assigns one) · the
league owner · **ClubOwner/ClubManager of either competing club** · and
**team-scoped Staff/TeamManager of the HOME or AWAY team** (head + assistant
coaches, team manager). A Staff row scoped to another team, or an unscoped
staff-pool row, no longer scores anyone else's game. This gates the whole
scoring surface (scoring/events/finalize/clock/lock + referee & scorekeeper
assignment, which all call canScoreGame). Tests: 3 new in coach-scope
(non-playing coach blocked, playing coaches allowed, admin + assigned
scorekeeper allowed, scorekeeper can't score a different game).

**Guest scorekeeper ("invite anyone" question):** the mechanism already
exists — `POST /api/games/[id]/score-invites` mints a one-time tokenized link
(no account needed) for a single game, and it's gated by `canScoreGame`, so a
playing team's coach/manager can now hand a parent in the stands a link to
keep score when no assigned scorekeeper shows. The searchable assignment pool
is limited to designated Scorekeepers (role=Scorekeeper, gameId null), NOT
every user. So "invite anyone for this one game" is supported and safe; no
standing club-wide grant is created. No change needed unless the owner wants
to further restrict who can mint guest links.

## Open (owner's call)
- Migration to delete legacy unscoped `teamId: null` Staff rows (now inert
  everywhere — all checks are team-scoped or admin).
- Coach request→approve flow for tryouts (you floated it; today a coach
  creates their own team's tryout directly, which you also asked for).
- LeagueManager under-permissioning: several season routes (playoffs, schedule
  commit/delete, divisions, sessions) check only `league.ownerId`, so a
  legitimate LeagueManager gets 403. Functional gap, not a leak — separate
  ticket.
