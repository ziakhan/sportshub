/**
 * Demo-world states the pitch deck needs but the seeded world does not have.
 *
 *   npx tsx scripts/demo/seed-deck-states.ts
 *
 * Two screens in the deck could not be photographed because nothing would
 * render, and neither is a screenshot problem:
 *
 *   PLANNING  The planner draws from a SeasonPlan and there were none, and the
 *             summer season is finalized so the UI refuses to write one
 *             ("This season is finalized, so no new plan can be written").
 *             Every planner step therefore showed a read-only shell: no team
 *             counts, no gyms, no weekend grid.
 *
 *   PLAYOFFS  The bracket draws from season.playoffPlan. Generating one needs
 *             a finished regular season so seeds resolve, and the live season
 *             is mid-play.
 *
 * This creates BOTH as separate, disposable seasons. It never touches the live
 * summer season, which the demo directory and the pitch world both run on.
 *
 *   1. "<League> · Planning" — a DRAFT season carrying the same venues and the
 *      same teams as summer, with no plan yet, so the planner opens writable
 *      and its five steps have real content to show.
 *
 *   2. The playoff twin is NOT built here. Use the existing end-of-season
 *      seeder, which already does it properly and deterministically:
 *
 *        SOURCE_SEASON=<summer season id> npx tsx scripts/demo/seed-nph-endseason.ts
 *
 *      That yields a completed copy with every game scored, which is the
 *      precondition the playoff generator needs.
 *
 * Re-runnable: the planning season is dropped and rebuilt each time, so the
 * capture pass can be repeated without accumulating junk.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const SOURCE_SEASON = process.env.SOURCE_SEASON ?? "75f3bdac-8bac-4a2c-8a14-a9d1d79f7c4e"
const PLANNING_LABEL = process.env.PLANNING_LABEL ?? "Fall 2026 (planning)"

async function main() {
  const src = await (prisma as any).season.findUnique({
    where: { id: SOURCE_SEASON },
    include: {
      league: { select: { id: true, name: true } },
      seasonVenues: { include: { hours: true } },
      sessions: { include: { days: true } },
      teamSubmissions: { select: { teamId: true, divisionId: true, status: true } },
      divisions: { select: { id: true, name: true, ageGroup: true } },
    },
  })
  if (!src) throw new Error(`source season ${SOURCE_SEASON} not found`)
  console.log(`source: ${src.league?.name} / ${src.label}`)
  console.log(
    `  ${src.seasonVenues.length} venues · ${src.teamSubmissions.length} team entries · ${src.divisions.length} divisions`,
  )

  /* Rebuilt every run so repeated capture passes do not pile up seasons. */
  const existing = await (prisma as any).season.findMany({
    where: { leagueId: src.leagueId, label: PLANNING_LABEL },
    select: { id: true },
  })
  for (const s of existing) await (prisma as any).season.delete({ where: { id: s.id } })
  if (existing.length) console.log(`  removed ${existing.length} prior planning season(s)`)

  /* DRAFT, and deliberately WITHOUT planPublishedAt: that combination is what
     makes the planner writable, which is the whole point of this season. */
  const season = await (prisma as any).season.create({
    data: {
      leagueId: src.leagueId,
      label: PLANNING_LABEL,
      type: src.type,
      status: "DRAFT",
      /* Without a date range and sessions the calendar step draws its chrome
         and then says "This season has no weekends yet", which is the empty
         board again. The weekends ARE the grid. */
      startDate: src.startDate,
      endDate: src.endDate,
      registrationDeadline: src.registrationDeadline,
      gamesGuaranteed: src.gamesGuaranteed,
      gameSlotMinutes: src.gameSlotMinutes,
      gameLengthMinutes: src.gameLengthMinutes,
      defaultVenueOpenTime: src.defaultVenueOpenTime,
      defaultVenueCloseTime: src.defaultVenueCloseTime,
      courtBuffer: src.courtBuffer,
      schedulingPhilosophy: src.schedulingPhilosophy,
      allowCrossDivisionScheduling: src.allowCrossDivisionScheduling,
      tiebreakerOrder: src.tiebreakerOrder,
      teamFee: src.teamFee,
      currency: src.currency,
    },
  })

  /* The gyms are what step 2 puts on the board, and step 3 cannot compute a
     calendar without their hours. */
  for (const sv of src.seasonVenues) {
    const copy = await (prisma as any).seasonVenue.create({
      data: {
        seasonId: season.id,
        venueId: sv.venueId,
        isPrimary: sv.isPrimary,
        courtsAvailable: sv.courtsAvailable,
        fillOrder: sv.fillOrder,
        role: sv.role,
      },
    })
    for (const h of sv.hours ?? []) {
      const { id, seasonVenueId, ...rest } = h
      await (prisma as any).seasonVenueHours.create({ data: { ...rest, seasonVenueId: copy.id } })
    }
  }

  /* The weekends. Each session is one weekend on the board, and its days are
     the dates inside it. */
  let weekends = 0
  for (const sess of src.sessions ?? []) {
    const made = await (prisma as any).seasonSession.create({
      data: {
        seasonId: season.id,
        label: sess.label,
        phase: sess.phase,
        targetGamesPerTeam: sess.targetGamesPerTeam,
        unitKeys: sess.unitKeys ?? [],
        unitVenues: sess.unitVenues ?? undefined,
      },
    })
    for (const d of sess.days ?? []) {
      const { id, sessionId, ...rest } = d
      await (prisma as any).seasonSessionDay.create({ data: { ...rest, sessionId: made.id } })
    }
    weekends++
  }

  /* Divisions carry the grade labels the planner groups teams by. */
  const divMap = new Map<string, string>()
  for (const d of src.divisions) {
    const made = await (prisma as any).division.create({
      data: { seasonId: season.id, name: d.name, ageGroup: d.ageGroup },
    })
    divMap.set(d.id, made.id)
  }

  /* Approved entries, so step 1 shows real counts per grade rather than zeros
     and "last season" has something to hint with. */
  let entries = 0
  for (const ts of src.teamSubmissions) {
    await (prisma as any).teamSubmission.create({
      data: {
        seasonId: season.id,
        teamId: ts.teamId,
        divisionId: ts.divisionId ? (divMap.get(ts.divisionId) ?? null) : null,
        status: "APPROVED",
      },
    })
    entries++
  }

  console.log(`\nplanning season ${season.id}`)
  console.log(`  ${src.seasonVenues.length} venues · ${weekends} weekends · ${entries} approved entries · ${divMap.size} divisions`)
  console.log(`  URL: /manage/leagues/${src.leagueId}/seasons/${season.id}/plan`)
  console.log(`\nFor the playoff bracket, run:`)
  console.log(`  SOURCE_SEASON=${SOURCE_SEASON} npx tsx scripts/demo/seed-nph-endseason.ts`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
