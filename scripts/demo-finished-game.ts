/**
 * Seed a FINISHED, fully-scored demo game (for scoresheet/PDF demos) next to
 * the live demo game — same world/teams as demo-scoring-game.ts (seed 9414).
 * Deterministic events: 4 quarters of 2s/3s/FTs with misses, fouls (one
 * technical), subs, one absentee per team, referee-signed finalize.
 *
 *   npx tsx scripts/demo-finished-game.ts
 */

import { prisma } from "@youthbasketballhub/db"
import { foldEvents, totalRebounds, type FoldEvent } from "../apps/web/src/lib/scoring/fold"

async function main() {
  // Find the demo world's two teams via the live demo game (seed 9414 world)
  const demoGame = await (prisma as any).game.findFirst({
    where: { homeTeam: { name: { contains: "Maplewood Falcons" } } },
    orderBy: { createdAt: "desc" },
    select: { seasonId: true, homeTeamId: true, awayTeamId: true },
  })
  if (!demoGame) throw new Error("Run scripts/demo-scoring-game.ts first")

  const rosterOf = async (teamId: string) =>
    (
      await (prisma as any).seasonRosterPlayer.findMany({
        where: { roster: { teamSubmission: { teamId, seasonId: demoGame.seasonId } } },
        select: { playerId: true },
        orderBy: { jerseyNumber: "asc" },
      })
    ).map((r: any) => r.playerId)
  const home = await rosterOf(demoGame.homeTeamId)
  const away = await rosterOf(demoGame.awayTeamId)
  if (home.length < 6 || away.length < 6) throw new Error("rosters too small")

  const game = await prisma.game.create({
    data: {
      seasonId: demoGame.seasonId,
      homeTeamId: demoGame.homeTeamId,
      awayTeamId: demoGame.awayTeamId,
      scheduledAt: new Date(Date.now() - 24 * 3600 * 1000),
      duration: 60,
      status: "SCHEDULED",
    },
  })

  const H = demoGame.homeTeamId
  const A = demoGame.awayTeamId
  let seq = 0
  const events: any[] = []
  const push = (e: Partial<FoldEvent> & { eventType: string }) =>
    events.push({
      gameId: game.id,
      eventType: e.eventType,
      teamId: e.teamId ?? null,
      playerId: e.playerId ?? null,
      made: e.made ?? null,
      period: e.period ?? null,
      sequence: ++seq,
      clientEventId: `demo-fin-${seq}`,
      metadata: (e as any).metadata ?? undefined,
      timestamp: new Date(Date.now() - 24 * 3600 * 1000 + seq * 20_000),
    })

  // Attendance: last rostered player on each side is absent
  push({
    eventType: "ATTENDANCE",
    teamId: H,
    metadata: { presentIds: home.slice(0, -1), absentIds: [home[home.length - 1]] },
  })
  push({
    eventType: "ATTENDANCE",
    teamId: A,
    metadata: { presentIds: away.slice(0, -1), absentIds: [away[away.length - 1]] },
  })
  push({ eventType: "LINEUP", teamId: H, metadata: { playerIds: home.slice(0, 5) } })
  push({ eventType: "LINEUP", teamId: A, metadata: { playerIds: away.slice(0, 5) } })

  // Deterministic pseudo-random
  let s = 42
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31), s / 2 ** 31)
  const pick = (arr: string[]) => arr[Math.floor(rnd() * arr.length)]

  for (let q = 1; q <= 4; q++) {
    push({ eventType: "PERIOD_START", period: q })
    const plays = 14 + Math.floor(rnd() * 6)
    for (let i = 0; i < plays; i++) {
      const team = rnd() < 0.52 ? H : A
      const five = team === H ? home.slice(0, 5) : away.slice(0, 5)
      const shooter = pick(five)
      const r = rnd()
      if (r < 0.42) {
        const made = rnd() < 0.5
        push({ eventType: "SCORE_2PT", teamId: team, playerId: shooter, made, period: q })
        if (made && rnd() < 0.6) {
          push({
            eventType: "ASSIST",
            teamId: team,
            playerId: pick(five.filter((p) => p !== shooter)),
            period: q,
          })
        }
        if (!made) {
          const other = team === H ? away.slice(0, 5) : home.slice(0, 5)
          push({
            eventType: "REBOUND",
            teamId: team === H ? A : H,
            playerId: pick(other),
            period: q,
            metadata: { offensive: false },
          })
        }
      } else if (r < 0.6) {
        push({ eventType: "SCORE_3PT", teamId: team, playerId: shooter, made: rnd() < 0.35, period: q })
      } else if (r < 0.75) {
        push({ eventType: "SCORE_FT", teamId: team, playerId: shooter, made: rnd() < 0.7, period: q })
        push({ eventType: "SCORE_FT", teamId: team, playerId: shooter, made: rnd() < 0.7, period: q })
      } else if (r < 0.9) {
        push({
          eventType: "FOUL",
          teamId: team,
          playerId: shooter,
          period: q,
          metadata: q === 3 && i === 3 ? { technical: true } : undefined,
        })
      } else {
        push({ eventType: "STEAL", teamId: team, playerId: shooter, period: q })
      }
    }
    // line change: bring the 6th man in for the 5th starter
    for (const [team, roster] of [
      [H, home],
      [A, away],
    ] as const) {
      push({
        eventType: "SUBSTITUTION",
        teamId: team,
        period: q,
        metadata: { inPlayerId: roster[5], outPlayerId: roster[4 - (q % 2)] },
      })
    }
    push({ eventType: "PERIOD_END", period: q })
  }

  await (prisma as any).gameEvent.createMany({ data: events })

  // Finalize exactly like the API: fold → scores + PlayerStat + COMPLETED
  const folded = foldEvents(
    events.map((e) => ({ ...e, timestampMs: e.timestamp.getTime() })),
    { homeTeamId: H, awayTeamId: A }
  )
  await (prisma as any).$transaction(async (tx: any) => {
    await tx.game.update({
      where: { id: game.id },
      data: {
        homeScore: folded.homeScore,
        awayScore: folded.awayScore,
        status: "COMPLETED",
        finalizedAt: new Date(),
        refereeName: "Alex Morgan",
        refereeSignedAt: new Date(),
      },
    })
    await tx.playerStat.createMany({
      data: Object.values(folded.players).map((l) => ({
        gameId: game.id,
        playerId: l.playerId,
        points: l.points,
        rebounds: totalRebounds(l),
        assists: l.assists,
        steals: l.steals,
        blocks: l.blocks,
        turnovers: l.turnovers,
        fouls: l.fouls,
      })),
    })
  })

  console.log("")
  console.log(`FINISHED DEMO GAME: ${folded.homeScore} — ${folded.awayScore} (referee-signed)`)
  console.log(`  scoresheet page: http://localhost:3000/scoresheet/${game.id}`)
  console.log(`  PDF download:    http://localhost:3000/api/scoresheet/${game.id}`)
  console.log(`  game page:       http://localhost:3000/live/${game.id}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
