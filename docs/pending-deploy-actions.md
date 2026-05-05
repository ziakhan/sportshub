# Pending Deploy Actions

Manual steps to run on production (Neon) **before** the next Vercel deploy of master. Each action lists the linked code change, the production command, and how to verify it landed.

---

## 1. Backfill `OfferTemplate.tenantId` (Gap 0.1.7)

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

## 2. Push `Player.deletedAt` schema field (Gap 0.1.4)

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

## 3. Push the `OfferTemplate.tenantId` and `Player.deletedAt` changes together if convenient

If you're running both #1 and #2 in the same session, the order doesn't matter — they're independent. Both are non-destructive.

After the schema push (#2), still run the OfferTemplate backfill SQL (#1) — that one is data-only, not schema.
