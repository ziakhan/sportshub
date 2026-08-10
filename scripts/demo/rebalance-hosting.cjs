/**
 * Re-home hosting for every REGULAR weekend of the pre-season Showcase
 * world under the GRADE-STAYS-TOGETHER law (owner 2026-08-10): one grade
 * = one gym per weekend, every division of the grade in that gym.
 * Whole grades are placed biggest-first into the gym with the most
 * remaining slot capacity. Same units per weekend (the plan's law), only
 * the gym assignment changes. Zero-team divisions lose their keys.
 */
const { PrismaClient } = require(process.env.PRISMA_PATH ?? "@prisma/client")
const prisma = new PrismaClient()

const hhmm = (t, fb) => {
  const m = t ? /^(\d{1,2}):(\d{2})$/.exec(t) : null
  return m ? Number(m[1]) * 60 + Number(m[2]) : fb
}

async function main() {
  const league = await prisma.league.findFirst({ where: { name: "NPH Showcase League" } })
  const season = await prisma.season.findFirst({ where: { leagueId: league.id }, orderBy: { createdAt: "desc" } })
  const slotMin = season.gameSlotMinutes ?? 75
  const divs = await prisma.division.findMany({
    where: { seasonId: season.id },
    include: { _count: { select: { teamSubmissions: { where: { status: "APPROVED" } } } } },
  })
  const divById = new Map(divs.map((d) => [d.id, d]))
  const sessions = await prisma.seasonSession.findMany({
    where: { seasonId: season.id, phase: "REGULAR" },
    include: { days: { include: { dayVenues: { include: { courts: true } } } } },
  })
  for (const sess of sessions) {
    const uv = sess.unitVenues && typeof sess.unitVenues === "object" ? sess.unitVenues : null
    if (!uv || Object.keys(uv).length === 0) continue
    const capacity = new Map()
    for (const day of sess.days) {
      for (const dv of day.dayVenues) {
        const slots =
          Math.max(0, Math.floor((hhmm(dv.endTime, 1200) - hhmm(dv.startTime, 540)) / slotMin)) *
          dv.courts.length
        capacity.set(dv.venueId, (capacity.get(dv.venueId) ?? 0) + slots)
      }
    }
    if (capacity.size === 0) continue
    const target = sess.targetGamesPerTeam ?? 2
    /* Group this weekend's hosted divisions into whole grades. */
    const grades = new Map() // ageGroup -> { keys: [], teams: n }
    for (const k of Object.keys(uv)) {
      if (!k.startsWith("division:")) continue
      const d = divById.get(k.slice(9))
      if (!d || d._count.teamSubmissions < 2) continue
      const age = d.ageGroup ?? d.name
      if (!grades.has(age)) grades.set(age, { keys: [], teams: 0 })
      const g = grades.get(age)
      g.keys.push(k)
      g.teams += d._count.teamSubmissions
    }
    const order = [...grades.entries()].sort(
      (a, b) => b[1].teams - a[1].teams || a[0].localeCompare(b[0])
    )
    const load = new Map()
    const next = {}
    for (const [, g] of order) {
      let best = null
      let bestRoom = -Infinity
      for (const gym of [...capacity.keys()].sort()) {
        const room = capacity.get(gym) - (load.get(gym) ?? 0)
        if (room > bestRoom) {
          bestRoom = room
          best = gym
        }
      }
      for (const k of g.keys) next[k] = best
      load.set(best, (load.get(best) ?? 0) + Math.ceil((g.teams * target) / 2))
    }
    await prisma.seasonSession.update({ where: { id: sess.id }, data: { unitVenues: next } })
    const over = [...load.entries()].filter(([g, l]) => l > capacity.get(g))
    console.log(
      `${sess.label}: ${order.length} grades whole — ` +
        [...load.entries()].map(([g, l]) => `${l}/${capacity.get(g)}`).join(" · ") +
        (over.length ? "  ⚠ OVER" : "")
    )
  }
  process.exit(0)
}
main().catch((e) => { console.error(e.message); process.exit(1) })
