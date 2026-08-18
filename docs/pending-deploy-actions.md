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

---

## ⛔ 42. Club Page Studio schema — MUST db push BEFORE the next box deploy

**Linked code change:** `TenantBranding` gains `theme`, `accentKey`, `headerStyle`, `intensity`, `shape`, `density`, `bannerFocalX`, `bannerFocalY`, and **drops `customCss`**.

**Why before deploy — this one breaks the site, not just a feature.** `getClubProfile()` uses `include: { branding: true }`, so Prisma selects every column the client knows about. Deploying the new code against a database that still has the old shape makes every club page return **500** with `column TenantBranding.<x> does not exist`. This is not theoretical: it happened locally on 2026-08-18 the moment the column was dropped under a running server, and `/club/<slug>` 500'd until the client was regenerated.

`customCss` was removed on the owner's instruction ("you can delete everything"). It had **zero reads** anywhere in the codebase, and CSS on a page that renders other people's data is an exfiltration vector, since `background-image: url()` can carry values off-site.

### Step 1 — Inspect

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'TenantBranding'
ORDER BY column_name;
```

### Step 2 — Apply (additive columns + one drop)

Run `prisma db push` against the box, then **regenerate the client and restart the service**. A push alone is not enough: a long-lived node process keeps the old client in memory and keeps selecting the dropped column.

### Step 3 — Nothing to backfill

Every new column has a default (`theme` = `home-court`, `accentKey` = `royal`, focal points = 50). `resolveTheme()` also falls back field by field and honours an existing `primaryColor` when no `accentKey` is stored, so the 1,392 imported listings render exactly as they do today until someone opens the studio.

### Verification

`/club/<slug>` returns 200 and the page ships `--club-bg`, `--club-panel`, `--club-ink`, `--club-radius` alongside the existing `--brand*` variables.

**Status:** ⛔ NOT APPLIED to box or Neon. Local only.

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

## #64 — 2026-08-02: COMPACT BOARD + PLANS AS DOCUMENTS + UI ROUND (4 commits d0612c3 / 07cf74c / 277e44b / d005436) — ⏳ NOT DEPLOYED (local DB pushed only; box + Neon pending)
- SCHEMA (additive; local pushed + verified, box `prisma db push` at deploy, Neon with #24+): **new model `SeasonPlan`** (seasonId FK cascade, name, source "imported"|"proposed"|"manual", assignment Json, venues Json, isActive, timestamps; index seasonId) + `Season.plans` back-relation. No backfill: the first GET /api/seasons/[id]/plans lazily snapshots the saved calendar as "NPH plan" (imported, active) per season.
- d0612c3 COMPACT BOARD (owner-approved mock + UI/UX consult): weekend cards = date + one fraction chip (story in tap-popover); gym sections dot+hued name+meter+fraction; grade chips gym-tinted w/ game count + SVG reason glyph (home/moved/picked/alternates); rail = one-row moves w/ before→after impact strips (gradeGymStrip on packShownPlacements); plan-shared.ts is the ONE hue+tone source for board+strip; WhyPopover (portalled, tap+hover, Escape).
- 07cf74c PLANS BACKEND: routes under /api/seasons/[id]/plans — list (lazy snapshot), create, read, PATCH (imported content 409; ACTIVE plan PATCH writes through to sessions), DELETE (active 409), activate (applyAssignment then flag flip). lib/scheduler/season-plans.ts shared module. 21 int tests (world seed 1148).
- 277e44b UI ROUND (owner live feedback): board columns 260–320px (long seasons scroll sideways, meters readable) · gym colour legend above both views (full names + "fills first") · rail rows lead w/ sentence, numbers wear units, full math in popover, every move states its COST (destination load + gym change) · rail says whose calendar ("Ideas for {plan}") · **residency veto in suggestFor**: two-building tidy moves only offered when they land the grade on its home gym (owner hierarchy: residency > one-building; shortage moves exempt but name their landing).
- d005436 PLANS DROPDOWN: PlanPicker + PlanSaveControls replace the Keep button — Save as new plan / Save to «plan» / Use for the season (confirm+activate); mount selects the active plan; levers mark working copy "proposed" until hand-edited; first save on a plan-less season self-activates. NOTE: POST /planner/apply still exists server-side (int tests + old scripts) but NO UI reaches it — retire or mirror onto the active plan later.
- Verify after deploy: owner-nph@ → wizard step 3 → picker shows "NPH plan ACTIVE REFERENCE"; edit → "Save as new plan"; drives scripts/demo/verify-plans.mjs (25 checks, creates+deletes its own plan, never activates) + verify-board-compact.mjs (23) + verify-plan-flow.mjs (19, one-gym check now allows residency-justified splits).
- Gates at milestone: unit 268/268 (scheduler+seasons) · planner int 54/54 incl. 21 plans · tsc clean · 4 drives green · saved calendar byte-identical after drives.
- INVESTIGATION on record (owner asked "why didn't the solver do these moves itself"): NO NPH bias in proposePlan — the board opens on the saved (kept NPH) calendar and the rail was critiquing THAT; fresh propose(balance) on the live world = zero overloads, zero rail rows, Gr7+Gr10 fill NJC weekends 54/54 exactly, Gr12 Playground all season; server propose byte-identical to local pure-function run.
- ADDENDUM (same night): 260a540 "New plan" dropdown action (system solves + saves, drive 36/36) · 1853574 plans remember their world — **SeasonPlan.settings Json?** (2nd additive column, local pushed; box db push covers both), server-side world snapshot on create/content-PATCH, board draws non-active plans in their own saved world, planDrift gold line + activate warning, levers disabled on snapshot worlds, null-settings heal for the active imported plan. Gates 285/285 units · plans int 25/25 · verify-plans 41/41.

## #65 — 2026-08-03: VENUE MODEL V2 (commits be23fce, cb55278, 9706c13 + seed/docs commit) — ⏳ NOT DEPLOYED (local DB pushed only; box + Neon pending)
- SCHEMA (both additive, defaulted; local pushed + verified, box `prisma db push` at deploy, Neon with #24+): `SeasonVenue.role String @default("pool")` — "home" = the building the league owns (fills first, costs nothing, at most one per season), "pool" = rented by the court-day · `SeasonSessionDayVenue.bookingStatus String @default("confirmed")` — "assumed" (the solver put us here) vs "confirmed" (the gym said yes). Defaults are chosen so an existing season wakes up unchanged: nothing reads as unbooked, and every gym reads as rented until the backfill names the home one.
- `SeasonVenue.fillOrder` is now a DEAD COLUMN (owner ruling: "fill order is dead"). Kept, not dropped: old plan snapshots and the drift sentence still read what a plan was saved under, and the board infers a snapshot's roles from fillOrder 0.
- **BACKFILL — MUST RUN ON BOX after `prisma db push`** (and on Neon with #24+): `npx tsx scripts/backfill-venue-roles.ts` (`--dry` says what it would do). It names each existing season's home gym by fillOrder 0 → isPrimary → lowest non-null fillOrder, never overwrites a season that already has one, and is idempotent. Without it EVERY weekend of EVERY existing season prices as rented and the planner charges a league for a building it owns. Local run done.
- BEHAVIOR CHANGE (be23fce): whole cohorts co-locate into the home gym FIRST, then spill packs into the pool minimizing rented court-days and then buildings. GYM_VIOLATION_COST and SECOND_BUILDING_COST are deleted — a rented court-day at 1000 dominates, so CONSOLIDATION OUTRANKS RESIDENCY (residency is a small tiebreak now, not a veto), and the one-gym lever maps onto balance. New pure fns: planRentalBlocks (null venueId = the empty slot somebody must book), assignBlocksFromPool (needed → assumed), rentalAsk (dateless season/month ask sheet with chunk phrases), courtsNeeded / courtDaysNeeded / orderedVenues. PlacementReason gains home/rented; generate venueRanks = home first then capacity; propose/planner APIs return blocks + ask.
- UI (cb55278 step 2, 9706c13 step 3): fill-order arrows and chips gone — each gym wears its role ("Home gym" / "In the pool") with a confirm-guarded Make-this-the-home-gym (exclusive server swap) and a no-home nudge; assumed weekends render hatched with a one-tap "Booked it" (PATCH bookingStatus). Step 3 gains rental blocks with statuses, the two assignment modes ("Assign gyms for me" + Fill the gaps from my pool / "I will place them" with the venue tray), and the ask sheet above the rail.
- SEED (seed-journey.ts, this commit): roles are explicit — The Playground = home, Six Park East + Haber = pool (evidence docs/research/nph-operations-intel-2026-08.md) · Haber courts 2 → 6 (owner's Google-review reading 2026-08-03, **UNCONFIRMED — verify with the facility before any pitch**) · Haber joins each season's POOL but is attached to NO weekend (buildSessions gained a poolOnlyKeys arg; D1 no longer wires it onto 5 weekends), because a rented gym's weekend availability is the operator's knowledge, not the seed's · seeded attachments write bookingStatus "confirmed" explicitly.
- LIVE LOCAL WORLD (owner's season 160b2f09): Haber added through the product route the wizard uses — `POST /api/seasons/[id]/venues` `{venueId, courtCount:6, openTime:"10:00", closeTime:"22:00", addToSessions:false}` as owner-nph → SeasonVenue 41d648af, role pool, 6 courts, 0 weekends on. No DB writes. Box world needs the same call (or a reseed) if its season should match.
- KNOWN, BY DESIGN: a pool gym on ZERO weekends shows in step 2 (a row of Off cells to switch on) but NOT in the step-3 venue tray — the tray only offers gyms the board could accept a drop on ("Six Park is not on Dec 12–13. Turn it on for that weekend back in step 2."). Listing unbooked pool gyms there, disabled, is a possible follow-up.
- DRIVES (all green on the live local world after the Haber add): verify-plan-flow.mjs 28/28 (re-pinned to v2: no fill-order vocabulary, one home gym, every attachment carries a booking status) · verify-board-compact.mjs 23/23 · verify-plans.mjs 41/41 · verify-blocks.mjs 32/32 (NEW — blocks, ask sheet, both modes, refusals, saved calendar byte-identical) · verify-season-strip.mjs ALL PASS · verify-strip-residency.mjs is a read-only reporter (no residency assertion to re-pin).
- Gates at milestone: unit 301/301 · planner int 64/64 · tsc clean.
- PRE-EXISTING FAILURES, not v2: `apps/web/src/app/api/seasons/[id]/venues/venue-unavailability.int.test.ts` 6 failures — identical on 1853574 (before the venue-v2 commits), so they predate this arc and are not a deploy blocker for it.

## #66 — 2026-08-04: COURT BUFFER + COMPACT-FIRST + PHASE SEPARATION (Track A, uncommitted at time of writing) — ⏳ NOT DEPLOYED (local DB pushed only; box + Neon pending)
- SCHEMA (additive, defaulted; local pushed + generated + verified, box `prisma db push` at deploy, Neon with #24+): `Season.courtBuffer Int @default(0)` — courts the league leaves empty at every gym, every day, for overruns and late team growth. The default means every existing season wakes up planning to the whole building, exactly as before, so there is NO backfill to run.
- CAPACITY, ONE PLACE: the buffer is applied in `buildSlots` (generate.ts, new exported `usableCourts` helper) — usable courts = max(0, courts − buffer) per building per day, holding back the LAST courts in the day's order so preferred courts still fill first. Everything downstream inherits it with no second implementation: planner weekend capacity + per-gym courts/court-days, packWeekendVenues, rental blocks, the ask sheet, computeSessionCapacity (the schedule capacity card), org-planner run, reschedule suggestions, and the generator itself (it cannot book a held court).
- HONESTY: `PlannerVenue.courtsHeld` rides on the state (set by buildPlannerState from wired-minus-usable) and `weekendStory` appends "1 court held back" as the last clause of the weekend caption, so a smaller meter is explained rather than just smaller. New pure fns `courtsHeldOn` / `heldBackPhrase`.
- API: `PATCH /api/seasons/[id]/planner/venues { courtBuffer }` (new handler on the existing grid route; seasonPlannerAuth + season lock, 0–10, answers with the rebuilt grid). `GET` on that route and `VenueGrid` now carry `courtBuffer`. UI: step 2 "Courts left empty" number input (`data-testid="court-buffer"`) above the gym cards, read-only when the season is locked.
- SOLVER DEFAULT CHANGED (owner ruling 2026-08-03, compact-first): the objective is now overflow 1,000,000/game > weekends used 100,000/weekend (`WEEKEND_USED_COST`) > rented court-days 1,000 > peak games 100 > giants-apart 40 > residency 5. `balance` (the default), `compact` and `one-gym` are ONE objective; `spread` keeps the old shape at 50,000 an idle weekend. The greedy fallback (>300k combinations) is lever-aware too: first-fit-decreasing into weekends already in use for compact-first, the old utilization walk for spread. Practical effect on the NPH shape: every month lands on ONE weekend at 146 of 176 instead of a flat 74/72 split, and the search WILL rent a court to keep a month together.
- TESTS RE-PINNED to the new default (honestly, only where compact-first legitimately changed the proposal): planner.test.ts — "balance bundles the month onto one weekend and never overflows" (was: peak ≤ 84) · "compact IS balance now" (was: compact ≤ balance) · giants-apart now pinned under `spread` · weekendsNeedingAttention on the NPH shape now flags nothing (was: Dec 12–13 tight, a weekend the compact plan does not use). planner-venues.test.ts — the home-vs-hall case split into "buys courts to keep the month on ONE weekend" (compact-first) plus "with the weekends already spread, rented court-days still beat peak" (the old assertion, kept where it is still a real choice) · "still opens a rental rather than strand a game" now pins the one rented court the bundled weekend needs.
- NEW TESTS: capacity.test.ts "the court buffer" (5) · planner-venues.test.ts held-back caption (3) · planner-court-buffer.int.test.ts (5, end to end: PATCH → planner capacity/courts/court-days drop → caption → restore → finalized season 409).
- PHASE SEPARATION (owner ruling: planning surfaces never route to a schedule): step 1's only door out of the wizard, the "Set gender and tier in season settings →" deep link into the season console, is GONE (the add-a-grade field that fixes the empty state is on the same screen); grade rows gained planning currency instead — a quiet "N games" chip per grade. `TeamsStep` no longer takes `leagueId`. AUDIT: the wizard's only remaining outbound links are step 4's public season page and step 5's two "Generate schedule" buttons to `manage?tab=schedule`, which are the sanctioned phase handoff (step 5 IS the scheduling step) — nothing in the wizard links to a team schedule or a fixture page.
- Gates: unit 310/310 (scheduler + seasons) · planner int 69/69 · tsc clean · eslint clean on touched files.
- DRIVES on the live local world (season 160b2f09): verify-plan-flow.mjs 33/33 (5 new court-buffer checks; the buffer write is set to 1 and restored to 0 in the same run, capacity 1674 → 1278 → 1674) · verify-blocks.mjs 32/32 · verify-board-compact.mjs 23/23 · verify-plans.mjs 40/41.
- PRE-EXISTING, not this arc: verify-plans' last check ("only the season's own plan is left") fails because the local world carries a stray SeasonPlan "Our plan" created 2026-08-03T14:24Z — two days before this work, leaked by an earlier drive run. Left in place on purpose (the world is the owner's); deleting that one row makes the drive 41/41 again.

## #67 — 2026-08-06: FULL PLANNER ARC DEPLOYED TO BOX (b6a98e4) — ✅ DEPLOYED
- One deploy covered #63 (buildings arc), #64 (plans-as-documents + world snapshots), #65 (venue model v2 home/pool + bookingStatus + backfill), #66 (courtBuffer + compact-first) PLUS everything after: plan-scoped wizard (018003c), draw-calendar (94ebe1e), solver economics (146038f/627b278), board interactions (a18a8d9/000bfe0), refactor (0c7f0fb), waves A+B (6fe407d/8ec2b2d), summer-world seed script (25fd1e4, NOT run on box), drive re-pins (b6a98e4).
- Sequence run: deploy.sh (pulled b6a98e4, built, restarted, web 200) → prisma db push (box DB in sync, verified second run) → backfill-venue-roles.ts.
- ⚠️ BACKFILL RESULT: 0 box seasons given a home gym (no fillOrder/isPrimary signal on box venue rows) — all 4 seasons "left renting everything" per the script's no-guessing rule. Box planner boards will price everything as rented until an operator marks a home gym (one click, step 2 "Make this the home gym"). Owner to decide per season.
- NOT done on box: seed-summer-world.ts (local demo world only; would need running ON the box to pass its localhost guard — owner decision, writes to live box DB). apply-njc-defaults also still pending for box world (#63 note).
- Neon: still pending with #24+ (all schema through courtBuffer needed there too).

## #68 — 2026-08-07: CONSOLIDATED WAVE (owner's 9-issue analysis, all agreed 08-06) — ✅ DEPLOYED to box (28f3ca3, owner's word this session; box HEAD verified, web 200)
- A1 deliberate-0 law: `Division.expectedTeams` null = never estimated, a saved 0 is an answer. planner.ts tracks it per grade cluster (`source: "expected"` the moment any division holds a saved number, zero included), `withUnitTeams` stamps `source` on plan-world writes, and step 1 seeds steppers off `hasEstimate` — minus-to-0 survives the debounced save AND a reload. The reseed that rides every save's response now carries dirty (mid-edit) grades over instead of clobbering them.
- A2 old plans render like new: `PlanSession.readsPlanWorld` splits DRAW from WRITE — steps 1-2 draw ANY non-active plan's own world, the read-only reference included (the board always did). GET plans/[planId] heals null-settings plans by snapshotting `currentSettings` forward, same answer PATCH always gave them.
- B1 the URL carries the plan: `?plan=` + `?step=` kept true via replaceState on every step, restored once on load (only if the plan still exists). The chooser lives on step 1 ONLY; steps 2-3 with nothing open show pointer cards (`step2-plan-pointer`, `board-plan-pointer`) that walk back to step 1.
- B2 one visible chooser/create flow at a time on step 1: header chooser only once a plan is open; the empty-state card is the chooser when nothing is. NOTE: no picker or floating dialog was found OUTSIDE the wizard (plan-tab is a stage rail only) — if the owner meant a different surface, it still stands.
- C1 playoff fence is DEAD on the board (`fenceWindow` verb, `fences` state, `withWindowPhase(s)(InWorld)`, `fencedWindowLabels`, the fence button and the playoff band all deleted). Playoff weekends are a SEASON setting: sessions PATCH accepts `phase`, Sessions tab gained a Mark-as-playoffs toggle (`session-phase-toggle`). Dates fully excluded: venue-grid claims a PLAYOFF session's Saturdays but emits no column (no ghost can reopen the date), `planStateFrom` drops old documents' fenced windows whole — no bands anywhere.
- C2 each board month folds its leading run of 2+ unused dates into one thin `ghost-collapse` row (count + date range); tap opens, `ghost-collapse-hide` folds back, anything armed or dragging auto-expands every month so drop targets always exist.
- C3 DrawHero is compact after the first draw ever in that browser (`localStorage planner-drew-once`, `data-size` full|compact); the explanation moved into a `draw-how` popover.
- C4 DriftLine deleted from step 3; drift speaks plainly in the activation confirm and the post-activation notice carries the redraw offer.
- D1 Advanced (`venue-advanced`) on step 2 exists in BOTH flows, hidden only when read-only; on plan worlds VenueEditor shows the physical-courts manager only (`showHours=false`) — a plan's hours stay the card's one range, and the courts list is a building fact in every world.
- D2 tier sweep: plan-picker's local QUIET/PRIMARY constants replaced by the shared BTN_* tiers; deleted dead controls: `PlanChooser` busy/compact/onBeforeChange props, `PlanEmptyState` busy, `GradeChip` diffTone/caption (+ the compare-mode render branch), `COPY.opened`, weekend-card stranded-prompt ad-hoc styles. Candidates found NOT deleted: `ActionPopover.open/onOpenChange`, `CountChip.className` (designed API surface, listed for a later look).
- E jitter law: shared `NoticeSlot` (plan-ui) — transient messages always occupy their space (invisible when empty, hoop on error, aria-live). Wired on all five steps: `step1-notice`, `step2-notice`, `board-notice`, `step4-notice`, `step5-notice`.
- GATES: tsc clean · scheduler units 417/417 + venue-grid re-pinned 17/17 · planner int 76/76 · eslint clean on every touched file · drives re-pinned and green: verify-plan-flow 67/67, verify-plans 71/71, verify-board-compact 35/35 (switch-gym checks replaced with a manual moveSection tap-and-tap pin), verify-blocks 140/141 (the 1 red = zero session-backed ghosts on this board, a world-state fact the script skips gracefully — not code) · evidence drive verify-wave-consolidated.mjs 27/27 with 17 screenshots in scratchpad/shots-wave/ (old+new plan steps 1-5, minus-to-0 before/after reload, one-chooser, collapse row).
- Evidence nuance recorded honestly: in the local world the imported reference IS the active plan, so steps 1-2 show `data-world="season"` for it — architecturally correct (`readsPlanWorld` is gated on non-active), not a miss.
- Box deploy: DONE 2026-08-07 on the owner's word ("deploy") — deploy.sh pulled 28f3ca3, built, restarted, sidecar OK, web 200; box HEAD verified 28f3ca3 as sportshub user; https://ysportshub.com 200. No schema change in this wave (SessionPhase existed), so no box db push needed. Neon unchanged, still pending with #24+.

## #69 — 2026-08-07: OVERNIGHT STAGES 0-2 (owner: "finish by morning, auto-approve, no input needed") — ✅ DEPLOYED to box (b2c5ef4; box HEAD verified, web 200, SessionRound + friday columns confirmed present on box DB)
- PLAN DOC + ASSUMPTIONS: docs/roadmap/planning-stages-2026-08-07.md (read the assumptions section first — deploy-included interpretation, booked-dates choice, rounds optionality, public surfaces untouched, old scheduler table kept reachable).
- STAGE 0 (2984e3b, 7ef583d): season dates define the supply (sessionless weekends outside the declared dates are never offered; real sessions keep their columns wherever they fall) — with the owner-ordered end-date trim to Mar 14 (done on LOCAL and BOX DBs), the March tail is gone. Booked-dates picker now also on the season path (the active plan included), writing confirmed bookings through the per-session venue endpoint. The Plan Your Season tab is a DOOR into the wizard: stage-rail home screen deleted (plan-tab.tsx), ?tab=plan redirects, wizard back control lands on the season.
- STAGE 1 (ecc9f20): SessionRound model (ADDITIVE: SessionRound table, SeasonSession.roundId SetNull, Season.fridayStartTime/EndTime) — "sessions are announced, weekends are booked". Rounds optional per league; zero rounds renders identically (drive-pinned). Settings gains "Sessions & rounds" (SessionsTab moved out of Schedule tab, playoff toggle with it; rounds editor + one-tap group-by-month + per-session round picker). Board columns wear a shared round's name. Friday window joins the org→season cascade and all copy/arithmetic reads it (NJC/NSC Fri-Sun constraint).
- STAGE 2: the plan→scheduler contract. Reproduced the owner's failure (394 games poured onto zero-slot sessions, "0 court-slots" warnings). Engine fix in generate.ts: A WEEKEND WITH NO COURT TIME IS NOT A GAME DESTINATION — zero-slot REGULAR sessions contribute no demand, take no games, redistribute their share; explicitly-planned-but-slotless sessions get a named warning; all-slotless seasons keep the old cold-season diagnostics. Result on the journey world: unfittable 394 → 27 (the 27 are real over-demand on named weekends). Activation already materializes attachments WITH courts+hours+bookingStatus (verified in code — attachVenueToSession path). Scheduler screen inverted to SUMMARY-FIRST (schedule-tab.tsx + summary-panel.tsx): verdict header (teams · scheduled-of-expected · flagged teams · issues) → per-team fairness counts sorted worst-first → team drill-down reusing the games table → "Show all games" keeps the old table one click away. verify-schedule-board.mjs re-pinned for the reveal (currently cannot run start-to-end on the journey world: no committed games — pre-existing precondition, not this arc).
- GATES: tsc clean · scheduler+seasons units 434/434 · planner int 76/76 · schedule int 19/19 · verify-plan-flow 66/66 (re-pinned for tab-door) · live rounds API round-trip (create → assign → planner carries the name → delete; world clean) · live preview evidence shots scratchpad/shots-wave/stage2-summary.png + stage2-drilldown.png.
- SCHEMA: additive only (SessionRound + SeasonSession.roundId + Season.fridayStartTime/fridayEndTime). Local pushed + client regenerated. BOX push + deploy: see status line. Neon still pending with #24+.
- ROLLBACK: pre-arc box sha 28f3ca3 (revert commits + redeploy; schema additions are inert if unused).

## #70 — 2026-08-07: ONE-CALENDAR WAVE (owner rulings, parallel build, TIMED) — ⏳ LOCAL, deploy on owner's word
- Rulings + design: docs/roadmap/one-calendar-wave-2026-08-07.md. Build ran as the owner's timed parallel experiment: 3 Sonnet builders in parallel (sandbox semantics 43m · one button 23m · denominators+exclude 9m), Fable seam review between rounds, then 5 parallel Sonnet agents (4 drive re-pins + evidence).
- WRITE-THROUGH DIED: every plan (active included) edits only its own document; GET plans/[planId] serves stored settings for all; PATCH write-through removed; steps 1-2 with nothing open are read-only; season substrate actions (add grade/gym, create weekend, booked-dates picker) stay season-level by design.
- ONE DOOR: POST plans/[planId]/generate — preflights exactly two plain-words checks (games promise, weekend fit), {needsConfirm, findings} writes nothing, confirm applies world+calendar, flips default, regenerates unplayed games, lands on the schedule summary. Buttons: step5-generate + generate-season (board header), label "Use this calendar and generate the schedule". "activate" purged from every user-facing string (incl. two API messages the drives caught).
- AUTOSAVE: 1s debounce + unmount flush + flush-before-generate (Fable seam fixes); undo stack SURVIVES autosave (drive finding — clearing it a second after every edit gutted the no-revert design); Save to/Save as new/Use for the season/Undo changes deleted; "Save a copy" in the picker row menu + reference board.
- REMOVAL: grade rows removable from a plan (withUnitRemoved; season fold-in = restore); per-team exclusion end to end — world.excludedTeamIds speaks Team.id everywhere (evidence pass caught the submission-id/team-id mismatch that silently dropped every exclusion; sanitize + loader fixed).
- HONEST DENOMINATORS: "used on N of the R weekends this season runs"; no unused-weekend nagging.
- KNOWN GAPS (queued, deliberate): court corrections + board booking annotations are working-copy-only for ALL plans now (no world persistence helper yet; pre-wave they persisted only via active write-through) · generate blocked on FINALIZED+ seasons (copied from activate; step-5 copy implies otherwise — owner ruling needed) · board-compact flagged a latent drive flake if a non-reference plan ever becomes active mid-drive.
- LOCAL DATA REPAIR during verification: local imported reference plan's stale settings (courts frozen at 1 from the owner's 08-02 testing moment) nulled → app's own heal rebuilt 6/6/3.
- GATES: tsc clean · 435 units · 84 int (planner+schedule; one test re-pinned: the active plan keeps its stored world) · drives GREEN: plan-flow 89/89 x2 · plans 86/86 solo · board-compact 28/28 x3 · blocks 144/144 solo · verify-one-calendar 38/38 (new; shots scratchpad/shots-wave/onecal-*.png). Drive-round findings fixed same-day: activate wording in 2 API strings · undo survives autosave · stale save copy · exclude id-space (Team.id end to end) · THE AUTOSAVE STALE-CLOSURE RACE (save resolving after a newer edit reverted it silently, then persisted the damage — render-mirrored staleness guard in savePlan; root-caused live by the blocks drive).
- TIMING (owner asked): estimate 2.5-3.5h parallel; ACTUAL 17:29 → 19:51 = 2h22m wall. Round 1 (3 parallel builders) 43m · Fable seams 34m · Round 2 (5 parallel drive/evidence agents incl. two real bug hunts) 92m · close 13m. Sonnet this wave ≈ 3.0M tokens across 8 agents; Fable = orchestration + 6 seam/finding fixes + reviews.
- Commits: f16b715 (round 1) · 956c144 (round 2 + fixes). Rollback: revert both, redeploy prior sha.

## #71 — 2026-08-07/08 night: SCHEDULER QUALITY — burden score + travel law (owner rulings) — ⏳ LOCAL, deploy on owner's word
- Arc doc: docs/research/scheduling-approaches-2026-08.md (§Built 2026-08-07 night has the before/after table).
- 727352f: universal per-team BURDEN SCORE (weights 20 split / 20 games-short / 8 monster / 5 b2b / 2 mid) + fully sortable fairness table (per-column sort, search, division chips, sticky header) + schedule-page cleanup (capacity planner + venues panels off the schedule tab; readiness = one thin line only when blocked).
- e9d406c TRAVEL LAW: a split day must leave time to drive (cross-gym gap ≥ 2 slots or it's an "undriveable split", weight 30, "No time to drive" column when nonzero; cross-gym gaps exempt from b2b/wait tiers everywhere — engine, report, table). Judge re-keyed to the burden hierarchy incl. one 20/30 split currency + max-splits-per-team; fairness hand-down learns same-day cross-time court+clock swaps (shape-guarded). Clean-sheet on live world: undriveable days 22→2, max splits/team 2, burden points 1661→1190 (−28%). Residuals queued for LNS (item B): 2 unwidenable tight days, 6 teams at 2 splits.
- GATES (testing-phase light): tsc clean · scheduler units 47/47 (report re-pinned to the travel law + new wide-gap case) · verify-plan-flow 89/89 (taken-cells check re-pinned to presence, not count — season shortening left only 2 NJC weekends in span).
- Owner's NEXT ARCHITECTURE RULING (recorded, not built): generate the WHOLE season always; publish staged (week/session); lock published/past sessions; minimal-change re-solve for drops/adds/manual requests; session = month-anchored round vocabulary on the Schedule page; kill the "week two" default landing.
- 1584f06 (same night, owner live session): POST-WINNER POLISH PASS — owner challenged "why can't a 2-split team swap with a zero team"; brute force proved 18 legal trades the in-flight pass missed. flattenSplitLoads: trades = whole-slot swaps on the finished schedule, table-currency guards, every affected team must end below the donor's old load (partner-only guard ping-ponged the split via the donor's opponent — measured burning all 32 passes for zero). In-flight pass: 6→64 rounds + table-currency guards. LIVE RESULT: splits/team {1:20,2:7,3:1} → {1:30,2:3}, top burden 60→42, 0 undriveable. 3 leftover 2-split teams provably have no pairwise trade (scripts/analysis/polish-debug.ts) — LNS (plan B) territory. Gates: tsc, 47/47 units, live button pressed twice (726/0).

## #72 — 2026-08-08 overnight: SCHEDULER V2 BUILT + CUT OVER (owner: "build everything, make the assumptions") — ⏳ LOCAL, deploy on owner's word
- FULL REPORT + printed assumptions: docs/roadmap/scheduler-v2-build-2026-08-08.md (READ FIRST). Requirements + clean-room design: scheduler-v2-requirements/-design-2026-08-08.md.
- Engine: apps/web/src/lib/scheduler-v2/ (world/audit/matchups/ledger/cell/season/proposal). Gates on live world: 0 out-of-gym, 0 splits, 725 games all teams exactly 10, ZERO back-to-backs, byte-identical determinism, 14.7s. A4 drop-a-team: all whole, 73% untouched.
- Cutover: one-button plan generate + whole-season preview run v2 (legacy modes still v1); schedule tab defaults to whole-season (week-two landing dead); capacity panel off the schedule page; fairness table repriced to the ladder (b2b 50, 5hr+ 6, 3-4 waits 0).
- Gates: tsc + eslint clean · 58/58 units (11 new v2 incl. brute-force matching optimality) · verify-plan-flow 89/89 · live button + live preview verified (725/0/0 warnings).
- NO schema changes. v1 untouched (rollback = revert the two route edits). publishedAt does NOT pin yet (activates with staged-publish UI — the one H5 deviation, printed in the report).
- Local DB now holds a v2 schedule (owner's table top score 42 → 12 → mostly 0 after reprice).
- #72 addendum (owner audit, ~02:20): (a) early/late were NEVER in the table's burden score (any version) — now they are, plus two-date weekends (6) and 1-slot gaps (1); report.ts gained gapOneDays + twoDateWeekends. (b) Engine's early/late definition was the booked grid's phantom edges — rebuilt to live per-(grade,day) ACTUAL first/last tip-off (matches the report's division-scoped edges); regenerate: two-date weekends 34→10, burden spread 0-11 (was all-zeros display). (c) THE REAL week-two landing culprit: the schedule tab still rendered the "Session by session (Most leagues)" chooser card — removed outright with the session picker (mode hardwired whole-season). Re-pin debt: verify-league-tuneup + snap-stage2 + verify-schedule-board reference the removed chooser. (d) Structural fact: teams in 2-3 team divisions ARE their division's first+last game most weekends — their early/late tallies are honest but equal within their cohort.

## #73 — 2026-08-08: PLAYOFFS v2 — structure now, teams later (owner go: "that's something we can build") — ⏳ LOCAL
- Research-grounded (audit doc §4: NPH 24-25 real brackets + industry): scheduler-v2/playoffs.ts — buildBracket (byes = nextPow2−field, top seeds, recursive 1v8 pairing, 3rd place), buildPools (snake pools of 4-5, gold QF/SF/F + silver/bronze crossovers, everyone ≥4 games), buildPlacement (no-elimination, circle rounds), placeWeekend (shared finals-weekend courts, per-division tier cascade, rest ≥1 slot, NO b2b even at tournaments). 23 units green (incl NPH's real Gr8 14-team case).
- Schema ADDITIVE (local push only): Season.playoffConfig + Season.playoffPlan. NO Game changes: unresolved games live in the plan JSON; real Game rows materialize only when both participants are known (TeamSnap/LeagueLobster precedent).
- API /api/seasons/[id]/playoff-plan GET/PUT/POST: per-division config (qualifiers/format/3rd-place/weekend) with bin-packed default weekend assignment; plain-words capacity preflight BEFORE writes; seeds resolve ONLY when a division's regular season is fully played (half-seasons never fake seedings).
- UI: Playoffs tab "Playoff plan" section — live per-division config w/ derived preview (games/byes/guarantee), generate button, schedule table (real names or "Seed 3"/"Winner of G2").
- DEMO WORLDS: live pre-season league → 141 games all placeholders. NEW twin scripts/demo/seed-nph-endseason.ts ("NPH Showcase League — End of Season", 725 COMPLETED deterministic-scored games): 141 games, 19 divisions seeded from real standings, 59 materialized w/ real names (Malton Sting vs GYBA Gryphons, Round of 16), 82 Winner-of placeholders. Twin ids in script output; re-runnable.
- Deferred: WINNER/LOSER/POOL resolution as results land (the resolve re-run), consolation ladders, public TBD surfaces, playoff publish gating.

## #74 — 2026-08-09 overnight: PLAYOFF UI REDESIGN + FULL BOX DEPLOY (owner: "build it and finish it... deployed on both local and the remote server") — ✅ DEPLOYED box 46bc4be
- Grade-level playoff plan (final model): units = ageGroup (7 cards not 19), merged seeding across conference divisions (wins/losses/diff), guarantee-driven format derivation (2 = bracket + NEW consolation round — the modern NPH shape), approved plain-sentence UI (collapsed cards, 3 questions, Advanced, byes only as words, weekend view w/ gray placeholders). 24 units green; both local worlds verified (166 games; twin 55 real-name).
- BOX (explicit owner authorization this session): deploy.sh → 46bc4be, schema in sync, **TZ=America/Toronto added to /etc/sportshub/web.env** (was UTC — the date-shift blocker) + restart, web 200. Box Showcase season GENERATED via v2 server-side (scripts/analysis/generate-v2-season.ts): auditor first REFUSED (Junior Girls had no hosted weekends — the Retro-Elite failure class caught in production); ASSUMPTION under blanket authority: hosted JrGirls on the 5 roomiest booked weekends joining each weekend's busiest gym; then **725 games, 0 b2b, Sat 393/Sun 332 (TZ proof)**. Box twin seeded ("NPH Showcase League — End of Season", 725 completed games) + LeagueOwner role. Playoff generate on box = owner's morning click (identical code/data shape verified locally).
- Worlds kept per owner: live Showcase (pre-season playoff placeholders) + End of Season twin (real-name playoffs) on BOTH local and box.

## #75 — 2026-08-09 overnight #2: DIVISIONS FROM REAL NUMBERS — ✅ DEPLOYED box b981973
- Owner ruling: divisions can't be defined at league creation ("how could you decide when people are not signing up?") — grades at creation, DIVISIONS AT PLAN TIME from real counts. Step 1 grade rows gain "Run as N divisions" (plan-sandbox intent, autosaved); the one button materializes: Division rows created/reused, teams snake-dealt deterministically (by name; strength-deal + drag board = queued follow-up), target divisions inherit the grade's gym per hosted weekend, then v2 generates. Live-verified: Grade 7 11 teams → 5+6 across two divisions, 725 games 0 b2b; plan-flow 89/89.
- Box redeployed b981973 (first attempt blocked by an scp'd untracked file — removed). Local demo state: the live season's Grade 7 CARRIES the 2-division split as a feature demo (undo = re-merge, not built yet — one-way for now).
- QUEUED from the approved option sheet (not tonight): Setting A scheduling strictness (Locked/Prefer/Open + engine pooling + auditor consistency), Setting B playoff per-division lock, bye-gauntlet format, fine-tuning drag board + re-merge, register-into-grade entry point.

## #76 — 2026-08-09 overnight #3: DIVISIONS AT SCHEDULING TIME (full arc, owner-confirmed design) — ✅ DEPLOYED BOTH, box 882b8c2
- Owner rulings baked in: divisions are a SCHEDULING-phase decision ("planning is how many gyms to get"); "Yes, build exactly that" = one Divisions card on the Schedule tab → guided dialog (grade → how many + names → deal randomly or assign manually → review → divisions REAL immediately); "Full setup in one arc" = Setting A cross-division play + Setting B playoff pooling; bracket visual = Bracket | Schedule toggle. Hard rules memorialized in memory `feedback_fully_baked_ux_first.md`.
- Shipped: `lib/divisions/formation.ts` (split/merge/rename from approved teams; hosting replicated; empty divisions deleted = merge) + `/api/seasons/[id]/divisions/formation` GET/POST · `division-setup.tsx` dialog on Schedule tab (step-1 planning selects REMOVED — that page is calm again) · `Season.gradeScheduling` Json {age: LOCKED|PREFER|OPEN}: world.ts pools grade → one `grade:<age>` unit, PREFER = +250 cross-division matchup cost, auditor BLOCKs a pooled grade split across two gyms in one weekend · `playoffConfig[age].pooling GRADE|DIVISION` → per-division brackets named by real division · Playoffs tab Bracket|Schedule toggle (round columns, gray placeholders until seeds resolve) · legacy v1 "Generate playoffs" wizard RETIRED from the tab (API left intact).
- Gates: tsc 0 · eslint 0 · scheduler-v2 units 24/24 · plan-flow drive 89/89. Live-verified LOCAL: formation GET/POST round trip (merged the Grade 7 demo split back — merge path proven, world restored, regenerated 725 games 0 b2b) · Setting A: Grade 11 PREFER regenerate → 79/120 same-division vs ~22% random baseline, then cleared + regenerated → 120/120 same-division · Setting B on twin: Grade 11 → 4 per-division brackets (ARETE/DMV CHILL/GAME SPEAKS/PRIME), 57 games materialized · bracket view screenshot-verified.
- BOX: deploy.sh → 882b8c2, web 200; `gradeScheduling` column confirmed in box DB (deploy's db push covered it); twin parity applied on box (Grade 11 pooling DIVISION + plan regenerated, 57 materialized, 163 plan games); formation GET verified on box pre-season season f4c3599c.
- DEMO STATE both servers: pre-season world all defaults (every grade LOCKED, Grade 7 back to one division); END-OF-SEASON TWIN carries Grade 11 playoff pooling = DIVISION as the Setting B showcase (flip back via the Divisions dialog).
- QUEUED (unchanged): bye-gauntlet format, strength-aware dealing, drag board, register-into-grade, staged publish, legacy kill-list on schedule tab (Shuffle/Scenarios/Delete all/Commit buttons), weekend rhythm config.

## #77 — 2026-08-10 overnight: DIVISIONS LIFECYCLE v3 (owner-approved final design) — ✅ DEPLOYED BOTH, box e85bfb2
- Design doc (approved via 2 AskUserQuestion rounds + NPH deep forensics): docs/roadmap/divisions-lifecycle-design-2026-08-09.md. Rulings: equal pools only · demo world resets to NO divisions · divisions free until schedule publish then LOCKED (new teams join existing) · regular-season cross-play = per-grade YES/NO (NO=LOCKED, YES=PREFER; OPEN retired from UI) · playoff default = one championship merged seeding · v1 ships DIVISION_FIRST opening round · whole-platform polish sweep = next arc.
- NPH 25-26 forensics (saved API dumps, all 4 grades): every grade ONE connected scheduling pool; big divisions 50-64% intra, small/untagged cross freely; playoffs = merged championship w/ division-flavored day 1 (Gr10: ARETE×4/PRIME×6/GS×5 openers) crossing on day 2.
- Shipped: card = grade rows ([Manage] per split grade + one [Set up divisions] for unsplit ≥6; lock state) · setup door (checkbox unsplit grades → per-grade shape/placement/drag board/yes-no) · manage door (seeded board, inline rename, add/remove, merge, stale-schedule banner) · scheduling-gate copy · formation hosting SPREADS new divisions across the weekend's booked gyms (all-in-one-gym made split 42-team grades unschedulable) · playoffs calm pre-season state + divisionFirstRound1 + Advanced "Opening round" control · **PUT playoffConfig now MERGES** (full replace silently wiped grade pooling keys — found when my own test nuked Grade 11's setting) · visual pass (tinted columns, division identity dots, no white-on-white).
- Verified LOCAL: collapse → API-split 4 grades → hosting spread (4 divisions over 3 gyms) → generate 725 games 0 b2b 0 long-gaps in 23s · YES lean 57% same-div (~24% random) · NO fencing 210/210 · DIVISION_FIRST twin Gr10 day 1: 5/16 → 12/16 same-division · UI drive 17/17 (gate, both doors, viewport-anchored dialog, drag all directions, rename, merge, lock 422, calm playoffs) · units 27/27 · plan-flow 89/89 · tsc/eslint 0.
- Seeders: seed-journey emits ONE division per grade; twin seeder self-splits big grades (conference names, snake) + sets Grade 11 pooling=DIVISION; scripts/demo/collapse-preseason-divisions.cjs resets a live world (refuses if published games exist).
- DEMO STATE both servers: PRE-SEASON world at the scheduling gate (no divisions, no games — owner demos: gate → Set up divisions → drag → yes/no → generate → publish). TWIN: locked divisions card + Grade 11 per-division brackets + Grade 10 one-championship with DIVISION_FIRST day 1 (12/16 same-division), 163-game plan on both servers.
- NEXT ARC (owner-picked): whole-platform polish sweep against the §3 visual rules.

## #78 — 2026-08-10 daytime: OWNER FEEDBACK BATCH (queue mode: explain→approve→build) — ✅ LOCAL 057e90a, box deploy pending owner word
- New working mode memorialized: error reports = questions (explain only, collect queue, build on batch go) + LIVE EDITING law (no save buttons; pencil→type→blur→saved) in [[feedback-fully-baked-ux-first]] 9a.
- Item 1 GRADE STAYS TOGETHER (owner: "we were already scheduling the same grades in the same gyms... grades should stay together"): divisions inherit the grade's gym per weekend EXACTLY; both auto-placement attempts deleted; world re-homed whole-grade (66/108·70/108·9/54, nothing over); generate clean NO-CONFIRM 725 games 0 b2b; YES lean 57%, NO fenced 210/210.
- Item 2: step-1 stepper seeds max(estimate, approved) — reality leads; plan wizard AUTO-OPENS an editable plan (active, else newest), read-only reference is a deliberate switch only.
- Item 3: divisionPlans remnants deleted everywhere incl. generate-route auto-materialization (divisions can never be auto-created again).
- Item 4: step 5 = "Finish planning: use this plan for scheduling" → POST activate → Schedule tab. Generation left the wizard.
- Item 5 PLAN SEAM: Schedule tab is plan-aware — journey strip (Plan→Divisions→Generate→Publish), "Built on plan X · change" header, door when no active plan ("Which plan drives this schedule?"), QUICK SETUP one-dialog path (season venues + weekend dates + hours + games/team → sessions POST × N → plans POST snapshot → activate; no estimates, real registrations). Tournament-style events recorded as future item reusing playoff structures.
- Live rename: ✎ beside every division name on the card; blur=autosave via formation PATCH; em-dash sweep of all NEW copy (platform-wide em-dash sweep queued into polish arc).
- Gates: tsc/eslint 0 · units 27/27 · plan-flow drive UPDATED for new rulings 89/89 · door drive 9/9 · divisions drive intact. Drive-caused Grade 10 misnames found+fixed (exact aria-label selectors now).
- Box deploy NOT run (owner word pending).

## #79 — 2026-08-10 evening: QA T-LIST BATCH (owner-triaged one by one) — ✅ LOCAL b0cf7c2, box pending
- Owner triage of QA log T-001..T-011: T-003/004 CLOSED (already shipped Aug 7-8 — owner's plan "New 2" data proved backups attach+fill+rent-ask works; QA tested the pre-wave build) · T-007 CLOSED BY DESIGN (sessions are monthly; cross-month moves don't exist as a concept) · T-010 verified clean on box · T-001/002 deferred until deploy+reseed · T-005/006/008/009/011 BUILT + owner's add-gym dropdown bug.
- Shipped: legacy kill-list (Shuffle/Scenarios gone, Delete all typed guard) · season-calendar card = grade × weekend-date grid w/ green checks (owner's design) · gym palette sky/violet replaces gold/hoop · rail collapsed-by-default tab (all sessions visible) · TIGHT_RATIO 0.95 badge restraint · hover-reveal chip anatomy · slim empty weekends · tinted board surface · casing pass · venue-selector stacking fix.
- Gates: tsc/eslint 0 · planner units 153/153 (one test re-pinned to the new tight line) · plan-flow drive 89/89 (rail-tab adapted) · card + board screenshots.
- QA log annotated in place with dev responses. W/D/QA-lists (tester-wishlist 07-28, qa-triage 07-23) NOT started — owner will direct after this batch.

## #80 — 2026-08-10/11 late evening: SLIM BOARD + ONE-WORD-PER-GYM PALETTE — ✅ LOCAL c976a0c, box pending
- Slim board redesign implemented EXACTLY per approved artifact 126519af (70de505): compact `⠿ Gr 7 (12)` chips w/ floating hover ✕ + tooltip, gym boxes outlined in gym colour, two-number law (games at weekend corner, courts+free at gym rows), Redraw single menu, What-is-left pull-out tray w/ pulsing dot, always-visible grips on chips AND gym/section handles.
- Colour saga (two failed guesses → law): (1) blue-600 beside play/indigo read as one blue — REVERTED 0250ec7; (2) root cause named: at -50/-300 tints the eye keeps only SIX WORDS (green blue pink brown gray yellow); teal reads green, indigo/sky/violet read blue. LAW: one gym per word, owner-approved from rendered swatch artifact 6d966b4d.
- Final palette c976a0c: home=court green · Six Park=fuchsia pink · Haber=blue · reserves clay brown (NEW design-tokens family, kept far from alert orange/tight yellow) + slate gray. Divisions card follows. Yellow=tight, red/orange=errors, forever.
- Oct 10–11 "wrong colour" forensics: NOT a colour bug (DOM-verified same class all weekends) — home gym isn't wired that weekend (top slot ≠ green) + the one tight-gold card wash. Both queued: pin home-gym off-this-weekend line on top · drop full-card gold wash (border+pill only).
- Also queued (owner "something to consider"): self-assigned gym colours via gym ⋯ menu (five words, no sharing).
- Gates: tsc/eslint 0 · plan-flow drive 89/89 (×3 runs) · live-board screenshots matched artifact each time. Dev server restarted (tailwind config change: clay family).

## #81 — 2026-08-11: NATIONAL CIRCUITS SEEDED AS PLAYABLE LEAGUES — ✅ LOCAL ONLY, box pending
- New `scripts/seed-national-circuit.ts` (idempotent, hard local-only rail): builds the REAL National Junior Circuit + National Senior Circuit as fully playable 2026-27 demo leagues under the NPH org, from the TeamLinkt census (docs/research/census-njc-nsc-2025-26.md) — all 51 NJC + 32 NSC real team entries across 57 club tenants (existing tenants adopted by name, 20 created `njc-*`), fictional rosters (10-13/team), one division per season (Junior/Senior — prep programs field one team per level, no per-grade split).
- Schedule generated + published through the real scheduler v2 path (loadSchedulerInput + generateSchedule): 255 + 160 games, exactly 10 per team, five Fri-Sun blocks at Six Park East courts 1-6 (Fri 17:00-22:00, Sat/Sun 09:00-18:00) + a games-less National Championship block (Mar 12-14, PLAYOFF phase). NSC scheduled after NJC so the shared-venue busy-bookings mechanism interleaves both circuits in one building — zero court overlaps verified against ALL seasons.
- Calendar: real blocks Oct 16-18, Jan 15-17, Feb 12-14, Mar 12-14 kept; Nov and Dec sessions sit on Nov 27-29 / Dec 18-20 because the seeded Showcase schedule already holds Six Park on the circuits' real Nov 14-15 / Dec 12-13 weekends.
- Gotcha captured in the seed: SeasonSessionDay dates must be LOCAL-midnight instants — the engine sets slot times with local setHours, so UTC-midnight day rows under TZ=America/Toronto land games a day early. Run seeds with `TZ=America/Toronto`.
- Verified over HTTP as owner-nph@sportshub.demo: manage consoles + public /league pages 200, games render with real times, both leagues listed in /leagues.
- Box: NOT seeded (local DB only, per task). Re-run the script on the box only on owner instruction.

## #82 — 2026-08-11: NATIONAL CIRCUITS RESTAGED INTO TWO LIFECYCLE STATES — ✅ LOCAL ONLY, box pending
- Owner wants to drive both product journeys himself, and #81's FINALIZED-with-schedule state locked the planner out (FINALIZED/IN_PROGRESS are LOCKED_SEASON_STATUSES). `scripts/seed-national-circuit.ts` now stages each league (idempotent; re-run reproduces both states):
- **NJC = pre-season at the planning gate** (mirrors the Showcase upcoming season's gate: REGISTRATION status, one division per group, gradeScheduling/playoffConfig/playoffPlan cleared): 51 teams approved + paid with locked rosters, ZERO sessions/season venues/games/saved plans. Plan Your Season wizard opens at step 1 with 51 approved Junior teams and no gyms; POST + DELETE /api/seasons/:id/plans verified live.
- **NSC = end of regular season, playoffs not planned**: all 160 games COMPLETED with deterministic prep-level scores (endseason-twin hash pattern, 45-84, zero ties), season IN_PROGRESS, standings full (e.g. BCP Regional 8-2), Mar 12-14 National Championship session kept empty and offered by the Playoffs tab as the planning entry (playoff-plan GET: plan null), public page renders finals.
- Verified over HTTP as owner-nph: NJC manage + /plan wizard 200, schedule API 0 games; NSC manage/standings/playoff-plan/schedule/public all 200 with the right data.
- Box: NOT seeded (local only). Same runbook action as #81 if the owner ever wants it there.

## #83 — 2026-08-11: NATIONAL CIRCUIT RESTRUCTURED TO ONE LEAGUE, TWO AGE UNITS, TWO SEASONS — ✅ LOCAL ONLY, box pending
- Owner ruling: the circuit is ONE league; NJC/NSC are its AGE DIVISIONS like the Showcase's grade groups. `scripts/seed-national-circuit.ts` rewritten (idempotent end-state): deletes the two legacy leagues, builds league "National Circuit" under the NPH org (owner-nph).
- Units modeled the Showcase way: Division.ageGroup carries the short unit chip ("Junior"/"Senior" — planner builds `age:<ageGroup>` unit keys and labels from ageGroup), Division.name carries branding ("Junior (NJC)" 51 teams, "Senior (NSC)" 32). Same 83 Team rows shared by both seasons.
- Season "Fall/Winter 2026-27" = planning gate (REGISTRATION, 83 approved+paid submissions with locked rosters, zero sessions/venues/plans/games, planning fields cleared). Wizard step-1 world verified: units [age:Junior 51, age:Senior 32]; throwaway plan POST+DELETE 200.
- Season "Fall/Winter 2025-26 (completed)" = end-of-season twin (Showcase twin's "(completed)" label + IN_PROGRESS): 415 games (255 Junior + 160 Senior) on the circuits' REAL 2025-26 blocks at Six Park East (Oct 10-12 … Feb 13-15), all COMPLETED, hash scores 45-84, zero ties, per-team exactly 10; per-unit standings verified (Junior 51 rows, Senior 32); Mar 13-15 championship session empty, playoff-plan null so the Playoffs tab offers planning.
- /leagues and /org/north-pole-hoops list only "National Circuit"; old league APIs 404. All pages 200 as owner-nph.
- Box: NOT seeded (local only).

## #84 — 2026-08-11: BOX DEPLOYED 88a2d24 + National Circuit seeded on box DB (owner word: "can you deploy it on the box")
- Code: deploy.sh clean, "Deployed 88a2d24", web 200. Covers everything since 2d0d2a1: QA T-list batch (#79), slim board + one-word-per-gym palette + two-line gym boxes (#80), demo refresh w/ frozen /demo/classic, National Circuit seeder (#81-83).
- Data: seed-national-circuit.ts run on box DB (TZ=America/Toronto), 18s: one National Circuit league, twin 2025-26 (415 games, standings, playoffs unplanned) + gate 2026-27 (83 teams, wizard open). Box ids differ from local (league 6440afbc-50a3-4144-aca0-a7a0f092559f; twin season 6f93ee95-b309-4af6-8475-524818eb616d; gate season 0b0261d4-5319-4046-9872-bf582c63c8c8).
- Verified over HTTPS: twin public page renders finals + both branded divisions, gate shows Registration, /demo and /demo/classic both 200.

## #85 — 2026-08-11: KAIS-FEATURES PARTIAL MERGE (owner-authorized after Fable review) — ✅ LOCAL, box pending
- K-001..K-006 cherry-picked from origin/kais-features (base 88a2d24): referee rates in booking UI, capitalization sweep, custom team suffix, split Date/Time with range picker, onboarding guard restored (dashboard/calendar/feed/messages), 13+ child-login invite on add-player success.
- Review fixes on top: em-dash sweep of the merged strings; tier autofill never clobbers a typed capacity; custom suffix trimmed (whitespace-only = none); retarget-to-broadcast clears an untouched ref-specific rate prefill. 08c4b74's package-lock churn and the branch worklog doc deliberately NOT merged.
- HELD FOR OWNER RULINGS: K-007 (required handle amends QA-209 never-blocking; also web/native divergence) and K-008 (parent-email at onboarding amends the event-driven-linking rule). Both stay on origin/kais-features untouched.
- Follow-ups queued: K-005 coverage gap (guard absent from /players, /account etc.), platform-wide em-dash sweep still owed by polish arc.
- Gates: tsc + eslint clean after merge and fixes.

## #86 — 2026-08-11: QA T-013/T-014/T-015/T-016 BUILD (owner-ordered, from the kais-features QA log) — ✅ LOCAL, box pending
- **T-013 referee shifts meet the draft/publish law, both halves.** Accept (`api/referee-requests/[id]`) assigns PUBLISHED games only, counts in-window drafts, and the response/UI say both honestly; the referee now gets their own booking notification (new types `referee_shift_booked`, `referee_shift_games_added` — the count used to go to the league owner ONLY). Schedule publish (`api/seasons/[id]/schedule/publish`) reconciles: newly published games attach any ACCEPTED shift's referee inside the window, and the referee is told. Shared window/assign logic in `lib/referees/shift-assign.ts`. Int test extended (`referee-booking.int.test.ts`, 8/8): accept-over-drafts assigns only published; publish-after-accept attaches in-window, skips out-of-window.
- **T-014 teams-step affordances.** Zero-unit grade rows (the code-verified dead toggle: `withUnitIncluded` matched nothing) render "+ Add this grade" instead — the stepper's own unit-creating restore path, one tap, focus handed to the stepper. Silent-inert pill states (no owned plan, reference calendar, world loading, locked) render visibly disabled with the reason in the title.
- **T-015 audit + fix (the #81 TZ family, in the product path).** Audit: 102/150 SeasonSessionDay rows at UTC midnight (Showcase both seasons, D1, NPA, WNPA) = day-early local renderings + wrong-day engine slots; Summer/National Circuit already local-midnight. Fixed every creation path to LOCAL midnight (`ensureWeekendSession`, sessions API date-only parse, seed-nph-demo, seed-journey); healed local DB via new `scripts/fix-session-day-tz.ts` (dry-run then --apply; **box owes the same run**: `TZ=America/Toronto npx tsx scripts/fix-session-day-tz.ts --apply` — script hard-refuses remote hosts, so run ON the box). Fri/Sat/Sun is law now: `isLeagueDay` in planner-core; `buildPlannerState` + `enumerateSeasonWeekends` drop off-day sessions from planning supply and display (Summer's Midweek Showcase intentionally leaves the planning grid).
- **T-016 consolidation suggestion + owner's T-019 preview-confirm ruling (landed mid-build).** New rail idea "consolidate": lone load in a rented gym + same-month absorption → move quantified in rented court-days, compression trade-off named; ACCEPTING releases the weekend whole (off the plan, booking off the ask sheet, saved into the plan world as chosen:false; one undo restores everything). Rail-wide preview-confirm: first click pins (board dims except the two weekends, ghost strips + before→after fractions on both cards, button flips to "Apply move"), second click applies, click-elsewhere/Escape dissolves; hover previews without pinning. Fixed a real dispatch bug found on the way: the capture-phase dissolve committed between the confirm's mouseup and click (React discrete-lane flush) and un-pinned the button mid-click — the dissolve now skips clicks inside a suggestion row.
- New drive `scripts/demo/verify-qa-t014-t016.mjs` (18/18, self-staging + self-cleaning). Gates: tsc 0 · eslint 0 errors · planner/venue-grid units 443/443 (new: consolidate suite, released-weekend suite, Fri-Sun grid re-pins) · plan-flow drive 89/89 (no re-pins needed) · referee int 8/8 · screenshots (preview state, post-apply, T-014 affordance + disabled pill) in session scratchpad.
- QA log: T-012..T-019 entries imported from origin/kais-features into this branch's copy; dev responses written under T-013/014/015/016 (+ the T-019 ruling note). Box: deploy + the #81-style heal run above; reseed not required.

## #88 — 2026-08-12: FINALIZE REMOVED + DEPARTURE NOTICE (owner rulings) — ✅ LOCAL, box pending
- Finalize state deleted end to end (owner: "a state with no consumer"): route, button, manager UI, badges, schema fields finalizedAt/finalizedById dropped (db push run LOCAL; BOX OWES db push). Submission is the only state the league, the reminders and the draw care about.
- The 5-player legality check moved to SUBMIT (submitTeamToSeason): <5 blocked, 5-7 returns NEEDS_CONFIRM and the client asks plainly, 8+ passes. Reminder cadence and league digest re-keyed to submission-only copy; draw exclusion keys on no-submitted-roster.
- DEPARTURE NOTICE: releasing a club player who sits on a submitted league roster 409s first with the league names; confirming releases, stamps SeasonRosterPlayer.departedAt (new field, same push), notifies each league operator, and the league's roster view badges the row "no longer with the team".
- Gates per owner (quick only): tsc clean; smoke: departure 409 verified live with real data (untouched), dead finalize route 404s, thin-roster submit branches code-read only.
- Ops gotcha captured: repeated dev-server kills leave orphaned next-server/jest-worker processes that poison a fresh .next (MODULE_NOT_FOUND on valid routes). Fix: pkill next dev + next-server + jest-worker BEFORE rm -rf .next.

## #89 — 2026-08-12: QA T-012 REFEREE "MY GAMES" + K-005 GUARD WIDENED (owner-approved, two fixes) — ✅ LOCAL, box pending
- **T-012: `/referee` is a real dashboard, not a redirect.** The "My Games" nav tab used to bounce to the shift inbox, so an accepted shift produced games findable only inside the generic My Calendar. `/referee` now lists the referee's assigned games — next one first (day, time, venue + court, both teams, league + season, agreed per-game rate when the game came from a booked shift), games already worked collapsed below, each card opening `/live/<gameId>` — plus a "Shifts and availability" button (`/referee/requests` keeps its job) and the profile link. Honest empty state points at the shift inbox.
- **One data source.** New `apps/web/src/lib/queries/referee-games.ts` (`getRefereeGames`, `getRefereeAssignedGameIds`) is the shared module: `lib/calendar/my-calendar.ts` now reads its assignment set instead of hand-rolling the same `UserRole` query, so the dashboard and My Calendar's refereeing lens cannot drift (parity law). PUBLISHED games only (T-013's draft law). Rate is read per session day off the referee's own ACCEPTED shift and `Number()`-ed across the wire.
- **Accept confirmation lands where the games are.** `referee_shift_booked` (accept route) and `referee_shift_games_added` (publish reconcile, `lib/referees/shift-assign.ts`) now link `/referee` and say "My games"; the inbox's success banner carries an "Open My games" link and got `role="status"`; the inbox header gained a "My games" link. `referee-booking.int.test.ts` expectation updated to the new link.
- **K-005: onboarding guard widened from 4 surfaces to the whole signed-in platform.** `requireOnboarded` protected only the dashboard layout + calendar/feed/messages pages, so a role-less un-onboarded account could deep-link into everything else. New drop-in `lib/onboarding/section-guard.tsx` is re-exported as the layout of 20 top-level `(platform)` sections (account, browse-leagues, browse-tournaments, clubs, create-test-users, dev, manage, notifications, offers, payments, players, polls, referee, score, seasons, settings, sync-user, teams, trainers, tryouts) — one call site per section, each carrying the reason as a comment. The guard cannot live in the `(platform)` layout because that layout also wraps `/onboarding` (redirect loop).
- **Deliberately unguarded:** `/onboarding` (the flow) and `/family/accept/[token]` — the emailed invite landing a brand-new account is SUPPOSED to reach before it has any role; guarding it would throw the token away. PlatformAdmin stays exempt; signed-out visitors keep the middleware sign-in redirect. No API routes touched (layouts do not wrap route handlers).
- Gates (owner: light): `tsc --noEmit` clean · eslint clean on all touched files · smokes over HTTP against the running local dev server — (1) signed in as `summer-ref-mike@sportshub.demo`, `/referee` 200 rendering "Coming up (11)" + "Games you've worked (38)" against exactly 49 assigned published games, cards showing venue + court + league + season; `/api/calendar/mine` still returns the refereeing lens (16 items in its window) after the shared-module refactor. (2) Signed out, `/teams`, `/account`, `/manage/leagues`, `/referee/requests` all 307 to `/sign-in?callbackUrl=…` as before; signed in and onboarded, `/teams`, `/account`, `/players`, `/settings/profile`, `/referee/requests`, `/calendar` all still 200 (no false positives).
- **Not verified live:** the un-onboarded true positive. The only role-less accounts in the local DB are int-test rows with `passwordHash: "x"` (not loginable) and the smoke brief said create nothing, so the redirect itself rests on the same `requireOnboarded` already proven on the dashboard.
- Box: code deploy only. No schema change, no seed, no backfill.

## #90 — 2026-08-12: PARENT-CHILD LINKING ARC + K-007/K-008 SETTLED (owner design, kid-first) — ✅ LOCAL, box pending
Premise (owner): the platform gets promoted on social, so **kids arrive before their parents**. The primary journey is a 13+ kid signing up, inviting a parent who has never had an account, and the two accounts simply linking. Everything below is built to be obvious rather than whispered.

- **K-007 settled — onboarding is two steps, the handle is a field and stays OPTIONAL.** Cherry-picked Kai's rework (`13b0eba` + `afd81c3`) and reversed his "required handle" ruling: role → profile, with the @handle embedded at the top of the profile step, prefilled from the default reserved at signup. Empty keeps the default; a taken handle is said once ("Pick another, or press Continue again to keep @default") and the next Continue goes through on the default; a network failure saving it is ignored. QA-209's never-blocks rule stands. Kai's save-then-create ordering and back-target rewiring kept.
- **K-008 accepted and PROMOTED — the guardian ask is a first-class block, not an optional field.** The Player profile step carries "Add your parent or guardian" with the reason in plain words (they approve payments and permissions; you need them linked to join anything paid), the email input, and the claim question. Still skippable, never blocking. Kai's post-save send + retry/skip recovery screen kept.
- **THE CLAIM CHECK — duplicate worlds die at the source.** A checkbox on that block, "A parent already added me to SportsHub", sets `preferClaim`. The server then looks for a player row under that email matching the kid's name + birth year (`lib/family/claim-target.ts`); a hit creates a **`CHILD_CLAIM`** invitation carrying the parent's row as `targetPlayerId`, a miss falls through to the ordinary `GUARDIAN` invite. Both outcomes return the same response, so the flow is not an account-enumeration oracle; the copy says only "if that matches, your parent will get a request". On approval the kid's login attaches to the parent's EXISTING row and the kid's duplicate is absorbed.
- **MERGE ON GUARDIAN ACCEPT (owner: "I do like the idea of merging").** When a parent accepts a plain guardian invite and already holds a matching row, the accept page offers a one-click join, defaulted to merging, with "Keep them as separate profiles" as the deliberate alternative. Same machinery as the claim path. `lib/family/merge-players.ts` moves team rosters, offers, tryout/camp/house-league/training signups, season roster entries, 1-on-1 bookings, RSVPs, stat lines and followers (each behind a unique-key pre-check so a move can never trip P2002), and deliberately KEEPS waiver signatures/requests, stories, post tags and playoff-eligibility overrides on the absorbed row (signatures are legal records against a specific row; social content carries its own consent). The absorbed row is stamped `absorbedIntoPlayerId`/`absorbedAt`, soft-deleted, and stripped of its `userId`/`handle` (both unique) — the handle follows the kid to the survivor when the survivor has none.
- **STANDING NUDGE.** Any self-owned player aged 13-17 **by birth year** with no guardian attached gets a calm dashboard banner: why it matters, one button opening one dedicated dialog (nothing prefilled), and a "Not now" that hides it for the session only (`sessionStorage`, comes back next session, never permanently dismissible). Under-13 and 18+ never see it. When a request is already out it reads "Waiting on <email>" and offers to send to a different one.
- **THE MONEY GATE (structural — no card-name checks anywhere).** A 13-17 self-owned account never sees a payment form. `lib/family/money-gate.ts` answers a payable action with either **202 `{routedToParent}`** (guardian attached: notification + email with a deep link to the exact payable thing, `payment_approval_request`) or **409 `{needsGuardian, playerId}`** (nobody to approve yet: the client walks them into the guardian invite). 18+ by birth year pays normally; parents' own flows are untouched. Gated: `POST /api/obligations/[id]/checkout` (also **reassigns `payerUserId` to the guardian**, which is what makes the deep link to `/payments` actually payable — the obligation was frozen to the kid at creation), `POST /api/offers/[id]/pay-intent`, `PATCH /api/offers/[id]` accept when a fee is owed, and the five signup routes when the program costs money (tryouts, camps, house leagues, training sessions, 1-on-1 bookings). `POST /api/payment-methods` refuses outright (403 `MINOR_NO_PAYMENT_METHODS`) — a card-on-file form is still a payment form, and there is nothing for a parent to approve there.
  - **Also widened so the gate has something to gate:** a linked kid used to vanish from their own flows entirely, because every payment path matched on `Player.parentId` only. `lib/registration/viewer.ts`, the five signup routes, `GET /api/offers?mine=true` and both offer detail handlers now match `parentId OR userId` (the same semantics `canActForPlayer` has always had). Free programs a kid can join alone; paid ones route to the guardian.
- **INVITE-TO-A-NEW-PARENT, polished end to end.** New PUBLIC landing `/family/invite/[token]` (allowlisted in `lib/public-paths.ts`; `/family/accept` still needs a session because accepting is the consent decision): it names the kid, explains what linking means, and offers "Create my account" (sign-up with the invited email prefilled and the accept page as callback) or "I already have one". Emails now point there instead of at a bare sign-in redirect. `attachPendingFamilyInvitations()` was extracted out of the password-signup route and **wired into `ensureGoogleUser`/`ensureAppleUser` too** — an invited parent who signed up with Google previously got an orphaned invite, no bell, no prompt. On accept, the kid gets a `family_linked` notification ("<parent> is now linked to your account").
- **Schema (additive only — BOX OWES A DB PUSH):** `FamilyInvitationType` gains `CHILD_CLAIM`; `FamilyInvitation.targetPlayerId` (nullable FK → Player, relation `FamilyInvitationClaimTargets`); `Player.absorbedIntoPlayerId` + `Player.absorbedAt` (nullable) and the back-relation `claimInvitations`. No backfill, no data migration, no seed. Notification types added: `family_linked`, `payment_approval_request` (both push-eligible).
- **Gates (light, per the testing-phase rule):** `tsc --noEmit` clean · eslint clean on all 31 touched files · new HTTP smoke `scripts/demo/smoke-family-linking.mjs` **7/7** against the local dev server, throwaway accounts created and cleaned up: (a) onboarding completes with the handle left empty and the reserved default survives; (b) guardian invite to a fresh email creates the invite and the email lands in Mailpit; (c) the money gate returns 409 `NEEDS_GUARDIAN` with no guardian and 202 `routedToParent` once one is attached, with the obligation's payer reassigned and the parent notified; (d) the dashboard ships the nudge for an unlinked self-owned 15-year-old and not for a parent account; (e) the claim request resolves to `CHILD_CLAIM`, and the parent's approval attaches the kid's login to the existing row while the duplicate is absorbed and soft-deleted; (f) a parent with no account signs up through the invite and the link lands with the invite already waiting.
- **Box:** code deploy **plus `prisma db push`** (the three additive columns + the enum value). Neon owes the same push whenever it is next synced. No reseed.

## #91 — 2026-08-13: FEED GENERATED CARDS + GAME-PAGE REBUILD + AUTH SPLIT-SCREEN (Basque branch merged) — ✅ LOCAL, box pending
Branch `kais-features-2026-08-13` (54 commits, built and QA'd on the other machine) fast-forwarded into the wip branch, plus a local repair commit `97071dc` fixing 135 mojibake sequences the other box's tooling introduced into `prisma/schema.prisma` comments (UTF-8 read as CP1252; comments only, no functional change).

- **Feed generated cards.** `PostKind` gains `LEADERBOARD` / `MATCHUP` / `RIVALRY` / `CLUTCH_PLAY` (additive enum). New `apps/web/src/components/social/cards/showcase-cards.tsx` renders them as designed cards (club colours, crests, jersey numbers); dev-only preview at `/dev/feed-cards` (+ `/dev/feed-cards/article`, allowlisted in `lib/public-paths.ts`). `scripts/seed-feed-cards.ts` computes posts from live season stats (getSeasonLeaders); leaderboard captions are data-driven with working @mentions linking to player profiles; `/news/[slug]` renders generated kinds as card + prose instead of dumping JSON; recaps get scoreline-lead / blowout / thriller variants. Feed "Like" is now a single toggle (unlike clears legacy emoji reactions).
- **Game page rebuild.** Real tabs at every width; Game tab is one scroll (quarters + leaders + both boxes); box score sits behind a team switcher ABOVE game leaders (parents look for their own kid first); leaders are mirrored face-off cards with team tints and profile badges; 390px phone fixes; game clock above the LIVE pill; fixed a client-side crash (crest defined after first use — temporal dead zone).
- **Auth split-screen.** New `(auth)/auth-brand-panel.tsx`: brand lockup + persona-targeted proof points, wordmark links home; sign-up field fixes; mobile viewport overflow fix. ⚠️ **T-020 deploy requirement:** SSO buttons must render in production and the demo callback chain must survive Google sign-up — verify on box after deploy.
- **Demo welcome modal v3 + chrome.** Six benefit promises over the 30-item wall, live-season scoreboard strip, rebuilt role picker with a real half court, basketball mark in the drawer corner, modal fly-to-tab motion.
- **QA log updates** (docs/qa-testing-log-2026-08-06.md): T-021 repost has no visible feedback (API verified working); T-022 stories model cannot carry the new card kinds — both parked for a later pass.
- **Local sync done this side:** prisma generate (arm64 node) + `prisma db push` to local DB (in sync) · `tsc --noEmit` clean.
- **Box:** code deploy **plus `prisma db push`** (the four PostKind values; additive only). Neon owes the same push when next synced. Optional after push: run `scripts/seed-feed-cards.ts` on the box to populate generated posts — owner call. Stacks on top of pending #89/#90.

## #92 — 2026-08-13: ONBOARDING OVERHAUL + COURT BACKDROPS + BRANDED CONTROL SWEEP + FAMILY LINK CODES (owner-driven, plan-approved) — ✅ LOCAL, box pending
Owner walked the demo as a Player and hit the friction stack: role re-asked after signup, "(optional)" on a predetermined handle, long guardian copy, plain white screens, naked HTML controls. Whole arc built and verified same day (6 commits, 6291c81..HEAD).

- **Flow**: /onboarding is now the server choke point: a callbackUrl into /demo/start skips onboarding entirely (signup to demo in one hop, all auth paths); onboarding runs on demo EXIT prefilled via ?role= (persona map in lib/demo/persona-role.ts, wired in demo-banner). Role fast-path skips the role step; "Not a player? Change" is the way back. Handle renders as a claimed chip (no "optional"), same QA-209 never-blocks save.
- **Design**: components/ui/court-backdrop.tsx (navy/daylight/ink, blended cropped half-court + center mask, phone-visible via max-sm anchors) applied to onboarding + 15 blank dialog screens (invites, accepts, demo handoff, welcome, waivers, score-guest, errors, unsubscribed, sync-user, auth mobile). Waivers + errors also moved off gray-*/orange-500 onto tokens; public error boundary shows digest, not error.message. Control kit: BrandListbox, ChipGroup, ChoiceCardGroup, BrandCheckbox, decorated DateTimePicker calendar; preview at /dev/control-kit. ~99 native selects, ~15 radios, 9 date/time inputs converted across user-facing AND operator surfaces (deliberate leftovers: 2 dense staff-page inline pills, register-bound waiver/COPPA checkboxes, dynamic QuestionField controls, social-controls-card radios).
- **Linking**: guardian block auto-detects a waiting parent once DOB is set (GET /api/family/claim-check, {match} only, 10/hr rate limit) and sends the claim without the kid typing an email (autoClaim on POST /api/family-invitations, response non-oracle). Family link codes both directions (FamilyLinkCode model, 7-day, single-use, one generic failure message): parent mints on /players card, kid redeems in onboarding or the nudge dialog, link is immediate, merge offered when the household holds a matching row. POST /api/family/merge applies it, callable by guardian OR the linked kid folding their own duplicate (transaction re-reads, looksLikeSamePlayer gate). Parent add form warns on a self-registered match (GET /api/family/add-check) and points at the family code instead of a duplicate.
- **Gates**: tsc clean repo-wide · per-file eslint clean across all phases · family-linking int suite 29/29 + invitations 15/15 (real local DB) · picker unit tests 4/4 · Playwright drives: signup>demo skip (307 verified), exit>onboarding?role=Player, one-viewport form at 1440x900 and 390x844, guardian MATCH/NO-MATCH staged live, code mint>redeem>linked, add-check banner debounce (1 call), offers/waivers/players screenshots · arc diff has zero em-dashes in user-facing strings (postures + age-policy labels cleaned).
- **Box**: code deploy plus `prisma db push` (FamilyLinkCode model + FamilyLinkDirection enum, additive). Neon owes the same when next synced. No backfill, no reseed. Stacks on #89/#90/#91.

## #93 — 2026-08-14: COURT SYSTEM v2 SITEWIDE (owner-approved design, artifact spec) — ✅ LOCAL, box pending
Owner rejected v1's court ("lines reversed, no floor, invisible") and approved the design artifact (regulation half court over hardwood, three finishes). Implemented in 4 commits.
- **court-backdrop.tsx v2**: regulation geometry (10 units/ft: 16ft paint, dashed FT inner half, restricted arc toward midcourt, corner threes, R23'9" arc, hash marks) + pure-CSS floors (parquet 240px conic checkerboard, maple planks) + finishes (navy/amber .20, daylight/sienna .15, ink/amber .12) + intensity prop (immersive | band | ambient). All 18 phase-#92 consumers upgraded with zero line changes. Glows halved (parquet turned them maroon); phone anchors re-derived.
- **New adopters**: arena-night home hero (amber CTA) · new shared PageBand on /scores /news /leagues /events /club directory · entity-header on the daylight band with primaryColor crest fill + 4px stripe (org/team/player) · club hub /club/[slug] + league hub /league/[id] inline heroes converted (banner art preserved as cover strip above the band; crest fallback added for logo-less clubs) · dashboard layout on ambient plank grain + navy greeting card.
- Gates: tsc clean · lint clean per file · Playwright 1440+390 screenshots on every surface, zero horizontal scroll · no data/query changes anywhere.
- **Follow-ups (design-approved, not yet built)**: entity-colour tab accents · dashboard daily-story card (needs data wiring) · events chips into the band (client component slot) · /scores band chip rail at 390 (6 chips wrap tall) · /league/[id]/leaders band · demo-seed copy has em-dashes (data cleanup) · /demo/start glassy card lets court read through (owner eyeball) · demo drawer tab overlaps entity headers at 390 (pre-existing).
- **Box**: code deploy only, no schema change. Stacks on #89-#92.

## #94 — 2026-08-14: DASHBOARD COMMAND HERO + GAME PAGE MOBILE v3 + NEUTRAL CRESTS (owner-driven same-day rulings) — ✅ LOCAL, box pending
- **Dashboard command hero** (fca36a6): state-aware hero replaces the greeting for operators; league setup shows checklist progress + named next step at zero scrolls (shared lib lib/leagues/season-progress.ts keeps hero and console checklist in lockstep); running seasons get the command strip; clubs get entry/running states. Affordance pass: status rails via railForStatus, chevroned rows, kit buttons on the season checklist, Do-more tray demoted. FIXED same-day: hero query used EntryStatus "PENDING" (not a real value) and crashed /dashboard for owners with pending entries; now SUBMITTED. Lesson: the (prisma as any) cast hid it from tsc.
- **Game page mobile v3** (8a60fbd): root cause of the owner's "broke my mobile viewport" was an implicit grid column sizing the page to the box score's 501px max-content (scrollWidth 517 at 390). Mobile now has its own hero composition (full-bleed, full club names, records + division small caps, linescore in hero); type capped at REAL loaded weights (Work Sans/Barlow ship max 700 - all font-black sitewide is browser-synthesized faux bold, "too fat"; sitewide decision pending: load 800/900 cuts vs cap at 700). Bottom tab bar now truly reserves space (the earlier fix exported client constants into server layouts and produced class="[object Object]"); demo ribbon is a chip below sm; live-view split into per-tab components (code-map R2).
- **Neutral crests** (last commit): owner ruling - default-assigned club colors are noise. New shared components/ui/crest.tsx; ink monograms across all list/scoreboard/standings/feed contexts (41 files); identical page headers (navy stripe); brand color ONLY on a club's own page when chosen (two gates: not UNCLAIMED and not importer default #1a73e8). Exceptions kept: league/org own hubs (chosen branding), share-image artwork, flow-demo frozen world, branding editors, semantic status tones. IN FLIGHT: player mugshot placeholders (sketch bust + jersey number) + photo upload at onboarding/profile - may add Player.photoUrl (additive) = one more local db push; box owes the same if it lands.
- Gates per commit: tsc clean, per-file lint clean, 39 standings/public-paths tests + 13 scoring fold tests pass, Playwright geometry checks (scrollWidth==390) on live/scores/dashboard.
- **Box**: code deploy; plus prisma db push IF the mugshot arc adds Player.photoUrl (check #95). Stacks on #89-#93.

## #95 — 2026-08-14: PLAYER MUGSHOTS + PHOTO UPLOAD (owner ruling) — ✅ LOCAL, box pending
- PlayerMug (components/ui/player-mug.tsx): hand-sketched ink bust + jersey number placeholder until a photo exists; swept game leaders, POTG, both team rosters, club roster manager, /players cards, player hero (EntityHeader mark slot). Left deliberately: box score text rows, showcase feed cards, story rings, next/og card art.
- Upload: PlayerPhotoField on players/[id]/edit + compact PlayerPhotoChip on the onboarding hero (one-viewport layout preserved, measured). Reuses club-logo compressImage (WebP data URL, 512px, 750k char cap). Additive zod field on player PATCH + onboarding create. Public display consent-gated via playerDisplayPhoto (mediaConsent GRANTED), same rule as names.
- **Schema: Player.photoUrl String? @db.Text (additive) — local db push + generate done; BOX AND NEON OWE THE PUSH.**
- Bugfix: addPlayerSchema.weight coerced "" to 0 and silently blocked Save Changes for any player without a weight; empty now maps to undefined (also fixes /players/add).
- Gates: tsc clean, lint clean, players PATCH int tests 4/4, privacy names 13/13, Playwright evidence (upload persisted, onboarding POST with photo, no viewport growth). Demo staging reverted.
- Box: code deploy + prisma db push. Stacks on #89-#94.

## #96 — 2026-08-16: DEMO DIRECTORY COMPLETE — 10 DEMOS LIVE AT /demos (owner-approved scripts, overnight run) — ✅ LOCAL, box pending
- Chrome-free console at /demos: navy rail (search + audience filter + title-led list), read-then-play intros with written descriptions and chapter previews, fit-to-panel stage. Engine: fixed stage (no pan/zoom/scroll), eased cursor, typing, press ripples, chapter-exact jumps, reduced-motion static finals.
- Ten demos, every one driven headlessly (zero console errors, overflow probes, cursor-target resolution): roster story 40 beats (offer accepted w/ real sizes/jersey/plan flow) · everyone-in-the-loop 33 · season 48 (coherent court-hours math, auditor refuses first) · GAME-DAY FLAGSHIP 48 (one clock both frames w/ 38-beat sync assertion, flash pulses per changed element, real console action set, undo-as-void, assist attribution) · claim-your-club 25 · your-week 21 · waivers 25 (auto-send truth) · players-season 22 · money-picture 23 · standings-to-playoffs 23. All mirror real surfaces read-first; product-truth corrections documented per demo.
- Real product bugs fixed on the way: audiences.ts labels (19 em-dashes), play-by-play separator, dead gold token shades, prose em-dashes in playoff labels/reminder emails/obligations/console prompts, gold-700 label bug.
- Checkpoint: tsc clean · 64 targeted tests pass · all 10 slugs + /demos 200 · zero em-dashes in demo copy.
- OWNER MORNING CALLS: read-meter panel (demo shows per-recipient read counts; data exists in TeamChatRead, UI not built - build the small panel or soften the beat) · your-week fee/waiver-inline placement is invented (documented in file header) · payment reminder crons are OFF on the box (runbook #36) while the money demo shows them - switch on at deploy or note · font letter at /dev/type-weights · home page presentation session.
- Box: code deploy only (stacks #89-#95 incl. two schema pushes).
