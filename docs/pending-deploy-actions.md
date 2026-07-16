---
updated: 2026-07-07
tags: [theme/ledgers, type/ledger, status/living]
---

# Pending Deploy Actions

Manual steps to run on production (Neon) **before** the next Vercel deploy of master. Each action lists the linked code change, the production command, and how to verify it landed.

> **2026-07-06: entries #4–#9 ALL APPLIED to Neon** (pre-checks clean — 0
> integrity violations, 0 GameEvents; single `prisma db push
> --accept-data-loss` + both `prisma/sql/2026-07-*.sql` files via
> `prisma db execute`; verified: 7 new tables, partial uniques, period
> rename, `playing_with_neon` drift table dropped). 97 commits pushed to
> master same day; production showcase seeded.

> **History:** Entries 1–3 (the 0.1.x gap deploys) all ran on 2026-05-05 ahead of commits `30d92ed` + `3a60477`. Left in this file as a worked example for future migrations.

---

> **🚀 Deploy train 2026-07-10 (owner-approved in session):** pre-checks clean
> (`current_database()=neondb`, 216 users / 188 tenants, zero new tables pre-existing) →
> one `prisma db push --accept-data-loss --skip-generate` covered runbooks **#10–#20**
> (verified: 18/18 new tables, 10/10 spot-checked columns, OfferStatus.RESCINDED,
> both Game perf indexes) → pushed **109 commits** (`b12b548..74baa84`) → Vercel auto-deploy.
> Still owner-side on Vercel: **CRON_SECRET** (crons fail closed until set), APP_TIMEZONE
> (optional), STRIPE_* prod vars + webhook, ANTHROPIC_API_KEY (recaps fall back to template).

> **🚀 Deploy train #2 same day (native-app infra, owner-approved):** pre-checks clean
> (neondb, 564 users, no new tables pre-existing) → one `prisma db push` covered runbooks
> **#21 + #23** (verified: RefreshToken + Device tables, DevicePlatform/PushProvider enums,
> User.pushQuietStart/End; 0 rows, users untouched) → pushed **10 commits**
> (`b0387be..00395e8`: M0–M4 native track) → Vercel Git-integration deploy. All realtime/push
> code ships dormant (no SIDECAR_URL/NEXT_PUBLIC_SOCKET_URL on Vercel) — site behavior
> unchanged, polling as before. Still owner-side on Vercel: **AUTH_TOKEN_SECRET** (bearer
> endpoints 401 until set; needed before the native app can point at prod). ⚠️ Found: the
> GitHub-Actions "Deploy to Vercel" workflow fails on an empty `VERCEL_TOKEN` secret and
> appears long-vestigial — real deploys ride the Vercel Git integration; delete or re-secret
> the workflow when convenient.

## ✅ 1. Backfill `OfferTemplate.tenantId` (Gap 0.1.7) — applied 2026-05-05

**Linked code change:** [apps/web/src/app/api/teams/[id]/offer-templates/route.ts](../apps/web/src/app/api/teams/[id]/offer-templates/route.ts) — POST handler now sets `tenantId: team.tenantId` on new templates.

**Why before deploy:** any existing templates created via the team route have `tenantId IS NULL`. The offer-create route (`POST /api/offers`) looks up templates with `where: { id, tenantId, isActive }`, so without backfilling, those orphan templates remain unusable. New code is unaffected if the table is already clean.

**Run order:** backfill first, then deploy. That ensures there's never a moment where new template lookups race against pre-fix data.

### Step 1 — Inspect (always run this first)

In the Neon console SQL editor, or via psql with the connection string from `MEMORY.md` (do not paste credentials in commits/logs):

```sql
SELECT
  ot."id"        AS template_id,
  ot."name",
  ot."teamId",
  t."tenantId"   AS would_set_to
FROM "OfferTemplate" ot
LEFT JOIN "Team" t ON t."id" = ot."teamId"
WHERE ot."tenantId" IS NULL;
```

Confirm every row has a non-null `would_set_to`. If any row has a null `would_set_to` (orphaned `teamId`), investigate before proceeding.

### Step 2 — Apply (transactional)

```sql
BEGIN;

UPDATE "OfferTemplate"
SET "tenantId" = (
  SELECT "tenantId" FROM "Team" WHERE "Team"."id" = "OfferTemplate"."teamId"
)
WHERE "tenantId" IS NULL;

-- Should return 0
SELECT COUNT(*) AS still_null FROM "OfferTemplate" WHERE "tenantId" IS NULL;

COMMIT;
```

If the post-check returns anything other than 0, run `ROLLBACK;` instead of `COMMIT;` and investigate.

