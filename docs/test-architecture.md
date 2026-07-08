---
theme: [testing]
type: design
status: shipped
updated: 2026-07-03
tags: [theme/testing, type/design, status/shipped]
---

# WS2 — Test & Simulation Architecture

> July 2026. The comprehensive automation design: every scenario testable, every
> edge case seedable. Grounded in the existing assets (15-phase e2e plan, 9 live
> phase runners, 41 vitest tests, seed.ts + seed-demo-data) and a code-verified
> audit of 10 edge-case behaviors. Companion to docs/architecture-review.md (WS2).

---

## 0. Goals (owner's brief)

Simulate and test **every scenario** across: player/parent signup, tryout
signups, club staffing, tryout posting, the full offer pipeline, under-supply
edges (not enough players / not enough teams), manual player adds, incomplete
states, team finalization, leagues/seasons, schedule management, venues, and
last-minute changes (cancellations, withdrawals, reschedules). Where an edge
case reveals missing product behavior, **add the functionality**, not just a test.

**Volume requirement (owner, restated 2026-07-03):** be able to simulate a
realistic deployment at scale — hundreds of clubs, thousands to tens of
thousands of players/parents, hundreds of referees, multiple leagues with
clubs participating in several at once, schedules and all. Data generation
goes **directly through the builders/APIs, never the UI**; UI-driven tests
exist to verify correctness, not to produce volume. See §3.5.

## 1. Architecture — four layers + one scenario engine

| Layer | What | Runs | Speed |
|---|---|---|---|
| **L1 Unit** | Pure logic, table-driven: scheduler, standings, jerseys, coppa, season-lock | today's CI, no DB | ms |
| **L2 Integration** | Route handlers called directly against a **real Postgres**, tx-rollback per test | CI w/ DB service | ~100ms/test |
| **L3 E2E runners** | Live HTTP + NextAuth cookies + DB read-back (the existing phase runners) | CI gate (server+DB) | minutes |
| **L4 Browser smoke** | Playwright, 5–8 journeys only (signup→onboard, marketplace, offer accept, manage tabs, public standings) | nightly/pre-release | slow |

**Scenario engine** (shared by all four + the dev/demo seeder):
composable **world builders** in `packages/test-worlds` —

```ts
const world = await buildWorld(db, {
  clubs: [{ teams: [{ ageGroup: "U14", rosterSize: 8, staff: { headCoach: true } }],
            tryouts: [{ capacity: 20, signups: 3, published: true }] }],
  leagues: [{ seasons: [{ status: "REGISTRATION",
              divisions: [{ teams: 1 }],            // ← under-supply world
              venues: [{ courts: 2, hours: "weekends" }] }] }],
  offers: { pending: 2, declined: 4, expired: 1 },
})
```

- **Deterministic**: seeded faker (fixed seed per world), no `Math.random`,
  relative dates only (no time-bomb fixtures — lesson learned).
- **Composable**: `makeParentWithChild(age)`, `makeClubWithStaff()`,
  `makeFinalizedSeason()`, `makeCommittedSchedule()` — one vocabulary from unit
  fixtures to demo data.
- **Self-namespacing**: every world gets a run-id prefix (email domain +
  slug prefix) and a `destroyWorld()` — the phase-runner idempotence pattern,
  generalized.
- The 787-line `seed-demo-data` route and `seed.ts` become thin calls into the
  same builders → demo data and test data can never drift.

## 2. Verified edge-case behaviors → product-gap register

Code-verified July 2026 (file:line evidence in the audit transcript). "🆕" =
needs product work before its scenario can pass.

