-- Authorization-integrity hardening (architecture review WS1.5 + WS4.5).
-- Prisma's schema language cannot express partial unique indexes or CHECK
-- constraints, so these apply via raw SQL. Idempotent (IF NOT EXISTS).
-- Run on LOCAL via `prisma db execute` and on NEON before deploying the
-- code that assumes them (see docs/pending-deploy-actions.md).

-- ============================================================
-- 1. UserRole: real duplicate-grant prevention.
-- The schema-level @@unique([userId, role, tenantId, teamId, leagueId,
-- gameId]) is NULL-porous in Postgres (NULLs compare distinct), so identical
-- grants could be inserted repeatedly. Partial uniques per scope class:
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_unscoped_unique"
  ON "UserRole" ("userId", "role")
  WHERE "tenantId" IS NULL AND "teamId" IS NULL AND "leagueId" IS NULL AND "gameId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_tenant_scoped_unique"
  ON "UserRole" ("userId", "role", "tenantId")
  WHERE "tenantId" IS NOT NULL AND "teamId" IS NULL AND "leagueId" IS NULL AND "gameId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_team_scoped_unique"
  ON "UserRole" ("userId", "role", "teamId")
  WHERE "teamId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_league_scoped_unique"
  ON "UserRole" ("userId", "role", "leagueId")
  WHERE "leagueId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_game_scoped_unique"
  ON "UserRole" ("userId", "role", "gameId")
  WHERE "gameId" IS NOT NULL;

-- ============================================================
-- 2. UserRole: role <-> scope coherence.
-- Unscoped rows are legitimate (roles granted at onboarding get scoped
-- later), so the rule is "scope column may only be set for roles that use
-- that scope" — this forbids e.g. a Scorekeeper with a leagueId or a Parent
-- with a tenantId, without touching unscoped grants.
-- ============================================================
ALTER TABLE "UserRole" DROP CONSTRAINT IF EXISTS "UserRole_scope_coherence";
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_scope_coherence" CHECK (
  ("gameId"   IS NULL OR "role" IN ('Scorekeeper', 'Referee'))
  AND ("leagueId" IS NULL OR "role" IN ('LeagueOwner', 'LeagueManager'))
  AND ("teamId"   IS NULL OR "role" IN ('Staff', 'TeamManager', 'Player'))
  -- Trainer added 2026-07-21 (batch-backlog §5): the solo operator's role is
  -- tenant-scoped to their TRAINER tenant.
  AND ("tenantId" IS NULL OR "role" IN ('ClubOwner', 'ClubManager', 'Staff', 'TeamManager', 'Scorekeeper', 'Trainer'))
);

-- ============================================================
-- 3. Review: one review per reviewer per target + exactly one target.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS "Review_reviewer_tenant_unique"
  ON "Review" ("reviewerId", "tenantId") WHERE "tenantId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Review_reviewer_league_unique"
  ON "Review" ("reviewerId", "leagueId") WHERE "leagueId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Review_reviewer_reviewee_unique"
  ON "Review" ("reviewerId", "revieweeId") WHERE "revieweeId" IS NOT NULL;

ALTER TABLE "Review" DROP CONSTRAINT IF EXISTS "Review_exactly_one_target";
ALTER TABLE "Review" ADD CONSTRAINT "Review_exactly_one_target" CHECK (
  num_nonnulls("tenantId", "leagueId", "revieweeId") = 1
);
