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
`prisma db push` — applied to LOCAL + **BOX (2026-07-15, via deploy.sh)**. Neon pending.
- PlatformSettings.themePalette (String, default "hardwood") — admin-switchable
  site palette (hardwood/fastbreak/primetime; design-tokens PALETTES).
No new env vars. Admin picker: /dashboard/admin/settings → "Theme palette".
Verify post-push: flip palette in admin → game page FINAL pill + score colors
change instantly; /api/mobile/config returns `palette`.

## #30 — 2026-07-15 game clock per-game override (schema)
`prisma db push` — applied to LOCAL + BOX (deploy.sh). Neon pending.
- Game.clockEnabled (Boolean?, null=inherit League.gameClockMode) — the
  scorekeeper's pre-game clock choice (checklist "Run the game clock?").
Verify post-push: open a SCHEDULED game's scoring page → checklist shows the
clock question; No clock → public hero shows LIVE·Q# with no ticking clock.

## #31 — 2026-07-16 native Google sign-in (no schema)
Code only — **BOX deployed 2026-07-16 (c131643, via deploy.sh; owner-approved)**.
- POST /api/auth/token/google — verifies Google idToken (JWKS, verified email
  required, aud = web/iOS/Android client ids hardcoded from owner's GCP
  project 1011644585799), ensureGoogleUser links by email, mints the normal
  native access/refresh pair.
No schema, no new env (uses existing GOOGLE_CLIENT_ID). Neon/Vercel: rides
the eventual code sync, nothing extra.
Mobile side (same feature): @react-native-google-signin 16.1.2 + iOS URL
scheme + expo-build-properties modular-headers fix (613d679) — NEW BINARIES:
iOS TestFlight build 7, fresh Android APK. Old binaries hide the button
(guarded require), they don't crash.
Verify: POST {} → 400; garbage idToken → 401; button on device signs in and
lands on the personal home.

## #32 — 2026-07-16 web Sign in with Apple (no schema)
Code + env — **BOX deployed 2026-07-16 (1939b41, via deploy.sh; owner-approved)**.
- NextAuth AppleProvider (ES256 client-secret JWT minted from portal key
  74SRFS3C24 at module load; apple-web-auth.ts), signIn links by verified
  email via ensureAppleUser, Apple buttons on /sign-in + /sign-up.
- Cookie change (prod-wide): pkce/state/callbackUrl NextAuth cookies are
  SameSite=None on https — required for Apple's form_post callback.
New env (BOX web.env ✓ / local .env.local ✓ / Vercel PENDING): APPLE_TEAM_ID,
APPLE_KEY_ID=74SRFS3C24, APPLE_CLIENT_ID=com.ysportshub.web,
APPLE_PRIVATE_KEY_B64 (.p8 in .credentials/, gitignored — NOT re-downloadable).
Verify: /api/auth/providers includes apple; sign-in shows Apple button;
signin/apple redirect → appleid.apple.com w/ client_id com.ysportshub.web.

## #33 — 2026-07-20 waivers + e-signature phase 1 (SCHEMA)
Code + schema — **LOCAL ONLY, not deployed** (owner build go-ahead 2026-07-20;
per-push approval still required).
- Schema: `WaiverType` enum + `WaiverDocument` / `WaiverSignRequest` /
  `WaiverSignature` models + back-relations on League, Tenant, Player, Season,
  User. Additive only — plain `prisma db push`, no data loss risk.
- League flow: team-submission APPROVED → auto-emails every roster parent a
  tokenized signing link per required league waiver (30-day tokens, hashed at
  rest). Public signing page /waivers/sign/[token] (allowlisted in
  public-paths.ts along with POST /api/waivers/sign).
- Operator UI: /manage/leagues/[id]/waivers (Ontario template library),
  season Signing status page w/ re-send, /clubs/[id]/waivers.
