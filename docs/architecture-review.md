---
updated: 2026-07-02
tags: [theme/architecture, type/design, status/shipped]
---

# Architecture Review — SportsHub

> July 2026. Five parallel deep audits (data model, API/auth, testing/seeding,
> frontend, domain logic) synthesized into committed decisions. Grounded in code
> with file:line evidence; this doc records the conclusions and the sequencing.
> Context: leagues v2 shipped and E2E-validated (95/95); Stripe + live scoring are
> the next feature tracks; the design roadmap (docs/design-strategy.md) and
> club/venue plan (docs/club-venue-architecture.md) are in flight.

---

## 0. Verdict in one paragraph

The product surface is broad and genuinely works (15 E2E phases pass against the
real stack), and the best code — the **pure scheduler** (`lib/scheduler/generate.ts`,
440 LOC) and **standings engine** (`lib/standings/compute.ts`, 290 LOC) — is real
architecture: pure, seamed from Prisma, reused (`buildSlots` powers both generation
and reschedule-suggestions). But the platform's *load-bearing guarantees* are weaker
than they look: the authorization layer that appears to exist (CASL) enforces
nothing, the audit trail that appears to exist (AuditLog model) is never written,
the two hardest algorithms have zero tests while trivial helpers are tested, and
the same logic (queries, notifications, COPPA, season lifecycle) is duplicated
2–30×. None of this blocks features today — all of it compounds, and **payments
(Stripe) should not be built on top of it as-is.**

## 1. The five findings that matter most

1. **Authorization is an illusion of structure.** `lib/permissions.ts` defines a
   full CASL matrix for 11 roles — **enforced in zero API routes**. Real authz is
   ~50 hand-rolled inline `userRole.findFirst` checks with drifting role sets. The
   `UserRole` table (the authz source of truth) is under-constrained: its unique
   constraint is null-porous (Postgres NULLs are distinct → duplicate ClubOwner
   grants insertable), and nothing prevents incoherent grants (`Scorekeeper` with a
   `leagueId`). Middleware `PUBLIC_PATHS` allowlists whole namespaces by prefix
   (`/api/seasons`, `/api/dev`…), so the middleware is no longer a safety net for
   any sub-route — one forgotten in-route check = silent exposure.
2. **Zero audit trail.** `AuditLog` model exists, is well-indexed — and has **zero
   write sites** in the entire codebase. Impersonation, claim approvals (which
   grant ClubOwner), admin edits, role switches: no trail. For a multi-tenant
   platform *with an impersonation feature*, this is the single most important gap.
3. **The test pyramid is inverted.** The scheduler and standings engines — pure,
   deterministic, the most defect-prone logic in the repo — have **0 tests**, while
   trivial helpers (public-paths, onboarding-next-step) are tested. The two test
   systems don't meet: phase runners (real HTTP + real DB, genuinely good) never
   run in CI; CI's vitest mocks Prisma entirely, so a broken query/migration/
   constraint ships green. There is no database in CI.
4. **No single source of truth on the read or write path.** No shared data layer —
   the same entity (season, club) is queried 2–3 ways with divergent
   include/Decimal handling (server components vs API routes vs public routes).
   30 inline `prisma.notification.create` calls, no service, no type registry.
   COPPA age math implemented twice, differently. Season lifecycle enforced via
   three different idioms (`isSeasonLocked`, a `"REGISTRATION"` string gate, an
   inline `["FINALIZED","IN_PROGRESS"]` array). Six status enums are duplicate
   pairs. Two parallel color vocabularies in the UI; the new component kit at 0%
   adoption.
