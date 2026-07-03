import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld } from "@youthbasketballhub/test-worlds"
async function main() {
  const world = await buildWorld({
    seed: 42,
    clubs: [{
      teams: [{ ageGroup: "U14", headCoach: true }],
      tryouts: [{ capacity: 20, signups: 3 }],   // the "not enough players" world (F1)
      pendingOffers: 2,
    }],
    families: [{ children: [{ age: 12 }, { age: 9 }] }],
  })
  const { ctx } = world
  const t = world.clubs[0]
  const counts = {
    signups: t.tryouts[0].signups.length,
    users: await prisma.user.count({ where: { email: { endsWith: `@${ctx.runId}.world` } } }),
    offers: await prisma.offer.count({ where: { team: { tenantId: t.tenantId } } }),
    coach: t.teams[0].headCoach ? 1 : 0,
  }
  console.log("BUILT", JSON.stringify(counts))
  // determinism probe: same seed => same runId/namespace
  const again = await buildWorld({ seed: 42, clubs: [] })
  console.log("DETERMINISTIC", again.ctx.runId === ctx.runId)
  await destroyWorld(ctx)
  const remaining = await prisma.user.count({ where: { email: { endsWith: `@${ctx.runId}.world` } } })
  const remTenants = await prisma.tenant.count({ where: { slug: { startsWith: `${ctx.runId}-` } } })
  console.log("DESTROYED", JSON.stringify({ remaining, remTenants }))
  await prisma.$disconnect()
  if (counts.signups === 3 && counts.offers === 2 && counts.coach === 1 && remaining === 0 && remTenants === 0) {
    console.log("SMOKE PASS")
  } else { console.log("SMOKE FAIL"); process.exit(1) }
}
main().catch((e) => { console.error(e); process.exit(1) })
