/** Run flattenSplitLoads directly on the DB's saved schedule — separates
 *  "polish has a bug" from "dev server did not reload it". */
import { PrismaClient } from "@prisma/client"
import { flattenSplitLoads, type ProposedGame } from "../../apps/web/src/lib/scheduler/generate"

const S = "160b2f09-a95a-4a64-9b90-03793cae105b"
const prisma = new PrismaClient()

function dist(games: ProposedGame[]) {
  const byTd = new Map<string, Set<string>>()
  for (const g of games) {
    const d = new Date(g.scheduledAt)
    const dk = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    for (const id of [g.homeTeamId, g.awayTeamId]) {
      const k = `${id}|${dk}`
      if (!byTd.has(k)) byTd.set(k, new Set())
      byTd.get(k)!.add(g.venueId)
    }
  }
  const per = new Map<string, number>()
  for (const [k, vs] of byTd) {
    if (vs.size > 1) {
      const id = k.split("|")[0]
      per.set(id, (per.get(id) ?? 0) + 1)
    }
  }
  const d: Record<number, number> = {}
  for (const n of per.values()) d[n] = (d[n] ?? 0) + 1
  return d
}

async function main() {
  const rows = await (prisma as any).game.findMany({
    where: { seasonId: S, phase: "REGULAR", status: { not: "CANCELLED" } },
    select: {
      sessionId: true, dayId: true, dayVenueId: true, courtId: true, venueId: true,
      homeTeamId: true, awayTeamId: true, scheduledAt: true, duration: true,
    },
  })
  const games: ProposedGame[] = rows.map((r: any) => ({
    ...r,
    scheduledAt: new Date(r.scheduledAt).toISOString(),
    unitKey: "",
  }))
  console.log("before:", JSON.stringify(dist(games)))
  flattenSplitLoads(games, 75)
  console.log("after: ", JSON.stringify(dist(games)))
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
