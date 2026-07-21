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

## Open (owner's call)
- Migration to delete legacy unscoped `teamId: null` Staff rows.
- Coach request→approve flow for tryouts (owner floated it; today coaches just
  can't create — an admin does).
- Audit other role families (LeagueManager, program staff) for the same
  tenantId-only pattern.
