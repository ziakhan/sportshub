/**
 * One-time backfill for the draft/publish layer (runbook #50): every Game
 * that existed before Game.publishedAt was introduced is already live for
 * families, so stamp it published (createdAt keeps honest ordering).
 * Run AFTER prisma db push on the target DB:
 *   npx tsx scripts/backfill-publish-games.ts
 */
import { PrismaClient } from "@prisma/client"

const p = new PrismaClient()

async function main() {
  const rows: Array<{ id: string; createdAt: Date }> = await (p as any).$queryRaw`
    SELECT id, "createdAt" FROM "Game" WHERE "publishedAt" IS NULL`
  console.log(`${rows.length} unpublished game(s) to backfill`)
  if (rows.length === 0) return
  await (p as any).$executeRaw`
    UPDATE "Game" SET "publishedAt" = "createdAt" WHERE "publishedAt" IS NULL`
  console.log("done — publishedAt = createdAt")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => p.$disconnect())