- Tests: int suite 318/318 (+9 waivers, seed 1134).
Deploy: box `deploy.sh` + `prisma db push` on box DB (+ Neon whenever the
Neon backlog #24-30 batch goes — this rides along as #33).
Verify post-push: league manage → Waivers → add both ON templates; approve a
team with a rostered player; Mailpit/OCI shows the waiver email; sign via the
link; season Signing status flips to ✓.

## #33b — 2026-07-20 waivers in-flow signing (code only, rides #33 schema)
Owner ruling: waivers sign at transaction moments — with the OFFER (team
membership) and WITH the registration (camps / house leagues / tryouts).
- Offer accept + camp/HL/tryout signup APIs 409 `WAIVERS_REQUIRED` when the
  club has required active waivers unsigned for the player; shared
  WaiverSignGate modal signs via POST /api/waivers/sign-inline (session-auth,
  parent-child verified) and the flow retries.
Verify post-push: add a required club waiver → register for that club's camp
→ signing modal appears → after signing, registration completes; same on an
offer accept.

## #33c — 2026-07-20 waiver reminders + roster visibility (small schema)
Owner directive: enforce league waivers via reminders + staff visibility.
- Schema: `WaiverReminder` send-once ledger (plain ids, additive db push).
- Cron `/api/cron/waiver-reminders` (CRON_SECRET; vercel.json 10:00 daily) —
  bell + push (`waiver_reminder` added to PUSH_TYPES) + email signing links at
  7d and 24h before Season.startDate for unsigned required league waivers.
  ⚠️ BOX: add the daily curl to the box's cron scheduler alongside the other
  /api/cron/* jobs (Vercel crons don't run on the box).
- Waivers column on league-rosters page (per-season league waivers) and club
  team roster page (club waivers) for all club staff roles.
Verify post-push: set a season startDate ~5 days out with an approved roster
and unsigned waivers → run the cron with CRON_SECRET → parent gets bell+push+
email; roster pages show Signed / N unsigned chips.

## #33d — 2026-07-20 manual game-day waiver reminder (code only)
Owner ruling: NO hard block. Staff (club owner/manager/staff/team manager of
the rostering club, or league side) tap "Remind" next to an unsigned player
on the league-rosters or team-roster page → POST /api/waivers/remind → family
gets push + email with fresh signing links immediately (deliberate action,
not deduped).
Verify post-push: roster page → unsigned chip → Remind → parent device gets
push; email lands.

## ✅ DEPLOYED TO PROD (box) 2026-07-21 — sha 07c972f (owner approved "push to prod")
Shipped the full 2026-07-20 batch: waivers (auto-send on roster approval,
in-flow signing with offer/camp/HL/tryout, tokenized public sign page, season
signing-status, scheduled 7d/24h reminders, roster visibility, manual remind)
+ the coach role-scoping security fix + Fable-audit fixes (roster IDOR,
obligations/offers/invitations read-scoping, tournament tenantId spoof, venues,
mobile operator, draft-tryout visibility) + game-scoring restricted to playing
teams.
- Box DB schema: WaiverReminder created by deploy.sh's `prisma db push`
  (WaiverDocument/SignRequest/Signature were already present). All 4 waiver
  tables confirmed. Additive, no data loss.
- **Cron fix (07c972f)**: /api/cron was NOT in the middleware allowlist, so the
  route's CRON_SECRET check never ran → NO cron job ever fired on box OR
  Vercel. Allowlisted /api/cron GET-only. Box cron.d added:
  /etc/cron.d/sportshub-waiver-reminders (daily 10:00 UTC, sources web.env for
  the secret, curls localhost). Tested: 401 without secret, {ok:true,...}
  no-op with secret.
- ⚠️ STILL NOT SCHEDULED on box (pre-existing, owner's call): payment-reminders,
  rsvp-reminders, charge-due, expire-offers — these have vercel.json entries
  but Vercel is dormant and no box cron.d exists for them. Enabling would start
  sending real payment/RSVP emails, so left OFF pending owner decision.
- Verified prod: ysportshub.com + sportshubone.com 200; /api/health 200;
  /waivers/sign/<token> 200 (renders invalid-link state); services active.
- Neon (Vercel DB) NOT touched — dormant; still behind on schema.

## #34 — 2026-07-21 club-claim proof document upload (SCHEMA, local)
Owner: the paper-proof claim path (no contact on file) can now include a
supporting DOCUMENT (CRA letter, incorporation, insurance cert, photo) that the
admin sees during review. `ClubClaim.proofDocumentUrl` (webp data URL, like
avatars); wizard proof step gets an ImageUploadField; admin claims page shows
the image. Additive column — plain `prisma db push` (local done; box+Neon on
next deploy). Verified int 347/347.

## ✅ DEPLOYED TO PROD 2026-07-21 (batch) — sha 9de3977 (owner: "build all + push to prod")
Shipped since 07c972f: accounting/reports tab (clubs+leagues, CSV export) ·
club-claim proof-document upload (schema #34 ClubClaim.proofDocumentUrl, applied
by deploy.sh) · legal pages (privacy/terms/AUP) + footer + © 2019 + logo fix ·
nav Marketplace-dup removed + mobile pill colors · single notification bell +
chat bubble in manage area · phone data-gap fix · branded DateTimePicker +
tryout-create rollout (wave 1). Verified: sha 9de3977, proofDocumentUrl column
present, both domains + /legal/* + /api/health 200, services active. Unit 20/20
+ int 347/347 pre-deploy.
⚠️ Owner follow-ups: lib/legal.ts placeholder contacts (privacy@/legal@/
support@sportshubone.com) — ensure those inboxes exist or edit. STILL NOT BUILT
(large, deliberate follow-ups): DateTimePicker wave-2 (~19 forms) · venue
overhaul (schema+picker+detail/map+per-entity hours+conflicts) · trainer role.

## #35 — 2026-07-21 evening: venue leftovers + TRAINER ROLE (LOCAL, awaiting owner deploy approval)
Local commits `5124e4f` (schema) · `46ae486` (venue) · `0af445e` (trainer) ·
constraint fix + verify script. NOT deployed.
- **Schema (additive):** SeasonVenueHours · PracticeSlot.venueId · Tenant.type
  (CLUB|TRAINER) · Role.Trainer · TrainingSession/TrainingSessionSignup ·
  TrainerProfile · TrainerAvailability · OneOnOneBooking. Plain
  `prisma db push` (deploy.sh does this) — local done; box + Neon on deploy.
- ⚠️ **EXTRA STEP deploy.sh does NOT do:** re-run the raw-SQL integrity file on
  the box DB (Trainer added to `UserRole_scope_coherence` — without it every
  trainer signup 500s):
  `sudo -u sportshub bash -c "cd /opt/sportshub && set -a && . /etc/sportshub/web.env && set +a && npx prisma db execute --file prisma/sql/2026-07-authz-integrity.sql --schema prisma/schema.prisma"`
- Venue: league per-season scheduling hours (global VenueHours mutation bug
  CLOSED) · VenueSelector on team-calendar events + practice slots · intra-org
  HARD double-book block (409) on tryout/team-event/practice/training.
- Trainer: full P1-P3 (see batch-backlog §5 status). Public: /training/[id] +
  /events Training filter + club-page booking widget; /training +
  /api/trainers (GET) added to public-paths allowlist.
- Gates: tsc + lint clean · int 347/347 · prod build clean · runtime e2e
  15/15 (`scripts/demo/verify-trainer.mjs`; cleanup SQL run after).
- Housekeeping: `venues/route.ts` removed from static-conformance KNOWN_DEBT
  (was a pre-existing red test). The 4 offers/invitations unit-test failures
  are pre-existing on HEAD (verified by stash-run) — untouched.

## #36 — 2026-07-21 late: overdue reminders/visibility + accounting export formats (LOCAL, same pending batch as #35)
Commit on top of #35. No schema change, no extra SQL — deploy.sh covers it.
- Overdue: sendOverdueReminders in /api/cron/payment-reminders (nag every 4d,
  stop at 90d) · Overdue tile + aging strip on club/league Payments · row
  badges · club Overview attention row. Declined one-off cards now email the
  payer (webhook).
- Accounting: QuickBooks + Xero CSV formats + date-range filter + trainer
  labels.
- ⚠️ REMINDER EMAILS STILL DARK IN PROD: /api/cron/payment-reminders (and
  charge-due) are not in box cron.d — only waiver-reminders runs. Enabling =
  real emails to real families; owner's explicit call. One-liner mirrors
  /etc/cron.d/sportshub-waiver-reminders (e.g. 30 9 * * * for reminders).

## ✅ DEPLOYED TO PROD 2026-07-22 (owner: "push everything to prod") — sha ce88071
Covers runbook #35 + #36 (trainer batch had already reached the box as part of
b370258 via the parallel window; this deploy added payments/overdue +
accounting exports + nav bell + demo tweaks). deploy.sh ran clean (db push,
build, restart); **authz-integrity SQL applied to box DB** (Trainer now valid
in UserRole_scope_coherence). Verified: box sha ce88071, services active,
ysportshub.com / /events /venues /api/health all 200, /training 404s cleanly
on unknown ids. Neon untouched (dormant).
⚠️ STILL OFF (owner switch): payment-reminders + charge-due box crons — the
new overdue nagging ships dark until scheduled (see #36 one-liner).

## #37 — 2026-07-22: Player of the Game (social-feed-plan P1) — LOCAL, not deployed
- Schema (additive, plain `prisma db push` — deploy.sh covers box; Neon dormant):
  `Game.potgPlayerId` (+FK→Player, SetNull) · `Game.potgPhotoUrl` (Text, data-URL).
- Code: finalize API accepts potgPlayerId/potgPhotoUrl (roster-validated, capped
  2MB, re-finalize without a pick keeps the award) · console review screen POTG
  panel (top scorer suggested, tap-to-change, table photo via capture input) ·
  /live game page gold banner (photo consent-gated server-side) · scoresheet
  line · final bell mentions POTG. No raw SQL, no cron, no env.

## #38 — 2026-07-23: SOCIAL FEED P1–P5 — ✅ DEPLOYED TO BOX (sha 3f49980, owner-approved; schema applied w/ --accept-data-loss, verified in sync)
- Schema additive (deploy.sh db push covers): Follow.playerId+status,
  Player.socialVisibility, Story/StoryView/PostReaction/Comment/
  CommentReport/Repost, Post.visibility+kinds+card params, sharedPostId on
  TeamMessage/DirectMessage. One `--accept-data-loss` prompt (new unique
  constraints on empty columns — safe).
- ⚠️ Before PUBLIC launch: set ANTHROPIC_API_KEY on box + flip STRICT_SCREEN
  → true in apps/web/src/lib/social/photo-screen.ts (custom-photo screening
  currently fails open in dev).
- No raw SQL, no cron, no env otherwise. Commits ac354cf/999760a/e515aa6/
  73bd0e3/598ca41 + docs.

## #39 — 2026-07-24: OVERNIGHT BATCH (registration rework + family accounts + handles + domains + nav)
- **Wave 1 ✅ DEPLOYED box `7c40120`**: multi-kid/multi-week registration, agePolicy (tryouts STRICT enforced), capacity fix, tournament-fee obligations, club overdue nags, COPPA consolidation. db push ran via deploy.sh (additive).
- **Wave 2 (family accounts + handles + domains + SmartBack)**: deploy = normal box push; deploy.sh's prisma db push flags the new UNIQUE on User.handle as "data loss" — it is safe (new null column) but if deploy.sh fatals, run on box: `prisma db push --accept-data-loss` as sportshub with web.env, then re-run deploy.sh.
- **AFTER wave-2 deploy, run ONCE on box**: `npx tsx scripts/backfill-user-handles.ts` (sportshub user, web.env sourced) — assigns default handles to existing users. Idempotent.
- Crons: payment-reminders now also nags club-owed obligations when the owner enables the payment crons (#36 unchanged).

## #40 — 2026-07-25: NATIVE BINARY VERSION GATE (shipped inert; owner-operated)
Server-driven "update available / update required" for store builds. Set on box /etc/sportshub/web.env when needed (all optional; unset = gate off):
- `MOBILE_IOS_MIN_BUILD` — builds BELOW this get the blocking "Update required" screen
- `MOBILE_IOS_LATEST_BUILD` — builds below this get a dismissible "new version available" pill
- `MOBILE_ANDROID_MIN_BUILD` / `MOBILE_ANDROID_LATEST_BUILD` — same for Android (NOTE: Android reads build-time versionCode, a known caveat until expo-application ships in a future binary)
- `MOBILE_IOS_UPDATE_URL` (defaults to the TestFlight invite) / `MOBILE_ANDROID_UPDATE_URL`
- `MOBILE_UPDATE_MESSAGE` — optional custom copy on the blocking screen
Rebuild NOT needed after env change (route reads env at request time) — but the box service must restart to pick up web.env: `sudo systemctl restart sportshub-web`.

## #41 — 2026-07-30: LEAGUE IA REDESIGN + DERIVED NAMING — ✅ DEPLOYED TO BOX (sha cb17ad4, owner-approved; schema push clean, backfill-division-names.ts ran on box 8/16, composed names verified live on public season page). NEON still pending.
- Code: flat 8-tab season console (Overview · Clubs · Teams · Schedule · Standings · Playoffs · Referees · Settings), one-page Settings, Season checklist owns all status buttons, derived division/team naming (lib/teams/naming.ts).
- Schema additive (deploy.sh db push covers, no data loss): `Tenant.shortName`, `Team.nameSuffix` — both nullable. Also needs NEON push when Neon is next synced (pending list: one push covers #24–#33 + this).
- **AFTER box deploy, run ONCE on box**: `npx tsx scripts/backfill-division-names.ts` (sportshub user, web.env sourced) — recomposes Division.name to the uniform "U15 Boys · Tier 1" shape. Idempotent, display-only. Team names intentionally untouched (legacy until a club edits the team).
- Box demo world: reseed (`reseed-demo.sh --purge-manual-leagues`) picks up the composed seed names automatically.
- No raw SQL, no cron, no env.

## #42 — 2026-07-30: LEAGUE CONSOLE TUNE-UP — ✅ DEPLOYED TO BOX (sha 697fca0, owner-approved; both new columns verified on box DB, site 200). NEON still pending.
- Settings status strip + importance order · compact registration w/ balance-due-days · editable sessions w/ per-session court selection + preferred order · schedule mode question (session-by-session vs whole season) + readiness banner + session-scoped preview/commit · org in sidebar nav.
- Schema additive (deploy.sh db push covers, no data loss): `Season.balanceDueDaysBeforeStart Int?`, `SeasonSessionDayVenueCourt.order Int @default(0)`. Neon: same push whenever synced.
- No backfill needed (legacy court rows at order 0 keep old scheduling behavior). No raw SQL, no cron, no env.

## #43 — 2026-07-31: ORG SEASON DEFAULTS (Phase A) — ✅ DEPLOYED TO BOX (sha 9ac40ac, owner-approved; seasonDefaults column + nullable Season fields verified on box DB, site 200). NEON still pending.
- Org rulebook: Organization.seasonDefaults (Json, additive) + Season policy fields made NULLABLE (gameSlotMinutes, gameLengthMinutes, gamePeriods, idealGamesPerDayPerTeam, defaultVenueOpenTime, defaultVenueCloseTime, schedulingPhilosophy, allowGuestPlayers — dropping DB defaults; existing rows keep values, no data loss).
- deploy.sh db push covers it. Neon: same push when synced. No backfill, no cron, no env.
- Behavior note: NEW seasons created after this leave format fields null → inherit org defaults (or system defaults when no org). Existing seasons unchanged (values become explicit overrides).

## #44 — 2026-07-31: ORG RULEBOOK SEEDED + INHERITANCE COMPLETIONS — ✅ DEPLOYED TO BOX (sha 2c6d7ef) + demo world RESEEDED
- Owner report: org defaults empty / season settings unchanged. Fix: NPH seed now carries the full org rulebook; Showcase+Fall seasons inherit (null fields), Summer keeps deliberate overrides. Finalize preflight + standings tiebreakers now resolve effective config (inheriting seasons can finalize; org tiebreakers apply).
- Box verified: org seasonDefaults present, Showcase teamFee NULL (inheriting), site 200. Reseed regenerated demo ids (old season URLs are stale). Neon unchanged/pending.

## #45 — 2026-07-31: SETTINGS GROUPING + STRUCTURED QUESTIONS + ORG NAV + DATES/FEE INHERITANCE — local, NOT deployed
- No schema change (questions ride the existing Json columns; legacy strings normalize). Reseed recommended after deploy (seed adds a single-choice demo question): reseed-demo.sh --purge-manual-leagues. No cron, no env.

## #46 — 2026-07-31: DATES/FEE INHERITANCE + CI GREEN + PURGE FIX — ✅ DEPLOYED TO BOX (sha ea23460) + reseeded (verified: Showcase inherits dates, 46 demo teams)
- Also live from #45 batch: settings grouped rulebook-first, structured application questions, org→league nav.
- CI: deploy.yml (Vercel leftover) REMOVED — GitHub is a mirror only; 9 stale unit tests fixed → suite 305/305 green → push-failure emails stop.
- Seed purge hardened (offers/games against demo teams deleted before teams — box reseed had crashed mid-purge on Offer FK).

## #47 — 2026-07-31: CI FULLY GREEN (first time since ≥Jul 6) — no deploy needed (tests/workflows only)
- All three jobs pass on 5444747: unit Test+TypeCheck (db-mocked layout test), Integration (Postgres), E2E gate (all 10 phase runners — fixtures repaired for 18+ attestation, STRICT age policy, derived division naming, club-scoped offer templates). Unit job's database-less Build step removed (E2E job builds vs real Postgres). deploy.yml (Vercel leftover) deleted → push-failure emails END.
- Box at 918144d runs identical app code; test-only commits ride along on the next deploy.

## #48 — 2026-07-31: TEAM CHECK + SESSION-SCOPED VIEW + BOX TZ — ✅ DEPLOYED (sha 8963eac) + reseeded
- TeamCheck verification panel (per-team checkmarks, games vs target, click→ schedule) · committed list scoped to selected session · Summer sessions "Weekend N".
- **BOX ENV CHANGE: TZ=America/Toronto added to /etc/sportshub/web.env** (box OS runs UTC; scheduler slot math is local-time → games generated at 5 a.m. Toronto). Any future box rebuild must keep TZ set. Verified post-reseed: Summer games at 9:00 a.m. Toronto.

## #49 — 2026-07-31: SCHEDULER SPREAD FIXES + 10/5/2 DEMO NORM — local (20975b3), NOT deployed
- Engine: per-session share hard-blocked in ALL modes (whole-season no longer packs weekend 1); idealGamesPerDayPerTeam = hard cap w/ relaxed 2nd pass (Sat+Sun split). Dead Season.targetGamesPerSession removed from console; Session.targetGamesPerTeam editable per session (sessions API GET/POST/PATCH).
- Seed: org rulebook gamesGuaranteed 10; Fall = 5 real-Saturday weekend sessions (October–February). Deploy MUST be followed by box reseed (`reseed-demo.sh --purge-manual-leagues`) — the new world shape is required for the demo story.
- No schema change. Neon unaffected. Verified local: scheduler 36/36, int 366/366, e2e receipt 40 games/10 per team/2 per session/1 per day.

## #50 — 2026-07-31: DRAFT→PUBLISH SCHEDULE LAYER (Schedule Studio P0 slice) — local, NOT deployed
- `Game.publishedAt DateTime?` (SCHEMA — box needs `prisma db push` + `npx tsx scripts/backfill-publish-games.ts` sets publishedAt=createdAt for pre-existing games BEFORE traffic).
- Commit now saves DRAFTS silently (fanout REMOVED from commit); new `POST /api/seasons/[id]/schedule/publish` stamps drafts + sends the one club/team-circle fanout; game PATCH/DELETE notifications gate on published; playoff-generated games auto-publish.
- 16 public/family surfaces filter drafts via `lib/games/visibility.ts` PUBLISHED_GAME (scores, league page, ICS calendar, mobile browse, live ticker, team page/calendar, dashboards, RSVP sweep, my-calendar, feeds, club profile, score picker). Console schedule GET now owner/admin-only (was UNAUTHENTICATED).
- UI: gold draft banner + "Publish schedule · N new", Draft badges, checklist step 10 "Schedule published", TeamCheck preview mode (preview games visible per team pre-commit), capacity card refetches on every session edit (was length-only dep).
- Deploy order on box: push GitHub → deploy.sh → `prisma db push` → backfill script → reseed demo (`--purge-manual-leagues`).

## #51 — 2026-07-31: VENUE/COURT/SESSION FLOW — ✅ DEPLOYED TO BOX (sha f37f188)
- One-step venue setup (auto-created courts + hours + propagate-to-sessions), "used by X of Y sessions" + propagate endpoint, cascade on remove, session form defaults ON, supply-first panel order. No schema change; no reseed needed.
- Also live from this morning's chain: #49 (10/5/2 scheduler spread) + #50 (draft→publish layer; column + backfill applied via psql, demo reseeded 320/320 published).

## #52 — 2026-07-31: SCHEDULER ROTATION + VARIETY + REPAIR + SHUFFLE + SHARED VENUES + 20-TEAM DEMO — ✅ DEPLOYED (box 59cbbe1) + reseeded (Fall 10+10 teams verified)
- Time-of-day rotation, per-season rematch variety (varietySeed), repair pass (100/100 games), whole-season existingGames seeding. Demo Fall = 20 teams (10/division). No schema change. Deploy MUST be followed by box reseed (new world shape).

## #53 — 2026-08-01 overnight: SCHEDULE STUDIO P0 FOUNDATIONS — ✅ DEPLOYED (box 062af00) + one-time SQL ran (189 legacy SCHEDULED games unlocked; remaining isLocked rows are COMPLETED games, inert)
- conflicts helper (cross-league court checks on manual moves) · isLocked=pinned (commit unlocked, regen preserves pinned, PATCH 409) · swap + validate endpoints · hard play-everyone-before-repeats · division guards (approve/delete/preflight) · D-004 ref calendar + W-001 stat casing.
- Deploy steps: push→deploy.sh, then ONE-TIME SQL on box: `UPDATE "Game" SET "isLocked" = false WHERE status = 'SCHEDULED' AND "isLocked" = true;` (old commits locked every game; new semantics = pinned). Reseed optional (no world-shape change).

## #54 — 2026-08-01: SCHEDULER FIX TRAIN — ✅ DEPLOYED (box 3823ac5)
- 4bfeccc (whole-season 87/13 stranding fix) + b3b681f (same-session rematch law + spacing + repair ladder) + 3823ac5 (Fill the gaps recovery). No schema change, no reseed.

## #55 — 2026-08-01: SCHEDULER ARCHITECTURE TRAIN — ✅ DEPLOYED (box 96e76ff)
- cfa8d6b (failure diagnostics w/ exact fixes) + 4f47e10 (trade-offs ≠ errors panel) + 9992505 (augmenting-chain relocation — concessions eliminated on the seeded world) + 96e76ff (two-phase placement: courts-are-just-slots, gap shaping, court rotation, venue-major, same-gym cohesion + FAIRNESS REPORT api+panel). No schema change, no reseed.

## #56 — 2026-08-01: SCHEDULE QUALITY v2 (per-team weekend preferences) — ✅ DEPLOYED (box 5eee87a + schema pushed + reseeded; 4 White teams SPLIT_DAYS verified; Neon still pending with #24+)
- Plan: ~/.claude/plans/declarative-gliding-wren.md (approved). Supersedes b26da0d's next-day de-double (never deployed).
- SCHEMA (additive, needs `prisma db push` on box + Neon): `TeamSubmission.weekendStyle` (enum WeekendStyle SAME_DAY/SPLIT_DAYS/NO_PREFERENCE, nullable) + `Season.defaultWeekendStyle` (nullable).
- Engine (lib/scheduler/generate.ts): per-team weekend styles (TEAM > league default > org rulebook > SAME_DAY) · same-day gap curve (2-slot break ideal) · DAY-ANCHOR PRE-PLAN (round-based weekend matchup selection + parity 2-coloring by day; hard in strict passes) · anchor-aware repair movers (two-tier slot scans + best-fit endgame) · venue-cohesion repair pass (same-gym one-trip days) · rate-based division-scoped first/last-tip rotation with scarcity-gated notes · seed mixing (mixSeed) for real per-season variety.
- Report/API/UI: fairness report gains weekendStyle, preference honored, last games, division-scoped edges (unitByTeam); team page weekend-preference selector; Settings › Game format league default; org rulebook default; NPH seed: org default SAME_DAY + 4 White teams SPLIT_DAYS.
- Receipts (Fall 20-team seeded world): whole-season 100/100 games, 0 b2b, preference 98/100 (SAME 79/80, SPLIT 19/20), ~2.4s; session-by-session 100 games, 0 b2b, SAME 80/80, SPLIT 18/20; Shuffle differs, determinism holds. Suites: scheduler 45/45, unit+int green (see session log).
- Deployed 2026-08-01: deploy.sh (first run failed lint — `useOf` helper read as a React hook, renamed courtUseOf in 5eee87a) → schema push (deploy already synced it; columns verified) → reseed clean. Site 200.

## #57 — 2026-08-01: SCHEDULE REQUESTS + SCENARIOS + ORG PLANNER v1 — ✅ DEPLOYED (box c35654c + schema pushed [TeamScheduleRequest verified] + reseeded [1 APPROVED + 1 PENDING request, 1 blackout, 2 enabled teams]; Neon still pending with #24+)
- SCHEMA (additive): new table TeamScheduleRequest + enums ScheduleRequestKind/Status; TeamSubmission.scheduleRequestsEnabled; SeasonTeamBlackout.sourceRequestId; User relations. `prisma db push` on box (+ Neon eventually with #24+).
- Full build log: docs/roadmap/league-ia-redesign.md §29. Deploy steps when approved: push GitHub → deploy.sh → verify schema synced → reseed demo world.
- Suites at commit time: scheduler 50/50 · unit + int green (see §29) · Playwright loop 14/14.

## #58 — 2026-08-01: B2B-AT-ALL-COSTS + 4 BUG FIXES — ✅ DEPLOYED (box 99d3a03; no schema change; owner still owes the one-time Playground hours re-save to heal mixed weekend rows)
- Priority reorder (b2b > requests > styles) + new b2b elimination pass + edge-rebalance b2b-safety + venue-hours propagation fix (applyVenueHoursToSessionDays) + deterministic loader ordering + trim-card guard. Build log §30.
- NOTE for owner on deploy: re-save the Playground hours once (setup card or hours editor) after deploying — that now pushes 8:00-20:00 into ALL weekends' day rows and the mixed-hours state heals itself.

## #59 — 2026-08-01: DEMO JOURNEY ARC — ✅ DEPLOYED (box 8f9b793 + schema pushed [demoState, statusReason verified] + census on box; loader button VERIFIED ON BOX: pitch reload via console API spawned + completed in 26s. Neon pending with #24+)
- SCHEMA (additive): PlatformSettings.demoState Json · Game.statusReason String. `prisma db push` on box (+ Neon later).
- Full build log §31; demo run-sheet docs/demo-runbook-nph-journey.md. Deploy: push GitHub → deploy.sh → schema push → load scenarios from admin console (box seeder path uses npx tsx from repo root — verify /opt/sportshub has scripts/data/nph-census.ts after pull).

## #60 — 2026-08-02: SEASON PLANNER BOARD v1 — ✅ DEPLOYED (box 3c6a33e; expectedTeams column verified integer on box DB; planner API 401-gates + page auth-redirects live. Neon pending with #24+)
- Schema: `Division.expectedTeams Int?` — box needs `prisma db push` at deploy
  (local pushed). Neon pending with #24+.
- Code: lib/scheduler/planner-core.ts + planner.ts + planner-auth.ts, 3 API
  routes under /api/seasons/[id]/planner, planner board page, Schedule-tab link.
- Verify after deploy: log in owner-nph@ → Showcase season → Schedule →
  "Season planner →" → board shows 13 weekends; Balance/Apply round-trips.

## #61 — 2026-08-02: SEASON PLAN WIZARD (5-step rebuild to the approved mock) — ✅ DEPLOYED (box fa88f1f; planPublishedAt column synced by deploy.sh, verified; anon gates verified live: planner 401, card 404, league page w/o calendar, wizard 307→sign-in; operator card renders 73KB PNG w/ fonts on the box build. Neon pending with #24+)
- Commits: 96cc6d0 (w1 gyms&weekends grid) · e39e61a (w2 teams+last-season) · c502d25 (w3 calendar step, /planner folds into /plan?step=3, season-lock guards added to planner apply/PATCH) · 6e2f0b1 (w4 publish+card+living view) · 29f0906 (w5 registration-vs-plan watch screen).
- SCHEMA (additive): `Season.planPublishedAt DateTime?` — local pushed; box needs `prisma db push` at deploy. Neon pending with #24+.
- Route change: /manage/.../seasons/[id]/planner now redirects to /plan?step=3 (API routes unmoved). New endpoints: sessions/[sid]/venues/[vid] POST/DELETE + /hours PATCH · planner/venues GET · planner/card GET (404 until published) · planner/publish POST/DELETE.
- ⚠️ Box runtime check at deploy: card routes need next/og — if box cards already work (they do, live cards ship), nothing new needed; locally requires arm64 node for dev.
- Verify after deploy: owner-nph@ → Showcase season → Schedule → "Season calendar →" → 5-step wizard; step 4 operator card preview renders; public league page shows NO calendar until published.
- Gates at commit: unit 362/362 · int 435/435 · tsc clean · Playwright drives step1/2/3/4/5 locked+drive all PASS.

## #62 — 2026-08-02: PLAN WIZARD OWNER-FEEDBACK FIXES — ✅ DEPLOYED (box 725ed7a; no schema change; live-verified: Grade 7 w/ 9 registered edited to 14 → planner plans 14, restored; grid serves 21 weekends Nov–Mar w/ 16 virtual + simple hours pair)
- 95d2004: every grade editable in planning — plan = max(registered, estimate) via shared planningTeams(); floor at grade-cluster level; stepper seeds from registration, hint "N registered".
- 725ed7a: grid = EVERY Sat–Sun of the season (union of declared dates + session days, whole months) under month bands; virtual weekends created on first tap (ensureWeekendSession + POST /api/seasons/[id]/weekends, phase-aware, full auth gate); one-tap cells; ONE hours range per gym card (exceptions + full editor behind quiet links).
- Gates: unit 379/379 · int 460/460 · tsc clean · all 12 step-drive runs PASS. Neon pending with #24+.

## #63 — 2026-08-02: PLANNER BUILDINGS ARC P1–P5 (7 commits c55767c..3f60d5b) — ⏳ NOT DEPLOYED (local DB pushed only; box + Neon pending)
- SCHEMA (all additive; local pushed + verified, box `prisma db push` at deploy, Neon with #24+):
  `SeasonVenue.fillOrder Int?` (0 = fill first, null sorts last) · `SeasonSession.unitVenues Json?` ("division:<id>" → venueId; empty/null = no preference) · `Division.alternateVenues Boolean @default(false)` · **new model `SeasonVenueUnavailability`** (seasonId, venueId, satDate, reason; unique on the triple) — weekends a gym is not the season's, with the reason ("Taken: NJC/NSC").
- P1 (c55767c/06d2c4a/75eed72): plans have buildings. packWeekendVenues/packPlanVenues (gyms fill in order, one gym per grade-weekend, residency across months, alternate flag) · proposePlan scores real packing · engine packs top gym first (slot sort day→venueRank→court→time), honors assigned gyms softly, reports `venueFallbacks` · step-2 gym up/down + whole-season on/off toggle (`toggle-season` route) + reserved notice slot · step-3 gym sections/meters/chip-switcher · strip shows the one assigned gym.
- P2 (c29a744): taken weekends. Attachment wins; turning a taken cell on deletes the mark server-side; toggle-season skips marked weekends (`weekendsUnavailable`); propagation never re-claims. Seeded Six Park "Taken: NJC/NSC" on 2026-10-17 / 11-14 / 12-12 / 2027-01-16 / 02-13 / 03-13 (seed-journey stage 3 + idempotent scripts/demo/apply-njc-defaults.ts; **already applied to the local world**; box world needs the apply script after deploy if its season should match).
- P4 (c48c7ed): planning = human estimate only (planningTeams returns expected; SUPERSEDES #62's max(registered, estimate)). Registered = overlay chip + gold over-estimate warning + step-5 bars. Step-1 one-tap "Start from registrations" + inline add-grade (reuses POST /api/seasons/[id]/divisions).
- P5 (53cda58): "Plan Your Season" console tab (before Schedule) w/ flow rail Plan→Publish→Watch→Schedule→Live, stage-derived, deep links into wizard steps; Schedule tab de-buried.
- P3 (3f60d5b): "one-gym" lever (2nd buildings 10x) + gym-hours chips Start early/Start late/Finish early via POST planner/preview-hours (in-memory shift, never writes; Apply loops the existing hours route) + wizard SmartBack fallback → ?tab=plan.
- Gates at milestone: unit 467/467 · int 486/486 · tsc clean · Playwright drive scripts/demo/verify-plan-flow.mjs 19/19 (env-driven SEASON_ID/LEAGUE_ID; safe on live worlds — propose/preview only, no Keep/Apply).
- No backfill needed anywhere: columns nullable/defaulted, new model starts empty on box until the apply script runs.