### Step 3 — Push code

Once Neon is clean, `git push` master and let Vercel auto-deploy. Verify on the deployed app by creating a new offer template via a team, then sending an offer that references it — the offer create should succeed (it would have returned 404 "Template not found" before the fix).

---

<!-- Append future entries below as new gaps close. Keep oldest at top. -->

---

## ✅ 2. Push `Player.deletedAt` schema field (Gap 0.1.4) — applied 2026-05-05

> Note: `prisma db push` refused due to drift on the unrelated Neon onboarding table `playing_with_neon`. Applied the additive column surgically via raw `ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);` instead. The `playing_with_neon` sample table is harmless leftover and remains in the DB; drop manually if desired.


**Linked code change:** [prisma/schema.prisma](../prisma/schema.prisma) — added `deletedAt DateTime?` to the `Player` model. [apps/web/src/app/api/players/[id]/route.ts](../apps/web/src/app/api/players/[id]/route.ts) — new `DELETE` handler soft-deletes via `deletedAt`. List/detail GETs now filter `deletedAt: null`.

**Why before deploy:** the runtime DELETE handler will fail with a Prisma error if the column doesn't exist on the production schema. This is a column add (not a destructive change), so it's safe to run before the code lands.

### Step 1 — Push schema to Neon

From a shell with Neon credentials in `prisma/.env`:

```bash
export PATH="/usr/local/opt/node@18/bin:$PATH"
DATABASE_URL='postgresql://neondb_owner:npg_ZRGD4UBHPi8F@ep-soft-forest-ane71gcu-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' \
  npx prisma db push --skip-generate
```

The push should report only `Player.deletedAt` as a new column. No other drift. Reject the push if you see anything else and re-investigate.

### Step 2 — Verify

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'Player' AND column_name = 'deletedAt';
-- Expect 1 row returned
```

### Step 3 — Push code

`git push` master and let Vercel auto-deploy. The new DELETE handler immediately becomes usable. Existing rows have `deletedAt = NULL` so all previously-listed players continue to appear.

---

## ✅ 3. Push the `OfferTemplate.tenantId` and `Player.deletedAt` changes together if convenient — applied 2026-05-05

If you're running both #1 and #2 in the same session, the order doesn't matter — they're independent. Both are non-destructive.

After the schema push (#2), still run the OfferTemplate backfill SQL (#1) — that one is data-only, not schema.

---

<!-- Future entries below. Each entry: linked code change → why-before-deploy → step-by-step commands → verification → status flip ✅ when applied. -->


## ✅ 4. Schema-hardening batch — applied to Neon 2026-07-06 (architecture review WS1.5 + WS4) — July 2026

**Linked code change:** `prisma/schema.prisma` (OfferTemplate.tenantId NOT NULL,
CoachDesignation enum, TryoutSignup.playerId + uniques, Season/Team natural keys,
Game venue indexes, RefereeProfile FK, Payment.currency default) +
`prisma/sql/2026-07-authz-integrity.sql` (UserRole partial uniques + scope CHECK,
Review one-per-target). Local DB already migrated + verified.

**Run order on Neon (before deploying this code):**

### Step 1 — Pre-check (all should return 0 rows / 0 counts)
```sql
SELECT COUNT(*) FROM "OfferTemplate" WHERE "tenantId" IS NULL;
SELECT "leagueId", label, COUNT(*) FROM "Season" GROUP BY 1,2 HAVING COUNT(*)>1;
SELECT "tenantId", name, "ageGroup", season, COUNT(*) FROM "Team" GROUP BY 1,2,3,4 HAVING COUNT(*)>1;
SELECT COUNT(*) FROM "Review" WHERE num_nonnulls("tenantId","leagueId","revieweeId") <> 1;
SELECT role, COUNT(*) FROM "UserRole" WHERE NOT (
  ("gameId" IS NULL OR role IN ('Scorekeeper','Referee'))
  AND ("leagueId" IS NULL OR role IN ('LeagueOwner','LeagueManager'))
  AND ("teamId" IS NULL OR role IN ('Staff','TeamManager','Player'))
  AND ("tenantId" IS NULL OR role IN ('ClubOwner','ClubManager','Staff','TeamManager','Scorekeeper'))
) GROUP BY 1;
-- Also dedupe any NULL-porous duplicate UserRole grants before step 2:
SELECT "userId", role, "tenantId", COUNT(*) FROM "UserRole"
  WHERE "teamId" IS NULL AND "leagueId" IS NULL AND "gameId" IS NULL
  GROUP BY 1,2,3 HAVING COUNT(*)>1;
