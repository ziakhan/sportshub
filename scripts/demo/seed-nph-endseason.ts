/**
 * END-OF-SEASON TWIN (owner 2026-08-08): a copy of the NPH Showcase world
 * with every regular-season game COMPLETED and scored, so standings exist,
 * seeds resolve, and the playoff generator demonstrates the full
 * "structure now, teams later" lifecycle with real names. Deterministic
 * scores (hash of source game id — no randomness, re-runnable).
 *
 * Run: DATABASE_URL=... npx tsx scripts/demo/seed-nph-endseason.ts
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const SOURCE_SEASON = "160b2f09-a95a-4a64-9b90-03793cae105b"
const TWIN_LEAGUE_NAME = "NPH Showcase League — End of Season"

const hash = (s: string): number => {
  let h = 7
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 1_000_003
  return h
}

async function main() {
  const src = await (prisma as any).season.findUnique({
    where: { id: SOURCE_SEASON },
    include: {
      league: true,
      divisions: { include: { teamSubmissions: { where: { status: "APPROVED" } } } },
      sessions: {
        include: { days: { include: { dayVenues: { include: { courts: true } } } } },
      },
    },
  })
  if (!src) throw new Error("source season not found")

  // Re-runnable: replace an earlier twin wholesale.
  const prior = await (prisma as any).league.findFirst({ where: { name: TWIN_LEAGUE_NAME } })
  if (prior) {
    await (prisma as any).game.deleteMany({ where: { season: { leagueId: prior.id } } })
    await (prisma as any).league.delete({ where: { id: prior.id } })
    console.log("removed prior twin")
  }

  const league = await (prisma as any).league.create({
    data: {
      name: TWIN_LEAGUE_NAME,
      ownerId: src.league.ownerId,
      tenantId: src.league.tenantId ?? undefined,
      organizationId: src.league.organizationId ?? undefined,
      sport: src.league.sport ?? undefined,
      currency: src.league.currency,
    },
  })

  const season = await (prisma as any).season.create({
    data: {
      leagueId: league.id,
      label: `${src.label ?? "Season"} (completed)`,
      status: "IN_PROGRESS",
      startDate: src.startDate,
      endDate: src.endDate,
      gamesGuaranteed: src.gamesGuaranteed,
      gameSlotMinutes: src.gameSlotMinutes,
      gameLengthMinutes: src.gameLengthMinutes,
      courtBuffer: src.courtBuffer,
      registrationOpenAt: src.registrationOpenAt,
      registrationCloseAt: src.registrationCloseAt,
    },
  })

  /* Divisions + submissions (same Team rows — the twin shares the clubs). */
  const divMap = new Map<string, string>()
  for (const d of src.divisions) {
    const nd = await (prisma as any).division.create({
      data: {
        seasonId: season.id,
        name: d.name,
        ageGroup: d.ageGroup,
        gender: d.gender ?? undefined,
        tier: d.tier ?? 1,
        expectedTeams: d.expectedTeams ?? undefined,
      },
    })
    divMap.set(d.id, nd.id)
    for (const ts of d.teamSubmissions) {
      await (prisma as any).teamSubmission.create({
        data: {
          seasonId: season.id,
          divisionId: nd.id,
          teamId: ts.teamId,
          status: "APPROVED",
          weekendStyle: ts.weekendStyle ?? undefined,
        },
      })
    }
  }

  /* Sessions/days/venues/courts, with unitVenues division ids remapped. */
  const sessMap = new Map<string, string>()
  const dayMap = new Map<string, string>()
  const dvMap = new Map<string, string>()
  for (const sess of src.sessions) {
    const unitVenues: Record<string, string> = {}
    if (sess.unitVenues && typeof sess.unitVenues === "object") {
      for (const [k, v] of Object.entries(sess.unitVenues as Record<string, string>)) {
        const m = /^division:(.+)$/.exec(k)
        if (m && divMap.has(m[1])) unitVenues[`division:${divMap.get(m[1])}`] = v
      }
    }
    const unitKeys = Array.isArray(sess.unitKeys)
      ? (sess.unitKeys as string[])
          .map((k) => {
            const m = /^division:(.+)$/.exec(k)
            return m && divMap.has(m[1]) ? `division:${divMap.get(m[1])}` : null
          })
          .filter(Boolean)
      : []
    const ns = await (prisma as any).seasonSession.create({
      data: {
        seasonId: season.id,
        label: sess.label,
        phase: sess.phase,
        targetGamesPerTeam: sess.targetGamesPerTeam,
        unitKeys: unitKeys as string[],
        unitVenues: Object.keys(unitVenues).length > 0 ? unitVenues : undefined,
      },
    })
    sessMap.set(sess.id, ns.id)
    for (const day of sess.days) {
      const nday = await (prisma as any).seasonSessionDay.create({
        data: { sessionId: ns.id, date: day.date },
      })
      dayMap.set(day.id, nday.id)
      for (const dv of day.dayVenues) {
        const ndv = await (prisma as any).seasonSessionDayVenue.create({
          data: {
            dayId: nday.id,
            venueId: dv.venueId,
            startTime: dv.startTime,
            endTime: dv.endTime,
            bookingStatus: dv.bookingStatus ?? undefined,
          },
        })
        dvMap.set(dv.id, ndv.id)
        for (const c of dv.courts) {
          await (prisma as any).seasonSessionDayVenueCourt.create({
            data: { dayVenueId: ndv.id, courtId: c.courtId, order: c.order ?? 0 },
          })
        }
      }
    }
  }

  /* The season's games, COMPLETED with deterministic scores. */
  const games = await (prisma as any).game.findMany({
    where: { seasonId: SOURCE_SEASON, phase: "REGULAR", status: { not: "CANCELLED" } },
  })
  let created = 0
  for (const g of games) {
    const h = hash(g.id)
    const home = 45 + (h % 40)
    let away = 45 + (Math.floor(h / 40) % 40)
    if (away === home) away += 3 // basketball never ties
    await (prisma as any).game.create({
      data: {
        seasonId: season.id,
        phase: "REGULAR",
        sessionId: g.sessionId ? sessMap.get(g.sessionId) : undefined,
        dayId: g.dayId ? dayMap.get(g.dayId) : undefined,
        dayVenueId: g.dayVenueId ? dvMap.get(g.dayVenueId) : undefined,
        courtId: g.courtId,
        venueId: g.venueId,
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        scheduledAt: g.scheduledAt,
        duration: g.duration,
        status: "COMPLETED",
        homeScore: home,
        awayScore: away,
        isLocked: false,
      },
    })
    created++
  }

  // The My Leagues drawer lists LeagueOwner ROLE rows, not League.ownerId
  // (discovered when the owner couldn't see the twin) — grant it.
  await (prisma as any).userRole.create({
    data: { userId: src.league.ownerId, role: "LeagueOwner", leagueId: league.id },
  })

  console.log(`twin league ${league.id}`)
  console.log(`twin season ${season.id}`)
  console.log(`completed games: ${created}`)
  console.log(
    `URL: /manage/leagues/${league.id}/seasons/${season.id}/manage?tab=playoffs`
  )
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
