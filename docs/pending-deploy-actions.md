# Pending Deploy Actions

Manual steps to run on production (Neon) **before** the next Vercel deploy of master. Each action lists the linked code change, the production command, and how to verify it landed.

> **History:** Entries 1–3 (the 0.1.x gap deploys) all ran on 2026-05-05 ahead of commits `30d92ed` + `3a60477`. Left in this file as a worked example for future migrations.

---

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


## ⬜ 4. Schema-hardening batch (architecture review WS1.5 + WS4) — July 2026

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

## ⬜ 5. PlayerInvitation table (Gap G3) — July 2026

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