```

### Step 2 — Push schema
```bash
export PATH="/usr/local/opt/node@18/bin:$PATH"
DATABASE_URL='<neon-url>' npx prisma db push --schema=prisma/schema.prisma --skip-generate
```
Expect: OfferTemplate.tenantId NOT NULL, new CoachDesignation enum, TryoutSignup.playerId
column + uniques/indexes, Season/Team uniques, Game indexes, RefereeProfile FK.
(`playing_with_neon` sample-table drift may again require applying pieces via SQL editor —
see entry #2's precedent.)

### Step 3 — Apply the raw-SQL integrity file
Run the whole of `prisma/sql/2026-07-authz-integrity.sql` in the Neon SQL editor
(idempotent). Then `UPDATE "Payment" SET currency='CAD' WHERE currency='usd';`

### Step 4 — Push code
Deploy master. New signups begin writing `TryoutSignup.playerId`.

## ✅ 5. PlayerInvitation table (Gap G3) — applied to Neon 2026-07-06

Ships with the WS2 Wave-3 commits. Runs AFTER (or together with) entry #4 —
same `prisma db push` invocation covers both if executed at once.

### Step 1 — Push schema
```bash
export PATH="/usr/local/opt/node@18/bin:$PATH"
DATABASE_URL='<neon-url>' npx prisma db push --schema=prisma/schema.prisma --skip-generate
```
Expect: new `PlayerInvitation` table (FKs to Tenant/Team/User/OfferTemplate/Offer),
`InvitationStatus` enum gains `EXPIRED` (additive — safe), `Offer` unchanged.

### Step 2 — Apply the raw-SQL integrity file
Run `prisma/sql/2026-07-player-invitation.sql` in the Neon SQL editor (idempotent):
partial unique = one PENDING invitation per (teamId, lower(invitedEmail)).

### Step 3 — Nothing to backfill
New table; no existing rows to migrate.

## ✅ 6. Payments phase-1 schema (offline mode) — applied to Neon 2026-07-06

Ships with the payments phase-1 commit. Same `prisma db push` covers entries
#4/#5/#6 if executed together.

### Step 1 — Push schema
```bash
export PATH="/usr/local/opt/node@18/bin:$PATH"
DATABASE_URL='<neon-url>' npx prisma db push --schema=prisma/schema.prisma --skip-generate
```
Expect: new tables `PaymentConfig` + `PaymentObligation`; `Payment` gains
`obligationId`/`method`/`recordedById`/`note` and `payerId` becomes NULLABLE
(org payers); new enums `PaymentMethod`, `OnlineMode`, `ObligationStatus`.
All additive — Payment table had 0 rows.

### Step 2 — Nothing to backfill
New tables + nullable columns; no data migration.

## ✅ 7. Configurable payment policy + destination charges — applied to Neon 2026-07-06 (schema only; PaymentConfig table was empty — no inheritance conversion needed)

Ships with the payment-policy commit (platform-wide defaults, per-club
overrides, PLATFORM_COLLECT instant settlement). Same `prisma db push`
covers entries #4–#7 if executed together.

### Step 1 — Push schema
```bash
export PATH="/usr/local/opt/node@18/bin:$PATH"
DATABASE_URL='<neon-url>' npx prisma db push --schema=prisma/schema.prisma --skip-generate
```
Expect:
- `PlatformSettings` gains `payOfflineAllowed`, `payConnectAllowed`,
  `payPlatformCollectAllowed`, `payDefaultOnlineMode`, `payPlatformFeeBps`,
  `payPlatformFeeFlat` (all with defaults — additive).
- `PaymentConfig`: `offlineAllowed`/`connectAllowed`/`platformCollectAllowed`/
  `onlineMode`/`platformFeeBps`/`platformFeeFlat` become NULLABLE and lose
  their column defaults (null now means "inherit the platform policy").
- `Payment` gains nullable `stripeDestinationAccountId`.

### Step 2 — Convert existing PaymentConfig rows to inheritance (optional but recommended)
Existing rows carry the old hard defaults as explicit per-club overrides.
Null them out wherever they still equal the old defaults so those clubs
follow the platform policy going forward:
```sql
UPDATE "PaymentConfig" SET "offlineAllowed" = NULL WHERE "offlineAllowed" = true;
UPDATE "PaymentConfig" SET "connectAllowed" = NULL WHERE "connectAllowed" = true;
UPDATE "PaymentConfig" SET "platformCollectAllowed" = NULL WHERE "platformCollectAllowed" = false;
UPDATE "PaymentConfig" SET "platformFeeBps" = NULL WHERE "platformFeeBps" = 0;
UPDATE "PaymentConfig" SET "platformFeeFlat" = NULL WHERE "platformFeeFlat" = 0;
-- Keep onlineMode as-is: a club that already chose a mode keeps that choice.
```
Skip any UPDATE where the value was a deliberate per-club override (none
exist in production as of July 2026 — Stripe hasn't launched there).

### Step 3 — Nothing else to backfill
`PlatformSettings.pay*` defaults reproduce the previous hardcoded behaviour
exactly (offline on, connect allowed, platform-collect off, no fee).

## ✅ 8. Live scoring schema — applied to Neon 2026-07-06 (GameEvent had 0 rows; rename loss-free as predicted)

Ships with the live-scoring v1 commit. Same `prisma db push` covers entries
#4–#8 if executed together. GameEvent is empty in production, so the
column rename is loss-free — but push needs the flag:
```bash
export PATH="/usr/local/opt/node@18/bin:$PATH"
DATABASE_URL='<neon-url>' npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss
```
Expect:
- `GameEvent`: `quarter` → `period` (rename; table has 0 rows), plus `made`,
  `clockSeconds`, `sequence`, `clientEventId` (unique), `voided`,
  `recordedById`; `teamId` becomes nullable; new index (gameId, sequence).
- `GameEventType` enum gains LINEUP, ATTENDANCE, PERIOD_START, PERIOD_END,
  CLOCK_START, CLOCK_STOP (additive).
- `League` gains `statDepth`/`gameClockMode`/`periodType`/`periodMinutes`
  (new enums StatDepth/ClockMode/PeriodType, all defaulted — additive).
- `Game` gains nullable `scoringSessionId`/`scoringSessionUser`/
  `scoringSessionAt`, plus sign-off fields `refereeName`/`refereeSignedAt`/
  `refereeSignature` (TEXT data-URL) / `refereeVerified` (bool, default false).
- `League` also gains `requireRefereeApproval Boolean @default(false)`.
- `RefereeProfile` gains `signoffPinHash String?`.

Nothing to backfill.

## ✅ 9. Public content & follows schema — applied to Neon 2026-07-06 (enabledCountries was already ["CA"]; showcase seed run against production)

Ships with the public-site P1 commits (docs/public-site-content-plan.md).
Same `prisma db push` covers entries #4–#9 if executed together. All
additive — nothing renamed, nothing dropped:
- New tables: `Post` (kind/status enums PostKind, PostStatus; unique `slug`),
  `PostTag` (polymorphic distribution tags → team/tenant/league/game/player,
  all cascade), `Follow` (userId + one of teamId/tenantId/leagueId; partial
  compound uniques), `MediaAsset` (postId cascade; enum MediaAssetType
  IMAGE/VIDEO_EMBED/VIDEO_NATIVE — photo covers + YouTube embeds).
- New enum `MediaConsent` (UNSET/GRANTED/DENIED); `Player.mediaConsent`
  defaults UNSET (= public pages show "First L." until a parent opts in).
- `Announcement.isPublic Boolean @default(false)` + index — nothing becomes
  public retroactively.

### Post-push steps
1. **Env (Vercel, optional):** `ANTHROPIC_API_KEY` enables Claude-written
   recaps (`RECAP_AI_MODEL` overrides the default `claude-opus-4-8`).
   WITHOUT the key the deterministic template engine writes every recap —
   fully functional, no action required.
2. **Verify `PlatformSettings.enabledCountries`** on Neon is `["CA"]` — a
   stale `["US"]` row silently empties the tryout marketplace while every
   club is Canadian (UX audit GAP-013).
3. **Backfill recaps** for games completed before this ships:
   ```bash
   DATABASE_URL='<neon-url>' npx tsx scripts/backfill-recaps.ts
   ```
   Going forward, finalize auto-publishes a recap per game (re-finalize
   regenerates in place).

Nothing else to backfill.

## ✅ 10. Club GTM schema (check-in + featured + chat) — applied to Neon 2026-07-10

Ships with the club-GTM feature commits (2026-07-06). All additive —
one `prisma db push` covers everything:
- `TryoutSignup.checkedInAt DateTime?` — tryout-day roll-call timestamp
  (null = not checked in / no-show; orthogonal to `status`).
- `Tenant.isFeatured Boolean @default(false)` — paid-placement spotlight on
  discovery surfaces; admin-toggled (setFeatured action, audited).
- New table `TeamMessage` (team ↔ family chat): teamId/senderId FKs, body,
  soft-delete fields (deletedAt/deletedById), index (teamId, createdAt).
- New table `TeamChatRead` (chat v1.5 read cursors): @@id(userId, teamId),
  lastReadAt — unread badges + debounced `team_chat` bell derive from it.
- `Season.rosterChangePolicy` (enum RosterChangePolicy, default REQUEST_ONLY)
  + `Season.rosterChangeDeadline DateTime?` — roster-edit policy after lock.
- New table `RosterChangeRequest` (+ enum RosterChangeRequestStatus):
  rosterId FK cascade, requestedById/resolvedById User FKs, message/
  resolutionNote — club↔league roster change-request flow.
- Referee booking tables: `LeagueReferee` (league pool),
  `RefereeAvailability` (declared day/hour windows),
  `RefereeSessionRequest` (+ enum RefereeRequestStatus) — session-day shift
  offers, broadcast or targeted.

Nothing to backfill. Note: the same commits UNHID the Review system on
public club pages (`/club/[slug]`) — no schema change (Review table already
live), but reviews become writable by any signed-in user on deploy.

## ✅ 11. Perf-audit composite indexes — applied to Neon 2026-07-10

Ships with the perf-audit commit (2026-07-06, docs/perf-audit-2026-07-06.md).
Index-only, additive, zero data risk — one `prisma db push` covers it:
- `Game @@index([status, scheduledAt])` — scoreboard strips + /scores
- `Game @@index([seasonId, status])` — standings / leaders
- `Tenant @@index([status])` — homepage + public-nav club filters

Nothing to backfill. No client regen concerns (indexes don't change the
generated client). While in the Neon console for this: check compute
**autosuspend** — prime suspect for the "first prod load takes seconds"
symptom (see audit doc §"suspected but NOT confirmed").

## ✅ 12. Team polls & surveys schema — applied to Neon 2026-07-10

Ships with the engagement-v1 commit (2026-07-06,
docs/engagement-features-plan.md). All additive — one `prisma db push`:
- New enum `PollStatus` (OPEN, CLOSED)
- New tables `Poll`, `PollQuestion`, `PollOption`, `PollVote`
  (team-scoped; FKs cascade; PollVote unique (questionId, userId, optionId))
- Back-relations on Team (`polls`) and User (`pollsCreated`, `pollVotes`)
- (amended 2026-07-07) `TeamMessage.pollId String? @unique` (FK → Poll,
  SetNull) — quick single-question polls posted into the team chat stream

Nothing to backfill. Notification type "team_poll" is code-level only (the
Notification.type column is a plain string).

## ✅ 13. Practice scheduling schema — applied to Neon 2026-07-10 (APP_TIMEZONE env still owner-side)

Ships with the practice-scheduling commit (2026-07-06). All additive — one
`prisma db push` (expect a benign warning about the new unique constraint
on the brand-new nullable column, safe to --accept-data-loss):
- New table `PracticeSlot` (recurring pattern: teamId FK cascade,
  dayOfWeek, startTime "HH:MM", durationMinutes, location)
- `Practice.location String?` + `Practice.slotId` (FK → PracticeSlot,
  SetNull) + Practice index change (teamId → teamId,scheduledAt)
- `Team.practiceScheduleAnnouncedAt DateTime?`
- `User.calendarToken String? @unique` (personal iCal feed auth)

Also set Vercel env var **APP_TIMEZONE=America/Toronto** (slot wall-times
expand server-side; Vercel runs UTC — without it the default in code is
also America/Toronto, so this is belt-and-suspenders/documentation).
Nothing to backfill. Notification types practice_schedule/practice_change
are code-level only.

## ✅ 14. Offer package options schema — applied to Neon 2026-07-10

Ships with the offer-package-options commit (2026-07-07,
docs/offer-package-options-design.md). All additive — one `prisma db push`:
- New table `OfferOption` (offerId FK cascade, label, sourceTemplateId,
  fee/installments/practiceSessions + include-booleans, sortOrder)
- `Offer.chosenOptionId String? @unique` (FK → OfferOption) — the package
  the family picked; expect the benign new-unique-constraint warning
  (--accept-data-loss is safe, column is brand-new)

Nothing to backfill — existing offers have no option rows and behave
exactly as before (single package).

## ✅ 15. Team events schema — applied to Neon 2026-07-10

Ships with the team-events commit (2026-07-07). All additive — one
`prisma db push`:
- New enum `TeamEventStatus` (SCHEDULED, CANCELLED)
- New table `TeamEvent` (createdById FK, title/description/location,
  startAt, durationMinutes, status)
- New table `TeamEventTeam` (eventId+teamId composite PK, cascade both
  ways) — one event can sit on several team calendars
- Back-relations: Team.eventLinks, User.teamEventsCreated

Nothing to backfill. Notification type "team_event" is code-level only.

## ✅ 16. Payments v2 Stage A — card-on-file — applied to Neon 2026-07-10

Ships with the card-on-file commit (2026-07-07, payments v2 Stage A). One
additive column — `prisma db push`:
- `User.stripeCustomerId String? @unique` — the user's Stripe Customer
  (platform account) where saved cards live in Stripe's vault.

Nothing to backfill (existing users get NULL, a Customer is created lazily
on first card-add / payment). No card data is ever stored in our DB.
Prod also needs the existing `STRIPE_*` env vars (already on the deploy
train, runbook §1). Later payments-v2 stages add more schema — separate
runbook entries as they land.

## ✅ 17. Payments v2 Stages B–H schema — applied to Neon 2026-07-10 (⚠️ CRON_SECRET env var still owner-side on Vercel)

Ships with the payments v2 B–H commit (2026-07-07). Additive — one
`prisma db push`:
- `OfferOption`: `allowFullPay`, `allowInstallments`, `depositAmount`
- New `OfferInstallmentTerm` (optionId FK cascade; sequence/amount/dueDate)
- `Offer.paymentPlan` (enum PaymentPlan FULL|INSTALLMENTS)
- `Payment.stripeInvoiceId` (unique) — the auto-collect invoice per installment
- `PaymentConfig`: `reminderLeadDays` (3), `reminderEmail` (true), `reminderPush` (false)
- New enum `PaymentPlan`; new `ConnectedCustomer` (userId+accountId unique) —
  payer's Stripe customer on a club's connected account (direct-charge mode)

**Vercel env: add `CRON_SECRET`** (any strong random string). The two
`/api/cron/*` jobs fail closed without it. `vercel.json` now declares the
crons (charge-due 09:00, payment-reminders 09:30 daily) — Vercel picks them
up on deploy. Nothing to backfill.

## ✅ 18. Editability wave 2 schema — RESCINDED + invite expiry — applied to Neon 2026-07-10

Ships with the editability wave-2 commit (2026-07-09). Additive — one
`prisma db push`:
- enum `OfferStatus`: new value `RESCINDED` (club withdraws a PENDING offer)
- `StaffInvitation.expiresAt DateTime?` (lazy invite expiry; null = legacy
  rows never expire)

`vercel.json` adds a third cron: `/api/cron/expire-offers` daily 09:15
(flips stale PENDING offers past `expiresAt` to EXPIRED). Uses the existing
`CRON_SECRET` — no new env vars. Nothing to backfill.

## ✅ 19. Communications & consent schema — applied to Neon 2026-07-10

Ships with the phase-1 family-communications commit (2026-07-09). Additive —
one `prisma db push`:
- New model `CommunicationConsent` (per-org CASL consent: scope
  PLATFORM/TENANT/LEAGUE, status EXPRESS/IMPLIED/WITHDRAWN, lastEngagedAt
  window anchor; unique per user+scope+org)
- New model `MessageLog` (audit log for marketing/broadcast sends)
- New enums `ConsentScope`, `ConsentStatus`

No env vars, no backfill. Unsubscribe tokens sign with the existing
NEXTAUTH_SECRET.

## ✅ 20. Season-continuity schema — team archive + lineage — applied to Neon 2026-07-10

Ships with the phase-3 continuity commit (2026-07-09). Additive — one
`prisma db push`:
- `Team.archivedAt DateTime?` (archived teams hide from active lists, keep history)
- `Team.continuedFromId String?` + self-relation "TeamLineage" (season-instance
  lineage for the rollover wizard)

No env vars, no backfill.

## ✅ 21. Native auth (M2) — RefreshToken table — applied to Neon 2026-07-10 (⚠️ AUTH_TOKEN_SECRET env still owner-side on Vercel)

Ships with the M2 native-auth commit (2026-07-10,
`docs/roadmap/native-app-execution-plan.md`). Additive — one `prisma db push`:
- New model `RefreshToken` (userId FK cascade, `tokenHash` sha256 unique,
  `familyId` rotation lineage, `deviceLabel`, `expiresAt` 60d, `revokedAt`,
  `lastUsedAt`; indexes on userId + familyId)

**Vercel env: add `AUTH_TOKEN_SECRET`** (strong random string, e.g.
`openssl rand -base64 32`). Signs the 15-min bearer access JWTs
(`POST /api/auth/token|refresh|revoke`) and — from M1 — realtime socket
tickets. **Must be the same value on the Railway sidecar** (it verifies
socket handshakes with it). Without it, the endpoints fail closed: bearer
requests answer 401, web session auth is unaffected.

Nothing to backfill (table starts empty; rows are created on native-app
sign-in). Verify: `SELECT count(*) FROM "RefreshToken";` returns 0 and a
curl `POST /api/auth/token` with a prod account returns a token pair.

## ⬜ 22. Realtime sidecar env (M1) — no schema; gated on the Railway deploy

No DB change. The realtime seam ships dormant: without these env vars every
publish is a silent no-op and all surfaces keep their existing polling, so
this entry only matters when the sidecar goes live on Railway (owner-side
account is the blocker).

**Railway (apps/sidecar):** `PORT`, `SIDECAR_SHARED_SECRET` (strong random),
`AUTH_TOKEN_SECRET` (same value as Vercel's), `CORS_ORIGINS` (the prod web
origin), optional `REDIS_URL`.

**Vercel (add when the sidecar is live):** `SIDECAR_URL` (Railway internal/
public URL), `SIDECAR_SHARED_SECRET` (same as Railway),
`NEXT_PUBLIC_SOCKET_URL` (public sidecar URL — build-time var, needs a
redeploy to take effect).

Verify: sidecar `/healthz` 200; open `/scores` in a browser — the socket
connects (WS in devtools); score a demo game and watch it move with no
reload; stop the sidecar and confirm the site quietly falls back to polling.

## ✅ 23. Push notifications schema (M3) — Device table + quiet hours — applied to Neon 2026-07-10

Ships with the M3 push commit (2026-07-10). Additive — one `prisma db push`:
- New model `Device` (userId FK cascade, platform IOS|ANDROID, provider
  EXPO|FCM default EXPO, `token @unique`, appVersion, lastSeenAt,
  revokedAt; index on userId) + new enums `DevicePlatform`, `PushProvider`
- `User.pushQuietStart` / `User.pushQuietEnd` (String?, "HH:MM" wall time
  in APP_TIMEZONE; null = no quiet hours)

**Env (Railway sidecar, with runbook #22):** `DATABASE_URL` (pooled Neon
string — the push worker resolves devices), `APP_TIMEZONE`, `REDIS_URL`
(recommended: durable BullMQ queue + real delayed receipt checks; without
it the worker runs in-process), optional `EXPO_ACCESS_TOKEN`.

Nothing to backfill (table starts empty; the app registers devices via
`POST /api/devices` on launch). Fully dormant until the sidecar is live AND
a native build (M4) registers a device. Verify:
`SELECT count(*) FROM "Device";` = 0; a bearer-authed `POST /api/devices`
creates a row; fire a chat message and watch the sidecar log the Expo send.

## ⬜ 24. RSVP + attendance schema — EventRsvp table

Ships with the RSVP feature commit (2026-07-11, docs/feature-backlog.md
spec → shipped). Additive — one `prisma db push`:
- New model `EventRsvp` (playerId FK cascade → Player, respondedById FK
  cascade → User, soft item ref `itemType`+`itemId`, `status`, `note`;
  `@@unique([playerId, itemType, itemId])`, `@@index([itemType, itemId])`)
- New enums `RsvpStatus` (GOING|NOT_GOING|MAYBE), `RsvpItemType`
  (PRACTICE|GAME|TEAM_EVENT)

**Cron:** `vercel.json` adds `/api/cron/rsvp-reminders` (daily 9:45 UTC) —
registers automatically on deploy, but like the other three crons it fails
closed until **CRON_SECRET** is set on Vercel (already an owner to-do from
the 2026-07-10 train).

Nothing to backfill (table starts empty). Verify:
`SELECT count(*) FROM "EventRsvp";` = 0; as a parent, tap Going on a team
calendar item and the row appears; `curl -H "x-cron-secret: $CRON_SECRET"
/api/cron/rsvp-reminders` returns `{ ok: true, reminded: N }`.

## ⬜ 25. Program staff schema — ProgramStaff table (+ behavior change: program creation is admin-only)

Ships with the program-staff commit (2026-07-11, docs/roadmap/
program-staff-plan.md). Additive — one `prisma db push`:
- New model `ProgramStaff` (userId FK cascade → User, soft ref
  `programType`+`programId` into Camp/HouseLeague/Tournament,
  `designation` LEAD|ASSISTANT, `assignedById`;
  `@@unique([programType, programId, userId])`)
- New enums `ProgramType` (CAMP|HOUSE_LEAGUE|TOURNAMENT — tournament
  assignment deferred, enum reserved), `ProgramStaffDesignation`

**Behavior change riding along (no data impact):** camps/house-league
CREATION and full-edit now require ClubOwner/ClubManager — the Staff role
was dropped from those gates (owner rule 2026-07-11: coaches run teams,
not programs). Assigned program staff get manage-lite instead
(description/schedule PATCH + registrants view). Tournament creation is
now tenant-scoped for club roles (was: any club's admin, any tenantId).

Nothing to backfill. Verify: `SELECT count(*) FROM "ProgramStaff";` = 0;
as a club owner, assign a coach on a camp's edit page → bell arrives, camp
appears in the coach's "My programs"; as that coach, PATCH description
succeeds and PATCH weeklyFee 403s.

## ⬜ 26. SEO schema — PlatformSettings.seoIndexingEnabled + PublicPageView table

One `prisma db push` covers this (applied to LOCAL 2026-07-12; Neon pending —
combine with #24/#25 + Player.handle in a single push).

- `PlatformSettings.seoIndexingEnabled Boolean @default(false)` — the global
  search-engine kill-switch. **Defaults OFF**: after deploy, prod serves
  site-wide noindex + robots disallow + empty sitemap until the owner flips
  the toggle in Dashboard → Admin → Admin settings → "Search engine indexing"
  (docs/roadmap/seo-strategy.md §9 — flip at go-live, after the permanent
  domain is chosen and NEXT_PUBLIC_APP_URL points at it).
- `PublicPageView` table (+3 indexes) — first-party SEO view tracking, one
  row per public club/program page render, referrer classified
  ORGANIC/DIRECT/REFERRAL/INTERNAL/BOT. Report: Dashboard → Admin →
  "SEO traffic" (per-club 30d/7d views, organic share — the unclaimed-club
  sales number).

- **Also riding in this push (custom-domain plumbing, seo-strategy §6c):**
  `Tenant.customDomainVerifiedAt DateTime?` + `Tenant.customDomainCanonical
  Boolean @default(false)` (customDomain column already existed). All inert
  until `CUSTOM_DOMAINS_ENABLED=1` + `CUSTOM_DOMAIN_TARGET(_IP)` env are set
  and the Caddyfile on_demand_tls blocks are uncommented (oracle-box
  setup.sh has them commented in place). Club subdomains now 301 to
  /club/<slug> (was: dead header, served the homepage).

Nothing to backfill. Verify post-push: `SELECT "seoIndexingEnabled" FROM
"PlatformSettings";` = f; curl /robots.txt → `Disallow: /`; open a club page
then `SELECT count(*) FROM "PublicPageView";` ≥ 1; curl -H "Host:
<club-slug>.<domain>" https://<domain>/ → 301 to /club/<slug>.

## #27 — 2026-07-15 overnight batch (schema)
One `prisma db push` covers all (already applied to LOCAL + the box's local
Postgres deploys automatically via deploy.sh? NO — box runs its own DB; push
there too on next box deploy: `npx prisma db push` from /opt/sportshub).
Neon: pending like #24–26.
- TeamSubmissionRequest (+ enum SubmissionRequestStatus) — coach league-registration approval flow
- RosterChangeRequest.additions/removals (Json) — structured roster changes
- TeamMessage.editedAt/pinnedAt/pinnedById + MessageReaction + ChatMute — chat enrichment
- Conversation/ConversationParticipant/DirectMessage — DMs
- TeamEvent.eventType (+ enum TeamEventKind) — typed schedule events
- GameScoreInvite — guest scorekeeper links
No new env vars. New notification types: submission_request(_decided),
direct_message, roster_change_decided (code-side only).

## #28 — 2026-07-15 magic sign-in (schema)
`prisma db push` — applied to LOCAL + **BOX (2026-07-15, via deploy.sh)**. Neon pending (same push as #24–27).
- LoginToken table — magic sign-in links + 6-digit codes (hashed at rest,
  single-use, 15-min TTL, attempt-capped).
Env: none new locally; PROD SMTP_* already installed on the box (OCI Email
Delivery, 2026-07-15). Google sign-in stays dormant until GOOGLE_CLIENT_ID +
GOOGLE_CLIENT_SECRET exist (owner to create OAuth client; add to box web.env
+ local .env.local, then the Google button appears by itself).
Verify post-push: request a link from /sign-in on prod for a real account →
email lands (OCI) → link signs in; replay of the same link lands on the
"expired" panel.

## #29 — 2026-07-15 Energy Pass phase 1–3 plumbing (schema)
`prisma db push` — applied to LOCAL. Box + Neon pending.
- PlatformSettings.themePalette (String, default "hardwood") — admin-switchable
  site palette (hardwood/fastbreak/primetime; design-tokens PALETTES).
No new env vars. Admin picker: /dashboard/admin/settings → "Theme palette".
Verify post-push: flip palette in admin → game page FINAL pill + score colors
change instantly; /api/mobile/config returns `palette`.