| # | Edge case (owner's list) | Today's behavior | Verdict |
|---|---|---|---|
| G1 | Finalize with too few players | Any count ≥1 finalizes; **no min/max roster concept** on Team | ✅ **SHIPPED 2026-07-03** — finalize warns below 5 ACTIVE players (teams/[id]/finalize); L2 tested |
| G2 | Offer to arbitrary player | Any club can offer to **any Player in the system** (incl. other clubs'), no tryout required | ✅ **SHIPPED 2026-07-03** — kept as a recruiting feature per owner decision §6.1; offers to players ACTIVE on another club's roster write an `OFFER_CROSS_CLUB_RECRUIT` AuditLog row (actor, tenant, recruitedFrom metadata) inside the offer tx; parent notification unchanged (fires for every offer); L2 tested (offers suite, seed 1109) |
| G3 | Invite player by email (owner: "manually add players / tell them to sign up") | **No path exists** — StaffInvitation is staff-only; offers need an existing playerId | ✅ **SHIPPED 2026-07-03** — PlayerInvitation model + `/api/player-invitations` (create/list/respond/revoke); attaches at creation for existing accounts (F8) or at signup (F6/F7); accept converts into a real Offer via shared `lib/offers/create-offer.ts`; expiry + revoke (F9); L2 tested (18 cases). Neon: pending-deploy-actions entry #5 |
| G4 | Team withdraws mid-season | Status flips; **scheduled games linger untouched; no season-lock guard** | ✅ **SHIPPED 2026-07-03** — withdraw cancels FUTURE games atomically (played kept), notifies opponent clubs; locked seasons block approve/reject (409 SEASON_LOCKED), withdraw stays open; L2 tested |
| G5 | Division with 1 team | Scheduler silently drops it (games=0); finalize passes unless cross-division on | ✅ **SHIPPED 2026-07-03** — finalize preflight warns per ungrouped <2-team division; also H17: zero approved teams now BLOCKS; L2 tested |
| G6 | Same venue, two leagues, same time | **Undetected** — conflict checks are season-scoped | ❎ **DESCOPED by owner (2026-07-03)** — venues are booked by many parties outside the platform (schools, municipalities, families); the platform cannot know true availability, so guaranteeing no double-booking is not its responsibility. Leagues/clubs own availability. Future direction instead: **venue-provider marketplace** (venues onboard, publish availability, take bookings) — see backlog note in §6 |
| G7 | Unpublish tryout with signups | Signups untouched, **parents never notified** | ✅ **SHIPPED 2026-07-03** — `tryout_unpublished` fan-out to non-cancelled signups; L2 tested |
| G8 | Cancel game | Standings correctly ignore it; **no notification to either club** | ✅ **SHIPPED 2026-07-03** — `game_cancelled`/`game_rescheduled` to both clubs' owners/managers on PATCH/DELETE; L2 tested |
| G9 | Odd team count (bye) | No bye model; manifests as under-target warnings + unscheduled pairings | ✅ acceptable v1 — test the warnings; document |
| G10 | Delete child with active roster/offers | Soft-delete succeeds; ACTIVE roster spots + PENDING offers linger | ✅ **SHIPPED 2026-07-03** — 409 while on ACTIVE roster; else soft-delete + decline PENDING offers + cancel future signups; L2 tested |

## 3. The scenario catalog

Status: ✅ covered by existing runner · ☐ uncovered (needs test + world) ·
🆕 blocked on gap above. IDs are stable for tracking.

### A. Signup & identity (parents, players, COPPA)
| ID | Scenario | World | Status |
|---|---|---|---|
| A1–A13 | The 13 phase-1 scenarios (all roles, dup email, weak pw, signin/out, multi-role) | trivial | ✅ |
| A14 | Player self-signup on exactly 13th birthday (calendar boundary) | dob = today−13y | ☐ L1 (coppa.ts) + L2 |
| A15 | Player signup at 12y364d rejected | dob boundary −1d | ☐ L1 |
| A16 | Invited-first user (ClubManager) later adds child / creates league via + New | invited-user world | ☐ L3 (role-actions covers grants; add invited-first entry) |
| A17 | Signup with pending staff invite auto-attaches (multiple invites, mixed clubs) | 2 clubs invite same email | ✅ (single) / ☐ (multi) |

### B. Parent–child lifecycle
| ID | Scenario | World | Status |
|---|---|---|---|
| B1–B7 | Phase-2 set (consent, CRUD, scoping) | trivial | ✅ |
| B8 | Delete child with ACTIVE roster spot → blocked | finalized team world | 🆕 G10 |
| B9 | Delete child with PENDING offer → offer auto-declined | offer world | 🆕 G10 |
| B10 | Two children, same name, same parent (dedup by playerId not name) | 2×"Jordan Lee" | ☐ L2 (post-WS4 playerId thread) |
| B11 | Re-add child after soft-delete (name collision with deleted row) | deleted-child world | ☐ L2 |

### C. Club lifecycle & staff
| ID | Scenario | World | Status |
|---|---|---|---|
| C1–C9 | Phase-3/4 sets (claim, verify, create, CASL, invite/accept/decline/request) | — | ✅ |
| C10 | Competing claims on same club (2nd claimant while 1st pending) | 2 claimants | ☐ L2 (surfaces the club-venue-plan claims-hardening need) |
| C11 | Claim an ACTIVE club (should not be claimable) | active club | ✅ (blocked) — keep |
| C12 | Staff invite to email that already has PENDING invite (dup guard) | dup invite | ☐ L2 |
| C13 | Remove staff who holds team-scoped roles (cascade?) | staffed team | ☐ L2 |
| C14 | Invite accept binds to invited user only (wrong-account 403) | 2 users | ✅ |

### D. Tryouts
| ID | Scenario | World | Status |
|---|---|---|---|
| D1–D10 | Phase-6 set (CRUD, publish, marketplace, capacity, cancel, multi-session) | — | ✅ |
| D11 | Unpublish with signups → parents notified | signups world | 🆕 G7 |
| D12 | Signup for past-dated tryout rejected | stale tryout | ☐ L2 |
| D13 | Capacity boundary: N-1, N, N+1 concurrent signups (race) | full-1 world | ☐ L2 (11.7-style; concurrency variant) |
| D14 | Signup after child soft-deleted | deleted child | ☐ L2 |
| D15 | Zero-signup tryout → "not enough players" flow entry | empty tryout | ☐ (feeds F-series) |

### E. Offer pipeline
| ID | Scenario | World | Status |
|---|---|---|---|
| E1–E11 | Phase-7 set (templates, send, overrides, accept+gear, decline, expire-on-read, re-offer, pipeline) | — | ✅ |
| E12 | Offer to player of ANOTHER club (cross-tenant recruiting) | 2-club world | ⚠️ G2 — test current behavior + decide |
| E13 | Offer to player with no tryout signup (direct offer) | offer-only world | ✅ L2 (works on purpose; cross-club variant audited — G2) |
| E14 | Accept after team finalized (late accept) | finalized world | ☐ L2 |
| E15 | Parallel accept+decline race on same offer | — | ☐ L2 concurrency |
| E16 | Expiry boundary: accept at expiresAt ± 1s | relative-date world | ☐ L1/L2 |

### F. Under-supply: "not enough players" (owner's core ask)
| ID | Scenario | World | Status |
|---|---|---|---|
| F1 | Tryout ends with 3 signups for 10-slot team → offers to all 3 → finalize under-roster | signups:3 | 🆕 G1 (warning) — behavior test today ☐ |
| F2 | Club invites unaffiliated player by email → parent signs up → offer auto-attached | PlayerInvitation world | ✅ L2 (G3 shipped; F6–F9 covered in player-invitations suite) |
| F3 | Club re-publishes tryout / extends deadline after under-supply | stale tryout | ☐ L3 |
| F4 | Merge under-supplied team's accepted players into sibling team (offer to already-rostered player) | 2 teams | ☐ L2 |
| F5 | Finalize with exactly 1 accepted offer (floor) | 1-offer world | ✅ (allowed today) — assert warning post-G1 |

### G. Team finalization
| ID | Scenario | World | Status |
|---|---|---|---|
| G1–G5 | Phase-8 set | — | ✅ |
| G6 | Jersey allocation: all prefs collide (FCFS order verified) | crafted prefs | ☐ **L1 (assign-jerseys.ts — pure)** |
| G7 | Jersey: no prefs given → null assignment | — | ☐ L1 |
| G8 | Finalize twice (idempotence / already-expired offers) | — | ☐ L2 |
| G9 | Finalize with zero accepted offers → 400 | — | ✅ |

### H. Leagues, seasons, registration ("not enough teams")
| ID | Scenario | World | Status |
|---|---|---|---|
| H1–H14 | Phase-9/10/11/12 sets (CRUD, setup, submit, deadline, approve/reject, preflight, lock) | — | ✅ |
| H15 | Division at maxTeams: submit N+1 rejected (the untested 11.7) | full division | ☐ L2 |
| H16 | Division with 1 team: preflight warns, scheduler drops (G5) | 1-team world | 🆕 G5 |
| H17 | Season with 0 approved teams → finalize blocked | empty season | ☐ L2 |
| H18 | Cross-division SchedulingGroup: schedule + standings stay per-division (15.4) | grouped world | ☐ L2/L3 |
| H19 | Withdraw before finalize vs after finalize (lock guard) | both states | 🆕 G4 |
| H20 | Roster frozen at submit: club edits roster after → snapshot unchanged (11.8) | submitted world | ☐ L2 |

### I. Scheduling & venues
| ID | Scenario | World | Status |
|---|---|---|---|
| I1–I8 | Phase-13/14 sets (preview, commit, wipe, edit, suggestions, lock) | — | ✅ |
| I9 | **Scheduler unit battery**: odd counts/byes, unreachable gamesGuaranteed, philosophy A/B compare (13.6), slot exhaustion, cross-division pooling, home/away balance | pure inputs | ☐ **L1 (generate.ts)** |
| I10 | Double-book guard: force 2 games same court+time via PATCH (14.5) | committed world | ☐ L2 |
| I11 | Cross-season venue conflict (two leagues, one gym) | 2-league world | ❎ descoped with G6 (external bookings unknowable; owner 2026-07-03) |
| I12 | Venue with closed days / window smaller than slot | crafted hours | ☐ L1 (buildSlots) |
| I13 | Reschedule suggestions respect existing commitments | busy world | ✅ (basic) / ☐ (assert constraints) |
| I14 | DST-boundary session day (America/Toronto) | Nov world | ☐ L1 |
| I15 | Standings unit battery: multi-way ties→coin-flip determinism, DEFAULTED math, cross-division `>=` tie bug, empty division, mixed statuses (15.3) | pure inputs | ☐ **L1 (compute.ts)** |

### J. Last-minute changes (owner's "chaos" set)
| ID | Scenario | World | Status |
|---|---|---|---|
| J1 | Cancel game → both clubs notified, standings unaffected | committed world | 🆕 G8 (notify) / ✅ (standings) |
| J2 | Team withdraws mid-season → future games cancelled/forfeited, opponents notified, standings correct | in-progress world | 🆕 G4 |
| J3 | Reschedule accepted suggestion → old slot freed, no double-book | — | ☐ L2 |
| J4 | Venue lost for a date → list impacted games (bulk reschedule assist) | — | 🆕 (future; pairs with club-venue plan overrides) |
| J5 | Default/forfeit single game → standings count it (defaultedBy) | — | ☐ L2 (compute covered in I15) |
| J6 | Season COMPLETED: further edits blocked | completed world | ☐ L2 |

### K. Cross-cutting invariants (automate the C1–C10 checklist)
| ID | Check | How | Status |
|---|---|---|---|
| K1 | Session route ⇒ `force-dynamic` present | static conformance test (grep AST) | ☐ S |
| K2 | No raw `session.user.id` in mutating routes | static | ☐ S |
| K3 | No Decimal reaches JSON (responses numeric) | L2 sweep over GET routes | ☐ |
| K4 | Every security mutation writes AuditLog | L2 asserts on audit rows | ☐ |
| K5 | Notification fires per NotificationType map | L2 per event | ☐ (partially in E/J) |
| K6 | Public-path matrix (namespace × method) | L1 (exists, extend) | ✅ |
| K7 | CASL-replacement matrix: role × endpoint 403 sweep | L2 generated matrix | ☐ |

## 3.5 Simulation harness (volume worlds)

`scripts/simulate.ts` — realistic populated universes via the world builders
(Prisma-direct, no UI, no HTTP):

```
npx tsx scripts/simulate.ts --clubs 100 --families 800 --referees 40 --leagues 4
npx tsx scripts/simulate.ts --summary          # counts for the seed's namespace
npx tsx scripts/simulate.ts --wipe             # exact teardown
```

- **Realistic mode** (`createWorldContext(seed, { realistic: true })`): display
  names carry no test prefix — clubs like "Maplewood Storm Basketball Club",
  players like "Harper Carter" — so the app reads like a real deployment.
  Teardown remains exact via namespaced emails/slugs + venue-by-league-linkage.
- Every generated user's password is TestPass123!; the run prints sample
  owner/league logins.
- One namespace per `--seed` (default 7777); re-running a seed wipes and
  rebuilds it. Multiple seeds = multiple coexisting worlds.
- Measured 2026-07-03: 100 clubs / 1,377 users / 3,532 players / 460 teams /
  4 leagues / 200 multi-league submissions in **13.7s** local. Scale linearly
  with `--families`; tens of thousands of players ≈ a few minutes.
- Guard: refuses to run when DATABASE_URL looks like production (`neon|amazonaws|vercel`)
  unless `--force-remote`.

## 4. CI plan

1. ✅ `services: postgres:16` in ci.yml → `prisma db push` + integrity SQL + `buildWorld` smoke.
2. ✅ Job A (fast, every push): L1 (incl. static K1/K2 in `src/test/static-conformance.test.ts`) + L2 `integration` job.
3. ✅ Job B (`e2e-gate`, every push/PR): production build → `next start` → all 9 phase runners + role-actions. Rehearsed locally vs next start 2026-07-03: 105/0.
4. ☐ Job C (nightly): Playwright (L4) + full K-sweeps (K3 Decimal sweep, K4 audit sweep, K5 notification map, K7 role×endpoint matrix).
5. Neon branch-per-PR later if prod-parity issues appear (the `playing_with_neon`
   drift class); docker Postgres is the pragmatic start.

## 5. Build sequence

| Step | Deliverable | Size |
|---|---|---|
| 1 | **L1 pure batteries**: scheduler (I9, I12, I14), standings (I15 — pins the `>=` bug), jerseys (G6/G7), coppa (A14/A15) | M — lands in today's CI immediately |
| 2 | **packages/test-worlds**: builders + destroyWorld + seeded faker; port `makeUser` in; refactor phase-1 onto helpers | M |
| 3 | **L2 harness**: vitest + real DB (tx-rollback), first waves: D/E/H boundary + concurrency scenarios, K3/K4/K5 sweeps | L |
| 4 | **Product gaps G1–G10** (each = feature + its scenario): G7/G8 notifications (S), G10 delete-guard (S), G1 min-roster warning (S), G5 preflight warning (S), G4 withdraw cascade (M), **G3 PlayerInvitation (L — the big feature)**, G6 cross-season conflict (M — coordinates with club-venue plan), G2 decision needed | L total |
| 5 | **CI**: postgres service + L1/L2 job + phase-runner gate | M |
| 6 | Seeder unification (seed.ts + seed-demo-data → builders) + Playwright smoke | M |

Steps 1–2 first (everything else consumes them); 3–5 can interleave.

## 6. Owner decisions (2026-07-03)

1. **G2 — RESOLVED: keep cross-club offers as a recruiting feature**, with
   AuditLog entry + parent notification per offer. Tests assert it works on
   purpose.
2. **G3 expanded — PlayerInvitation covers BOTH lanes:** (a) offers to existing
   players anywhere in the system, and (b) **email invitations to people not in
   the system**: club sends invite → recipient signs up (Player 13+ or Parent,
   age-appropriate) → invitation auto-attaches after signup (same mechanism as
   the staff-invite auto-attach from gap 0.1.1) → offer flow proceeds. New edge
   scenarios: F6 invite-email signs up as parent then adds child then accepts;
   F7 invite-email signs up as 13+ player and accepts directly; F8 invite to
   email that already has an account (attach immediately); F9 invite declined /
   expired.
3. **Gap timing: interleave** — small gaps (G1, G5, G7, G8, G10) built
   immediately each WITH its test; PlayerInvitation + withdrawal cascade built
   test-first once the L2 harness exists.
4. **CI database: Docker Postgres** (postgres:16 service); Neon branches later
   only if prod-parity drift appears.
5. **G6 descoped (2026-07-03): venue double-booking is NOT the platform's
   responsibility.** Real gyms are booked by schools, municipalities, and
   families entirely outside the platform, so the system can never know true
   availability — a conflict guard would give false confidence. Leagues and
   clubs own availability, as they do today.
   **Backlog instead — venue-provider marketplace**: venue providers join the
   platform as first-class participants, publish their availability, and take
   bookings through it (at which point conflict detection becomes possible
   because the platform IS the booking system). Large feature; folds into
   docs/club-venue-architecture.md when that plan resumes. Not part of WS2.
