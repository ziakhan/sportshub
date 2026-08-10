/**
 * Reset the pre-season NPH Showcase world to the TRUE product story
 * (design 2026-08-09): a season that has not started has NO divisions —
 * each grade is one group; the operator creates divisions at scheduling
 * time through the guided flow, then generates.
 *
 * Per grade with >1 division: keep the first (name asc), move every
 * submission onto it, strip the conference from its name, fix session
 * unitKeys/unitVenues, delete the empties. Then clear gradeScheduling,
 * playoffConfig and playoffPlan, and delete ALL draft games (regular +
 * playoff) so the world sits at the "about to schedule" gate.
 *
 * Plain CommonJS so it runs unchanged on the box:
 *   node scripts/demo/collapse-preseason-divisions.cjs
 *   PRISMA_PATH=/opt/sportshub/node_modules/@prisma/client node collapse-preseason-divisions.cjs
 */
const { PrismaClient } = require(process.env.PRISMA_PATH ?? "@prisma/client")
const prisma = new PrismaClient()

async function main() {
  const league = await prisma.league.findFirst({ where: { name: "NPH Showcase League" } })
  if (!league) throw new Error("NPH Showcase League not found")
  const season = await prisma.season.findFirst({
    where: { leagueId: league.id },
    orderBy: { createdAt: "desc" },
  })
  if (!season) throw new Error("no season")
  console.log(`season ${season.id} (${season.label})`)

  const published = await prisma.game.count({
    where: { seasonId: season.id, phase: "REGULAR", publishedAt: { not: null } },
  })
  if (published > 0) throw new Error(`refusing: ${published} PUBLISHED games exist`)

  const divisions = await prisma.division.findMany({
    where: { seasonId: season.id },
    orderBy: { name: "asc" },
  })
  const byAge = new Map()
  for (const d of divisions) {
    const k = d.ageGroup ?? d.name
    if (!byAge.has(k)) byAge.set(k, [])
    byAge.get(k).push(d)
  }

  const keeperOf = new Map() // deleted id -> keeper id
  const deleted = new Set()
  for (const [age, divs] of byAge) {
    if (divs.length < 2) continue
    const keeper = divs[0]
    const plain = keeper.name.includes(" · ") ? keeper.name.split(" · ")[0] : keeper.name
    await prisma.division.update({ where: { id: keeper.id }, data: { name: plain } })
    for (const d of divs.slice(1)) {
      await prisma.teamSubmission.updateMany({
        where: { divisionId: d.id },
        data: { divisionId: keeper.id },
      })
      keeperOf.set(d.id, keeper.id)
      deleted.add(d.id)
    }
    console.log(`${age}: ${divs.length} divisions -> 1 (${plain})`)
  }

  const sessions = await prisma.seasonSession.findMany({ where: { seasonId: season.id } })
  for (const sess of sessions) {
    let changed = false
    let unitKeys = Array.isArray(sess.unitKeys) ? [...sess.unitKeys] : []
    const mapped = unitKeys.map((k) => {
      const m = /^division:(.+)$/.exec(k)
      if (m && keeperOf.has(m[1])) {
        changed = true
        return `division:${keeperOf.get(m[1])}`
      }
      return k
    })
    unitKeys = [...new Set(mapped)]
    let unitVenues = sess.unitVenues && typeof sess.unitVenues === "object" ? { ...sess.unitVenues } : null
    if (unitVenues) {
      for (const key of Object.keys(unitVenues)) {
        const m = /^division:(.+)$/.exec(key)
        if (!m) continue
        if (keeperOf.has(m[1])) {
          const kk = `division:${keeperOf.get(m[1])}`
          if (!unitVenues[kk]) unitVenues[kk] = unitVenues[key]
          delete unitVenues[key]
          changed = true
        }
      }
    }
    if (changed) {
      await prisma.seasonSession.update({
        where: { id: sess.id },
        data: { unitKeys, ...(unitVenues ? { unitVenues } : {}) },
      })
    }
  }

  const games = await prisma.game.deleteMany({ where: { seasonId: season.id } })
  for (const id of deleted) await prisma.division.delete({ where: { id } })
  await prisma.season.update({
    where: { id: season.id },
    data: { gradeScheduling: {}, playoffConfig: {}, playoffPlan: null },
  })
  console.log(`deleted ${games.count} draft games, ${deleted.size} empty divisions; settings cleared`)
  console.log("world is at the scheduling gate — no divisions, nothing generated")
  process.exit(0)
}
main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
