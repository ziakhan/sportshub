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
    leagues: [{
      seasons: [{
        status: "REGISTRATION",
        divisions: [
          { teams: 3, rosterSize: 5, maxTeams: 4 },
          { teams: 2, rosterSize: 0, ageGroup: "U14" },
        ],
        venue: { courts: 2 },
        sessions: [{ days: 2 }],
        schedulingGroups: [{ divisions: [0, 1] }],
      }],
    }],
    families: [{ children: [{ age: 12 }, { age: 9 }] }],
  })
  const { ctx } = world
  const t = world.clubs[0]
  const season = world.leagues[0].seasons[0]
  const counts = {
    signups: t.tryouts[0].signups.length,
    users: await prisma.user.count({ where: { email: { endsWith: `@${ctx.runId}.world` } } }),
    offers: await prisma.offer.count({ where: { team: { tenantId: t.tenantId } } }),
    coach: t.teams[0].headCoach ? 1 : 0,
    divisions: season.divisions.length,
    submissions: await prisma.teamSubmission.count({ where: { seasonId: season.id } }),
    rosterPlayers: await prisma.seasonRosterPlayer.count({ where: { roster: { seasonId: season.id } } }),
    dayVenueCourts: await prisma.seasonSessionDayVenueCourt.count({
      where: { dayVenue: { day: { session: { seasonId: season.id } } } },
    }),
    groupDivisions: await prisma.schedulingGroupDivision.count({
      where: { schedulingGroup: { seasonId: season.id } },
    }),
  }
  console.log("BUILT", JSON.stringify(counts))
  // determinism probe: same seed => same runId/namespace
  const again = await buildWorld({ seed: 42, clubs: [] })
  console.log("DETERMINISTIC", again.ctx.runId === ctx.runId)
  await destroyWorld(ctx)
  const remaining = await prisma.user.count({ where: { email: { endsWith: `@${ctx.runId}.world` } } })
  const remTenants = await prisma.tenant.count({ where: { slug: { startsWith: `${ctx.runId}-` } } })
  const remLeagueRows = await prisma.league.count({ where: { name: { startsWith: `[${ctx.runId}] ` } } })
  const remVenues = await prisma.venue.count({ where: { name: { startsWith: `[${ctx.runId}] ` } } })
  console.log("DESTROYED", JSON.stringify({ remaining, remTenants, remLeagueRows, remVenues }))
  await prisma.$disconnect()
  const pass =
    counts.signups === 3 && counts.offers === 2 && counts.coach === 1 &&
    counts.divisions === 2 && counts.submissions === 5 && counts.rosterPlayers === 15 &&
    counts.dayVenueCourts === 4 && counts.groupDivisions === 2 &&
    remaining === 0 && remTenants === 0 && remLeagueRows === 0 && remVenues === 0
  if (pass) {
    console.log("SMOKE PASS")
  } else { console.log("SMOKE FAIL"); process.exit(1) }
}
main().catch((e) => { console.error(e); process.exit(1) })
