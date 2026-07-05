/**
 * Backfill AI game recaps (plan §6.1) for COMPLETED games that don't have a
 * RECAP_AI post yet — going forward, finalize creates them automatically;
 * this covers games finished before the content engine shipped (and demo
 * seeds that mark games COMPLETED without going through the finalize API).
 *
 *   npx tsx scripts/backfill-recaps.ts          # missing recaps only
 *   npx tsx scripts/backfill-recaps.ts --all    # regenerate every recap
 */

import { prisma } from "@youthbasketballhub/db"
import { upsertGameRecap } from "../apps/web/src/lib/content/recap-service"

async function main() {
  const regenerateAll = process.argv.includes("--all")

  const games = await (prisma as any).game.findMany({
    where: { status: "COMPLETED" },
    select: { id: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
    orderBy: { scheduledAt: "asc" },
  })
  console.log(`Found ${games.length} completed games`)

  let created = 0
  let skipped = 0
  let failed = 0
  for (const game of games) {
    if (!regenerateAll) {
      const existing = await (prisma as any).post.findFirst({
        where: { kind: "RECAP_AI", tags: { some: { gameId: game.id } } },
        select: { id: true },
      })
      if (existing) {
        skipped++
        continue
      }
    }
    try {
      const result = await upsertGameRecap(game.id)
      if (result) {
        created++
        console.log(`  ✓ ${game.homeTeam.name} vs ${game.awayTeam.name}`)
      } else {
        skipped++
        console.log(`  – skipped (no scores/events): ${game.homeTeam.name} vs ${game.awayTeam.name}`)
      }
    } catch (err) {
      failed++
      console.error(`  ✗ ${game.id}:`, err)
    }
  }

  console.log(`\nDone: ${created} recaps written, ${skipped} skipped, ${failed} failed`)
  await (prisma as any).$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
