/**
 * Seed a clickable live-scoring demo: one league season, two clubs with
 * 8-player rosters, one game scheduled today — then print the URLs and
 * the login to use. Re-runnable (same seed rebuilds the same world).
 *
 *   npx tsx scripts/demo-scoring-game.ts
 *   npx tsx scripts/demo-scoring-game.ts --wipe
 */

import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  destroyWorld,
  createClub,
  createWorldContext,
  submitTeamToSeason,
} from "@youthbasketballhub/test-worlds"

const SEED = 9414

async function main() {
  if (process.argv.includes("--wipe")) {
    await destroyWorld(createWorldContext(SEED))
    console.log("wiped")
    return
  }

  // Fresh world each run so the demo game is always in a clean state
  await destroyWorld(createWorldContext(SEED))

  const world = await buildWorld({
    seed: SEED,
    leagues: [
      {
        seasons: [
          { status: "FINALIZED", divisions: [{ teams: 1, rosterSize: 8 }], sessions: [] },
        ],
      },
    ],
  })
  const season = world.leagues[0].seasons[0]
  const submissionA = season.divisions[0].submissions[0]

  const clubB = await createClub(world.ctx, {})
  const submissionB = await submitTeamToSeason(world.ctx, {
    seasonId: season.id,
    divisionId: season.divisions[0].id,
    tenantId: clubB.tenantId,
    ageGroup: "U12",
    seasonLabel: season.label,
    rosterSize: 8,
    status: "APPROVED",
  })

  // Give everyone jersey numbers so the tiles look right
  let n = 4
  for (const sub of [submissionA.submissionId, submissionB.submissionId]) {
    const rosterPlayers = await (prisma as any).seasonRosterPlayer.findMany({
      where: { roster: { teamSubmissionId: sub } },
      select: { id: true },
    })
    for (const rp of rosterPlayers) {
      await (prisma as any).seasonRosterPlayer.update({
        where: { id: rp.id },
        data: { jerseyNumber: n },
      })
      n += 3
    }
  }

  const game = await prisma.game.create({
    data: {
      seasonId: season.id,
      homeTeamId: submissionA.teamId,
      awayTeamId: submissionB.teamId,
      scheduledAt: new Date(),
      duration: 60,
      status: "SCHEDULED",
    },
  })

  const owner = world.leagues[0].owner
  console.log("")
  console.log("DEMO GAME READY")
  console.log(`  sign in as:        ${owner.email}   (password: TestPass123!)`)
  console.log(`  scorekeeper list:  http://localhost:3000/score`)
  console.log(`  scoring console:   http://localhost:3000/games/${game.id}/score`)
  console.log(`  public live page:  http://localhost:3000/live/${game.id}   (no login needed)`)
  console.log("")
  console.log("Tip: open the console on your iPad/phone via your Mac's LAN IP instead of")
  console.log("localhost, e.g. http://<your-mac-ip>:3000/… on the same wifi.")
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