5. **Dead surface pretending to be architecture.** 4 of 5 monorepo packages are
   vestigial or dead (`ui`, `auth` = 0 refs; `config` = 1 ref + stale Clerk keys;
   `payments` = complete Stripe Connect helpers with **zero callers**). react-query
   installed, used nowhere. An orphaned `(tenant)` route group. `getCurrentUser`
   dead in the API tier. Dormant models are *mostly fine* — they map to planned
   features (GameEvent/PlayerStat → live scoring; Practice → club-venue plan;
   RefereeProfile → officials) — but AuditLog dormancy is not fine (see #2).

## 2. Committed decisions

### WS1 — Trust & safety (do BEFORE Stripe)

| # | Decision | Rationale | Effort |
|---|---|---|---|
| 1.1 | **Build one `withAuth`/`requireRole` route wrapper; delete CASL** (`permissions.ts` + unused AbilityContext) | Centralizes ~50 inline checks; kills the decorative layer; the wrapper also applies `force-dynamic` (22 routes missing it) and the standard error envelope | L |
| 1.2 | **Make `PUBLIC_PATHS` leaf- and method-aware; gate `/api/dev` + `create-test-users` out of prod** | Namespace-prefix allowlisting silently exposes mutating sub-routes; `/api/dev` public is a live hazard | M |
| 1.3 | **Migrate the ~10 raw `session.user.id` mutating routes to `getSessionUserId()`** (reviews, claims, referee, all signups, offer-accept, team PATCH, season submit) | Impersonation writes are attributed to the admin, violating the project's own convention | M |
| 1.4 | **Wire AuditLog writes**: impersonate start/stop, claim approve/reject, role grant/revoke, admin user/club edits, dev/switch-role | Model exists; zero call sites; impersonation without audit is indefensible | M |
| 1.5 | **Harden `UserRole`**: per-role partial unique indexes (fix null-porous unique) + CHECK matrix mapping role→allowed scope columns; make `designation` an enum | It's the authorization source of truth and currently accepts duplicates and incoherent grants | M |
| 1.6 | **Standardize error envelope `{ error, code?, details? }`**, applied via the wrapper; give all 4xx a machine code (today only 3 routes have codes, and SEASON_LOCKED uses a 4th shape) | Clients can't branch on errors; unify the 4 existing conventions | M (rides on 1.1) |

### WS2 — Test foundation (start immediately; cheap)

| # | Decision | Rationale | Effort |
|---|---|---|---|
| 2.1 | **Unit-test the pure core**: `scheduler/generate.ts`, `standings/compute.ts`, `season-lock.ts` — table-driven vitest; runs in today's CI, no DB needed | 730 LOC of untested pure logic behind the most `☐` scenarios (13.6, 14.5, 15.3/15.4); highest value/hour in the repo. Also pins the `>=`-tie-counts-as-win smell in compute.ts cross-division fallback | S–M |
| 2.2 | **Extract + test the jersey allocator** (pure `assignJerseys(offers, taken)`) out of `teams/[id]/finalize` | Textbook pure algorithm trapped untested in a handler | S |
| 2.3 | **Postgres in CI + promote phase runners to a pipeline gate** (`services: postgres` → `db:push` + seed → `next start` → runners). Prefer Neon branch-per-PR later for prod parity | The only tests exercising the real stack currently run when someone remembers | M |
| 2.4 | **Shared test-factory lib** (`makeOwnerWithTeam`, `makeFinalizedSeason`, `makeCommittedSchedule`…); refactor phase-1 onto helpers | Fixtures are re-hand-rolled per phase; factories make closing the `☐` scenarios cheap | M |
| 2.5 | **Static conformance tests for C1–C3** (grep-style: session route ⇒ force-dynamic; no raw `session.user.id` in mutations; Decimal→Number on responses) | Automates the cross-cutting checklist that has never been automated; catches whole regression classes in today's CI | S |
| 2.6 | Later: **vitest integration layer against a real test DB** (call route handlers directly, rollback per test); migrate phase scenarios down; add a thin Playwright smoke (5–8 journeys) for the "Manual UI" rows | Closes the mocked-Prisma blind spot without the cost of full HTTP for everything | M–L |

### WS3 — Consolidation (kill duplication)

| # | Decision | Rationale | Effort |
|---|---|---|---|
| 3.1 | **`lib/notifications.ts`** — `notify(tx, type, {...})` + `NotificationType` union; migrate 30 call sites; fill the gaps (signups, reviews, schedule-publish don't notify today) | Worst copy-paste in the codebase; typo-prone bare string types | M |
| 3.2 | **`lib/coppa.ts`** — single `isMinor(dob)` + consent assertion | Two divergent age computations is a live compliance drift hazard | S |
| 3.3 | **Unify season lifecycle vocabulary** in `season-lock.ts` (`isSeasonLocked`, `canSubmit`, `canCommitSchedule`); adopt in submit/commit/teams routes | Three idioms today; literals silently drift | S |
| 3.4 | **`lib/queries/*` data layer** (canonical select/include + Decimal coercion per entity, consumed by BOTH server components and API routes; `get-dashboard-data.ts` is the template) | Same entity queried 2–3 ways; where Decimal-serialization bugs live | M |
| 3.5 | **Server-render the 4 client public pages** (league, tournament, camp, house-league) + `generateMetadata` | SEO/share-preview hole on exactly the pages meant to be shared; rides on 3.4 | M |
| 3.6 | **Extract `acceptOffer` domain service**; wrap finalize's offer-expiry inside its transaction (currently outside = partial-write window); audit signup/submit atomicity | Core roster-formation logic in a handler; real partial-write risk | M |
| 3.7 | **Delete dead weight**: packages `ui` + `auth`, `config` (fold constants), react-query dep (unused), `(tenant)` route group, API-tier `getCurrentUser` usage. **Keep `packages/db`. Keep `packages/payments`** — it's the substrate for the imminent Stripe track; wire it then | Surface area pretending to be architecture | S |
| 3.8 | **Decompose `seasons/[seasonId]/manage/page.tsx`** (2,046 lines, 40 useState) into per-tab components/sub-routes; consolidate sidebar/mobile-nav nav config; then run the UI-kit adoption sweep (~50–60 files) per the design roadmap | Highest single-file risk; the kit is at 0% adoption and the debt grows daily | L |

### WS4 — Schema hardening (one migration batch, carefully)

| # | Decision | Rationale | Risk |
|---|---|---|---|
| 4.1 | `OfferTemplate.tenantId` → NOT NULL (backfill exists) | Nullable tenant = cross-tenant leak class | Med |
| 4.2 | Consolidate duplicate enums (SeasonStatus≡TournamentStatus; TeamSubmissionStatus≡TournamentTeamStatus; HouseLeagueSignupStatus≡CampSignupStatus) | 26 enums where ~15 do; single lifecycle truth | Low |
| 4.3 | `TryoutSignup`: add nullable `playerId` FK, re-key `(tryoutId, playerId)`, keep name as snapshot | Mutable free-text name as key breaks the tryout→offer identity thread | Med |
| 4.4 | `Game` location chain: treat `dayVenueId`+`courtId` as canonical, add consistency guard; **add missing indexes on `Game.dayVenueId/courtId/venueId`** | Denormalized pointers can silently disagree; venue-conflict queries unindexed (matters for the venue/practice plan) | Med |
| 4.5 | Natural-key uniques: `Review(reviewer,target)`, `Season(leagueId,label)`, `Team(tenantId,name,ageGroup,season)` | Rating spam / duplicate records | Low–Med |
| 4.6 | Soft-delete strategy: add `deletedAt` to Team/Tryout/Offer; convert Tenant→Team cascade to restrict-or-soft | Today a tenant delete unrecoverably destroys the club graph — the exact history `Player.deletedAt` was added to preserve. Note the latent bug: Tenant cascade → Team delete is *Restricted* by played Games → runtime FK error mid-cascade | High (sequence last) |
| 4.7 | Enum-ify stringly-typed config: `gamePeriods`, `playoffFormat`, `tiebreakerOrder[]`, `designation` | Typos in these silently break scheduling/standings/authz | Low–Med |
| 4.8 | Keep dormant models (GameEvent/PlayerStat/Practice/SeasonTeamBlackout/RefereeProfile) — they map to planned features — but add the missing `RefereeProfile.userId` real FK; fix `Payment.currency` "usd"→"CAD" casing | Don't delete planned substrate; do fix broken integrity | Low |

## 3. Sequencing & the Stripe gate

```
now ──► WS2.1/2.2/2.5 (pure-core tests + static checks — land in current CI this week)
    ──► WS1 (auth wrapper → public-paths → session-id migration → AuditLog → UserRole)
    ──► WS2.3/2.4 (CI database + factories)          [parallel with WS1 tail]
    ──► ⛔ STRIPE GATE: do not start payments until WS1 + WS2.1–2.5 are done
    ──► Stripe track (wire packages/payments; money paths get the integration-test layer first)
    ──► WS3 (consolidation — interleave with feature work; 3.2/3.3/3.7 are quick wins anytime)
    ──► WS4 (schema batch; 4.6 last)
```

**Why the gate:** payments demand exactly the guarantees currently missing —
auditable authorization, impersonation-correct attribution, transactional
integrity, and tests that hit a real database. Building Stripe first would pour
concrete over the gaps.

## 4. What is genuinely good (protect these)

- Pure scheduler + standings with the Prisma seam in `load.ts`; `buildSlots` reuse.
- Phase-runner philosophy: real HTTP, real DB, read-back assertions, idempotent
  per-phase namespaces. Promote it; don't replace it.
- Offer snapshot-on-issue denormalization; Decimal for all money; COPPA fields.
- The e2e plan document's discipline (standalone/builds-on/exit-state per phase).
- `get-dashboard-data.ts` as the data-layer template.
- The design-system kit + tokens (adoption is the gap, not the kit).
```
