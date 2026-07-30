import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { auditSafe } from "@/lib/audit"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/** "Summer 2026" -> "Summer 2027", "2026-27" -> "2027-28", else "<label> (next year)". */
function advanceLabel(label: string): string {
  const range = label.match(/^(.*?)(\d{4})-(\d{2})(.*)$/)
  if (range) {
    const y = Number(range[2])
    return `${range[1]}${y + 1}-${String((Number(range[3]) + 1) % 100).padStart(2, "0")}${range[4]}`
  }
  const single = label.match(/^(.*?)(\d{4})(.*)$/)
  if (single) return `${single[1]}${Number(single[2]) + 1}${single[3]}`
  return `${label} (next year)`
}

const YEAR_MS = 364 * 86400_000 // +364 keeps weekday alignment
const shift = (d: Date | null) => (d ? new Date(new Date(d).getTime() + YEAR_MS) : null)

/**
 * POST /api/seasons/[id]/clone — "renew for next year" (owner 2026-07-29:
 * league names persist, seasons renew). Deep-copies the season's SETUP —
 * config/rules, divisions, venue allocations + per-season hours, session
 * pattern shifted +364 days — and NONE of its outcomes (teams, rosters,
 * games, fees). New season lands in DRAFT for the operator to adjust.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      include: {
        league: { select: { id: true, name: true, ownerId: true } },
        divisions: true,
        seasonVenues: { include: { hours: true } },
        sessions: { include: { days: { include: { dayVenues: { include: { courts: true } } } } } },
      },
    })
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 })

    const allowed =
      auth.isPlatformAdmin ||
      season.league.ownerId === auth.userId ||
      !!(await prisma.userRole.findFirst({
        where: {
          userId: auth.userId,
          leagueId: season.league.id,
          role: { in: ["LeagueOwner", "LeagueManager"] },
        },
        select: { id: true },
      }))
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let label = advanceLabel(season.label)
    const clash = await (prisma as any).season.findFirst({
      where: { leagueId: season.league.id, label },
      select: { id: true },
    })
    if (clash) label = `${label} (copy)`

    const created = await (prisma as any).$transaction(async (tx: any) => {
      const next = await tx.season.create({
        data: {
          leagueId: season.league.id,
          label,
          type: season.type,
          status: "DRAFT",
          startDate: shift(season.startDate),
          endDate: shift(season.endDate),
          registrationDeadline: shift(season.registrationDeadline),
          ageGroupCutoffDate: shift(season.ageGroupCutoffDate),
          teamFee: season.teamFee,
          currency: season.currency,
          depositPct: season.depositPct,
          gamePeriods: season.gamePeriods,
          periodLengthMinutes: season.periodLengthMinutes,
          gamesGuaranteed: season.gamesGuaranteed,
          targetGamesPerSession: season.targetGamesPerSession,
          idealGamesPerDayPerTeam: season.idealGamesPerDayPerTeam,
          gameSlotMinutes: season.gameSlotMinutes,
          gameLengthMinutes: season.gameLengthMinutes,
          defaultVenueOpenTime: season.defaultVenueOpenTime,
          defaultVenueCloseTime: season.defaultVenueCloseTime,
          schedulingPhilosophy: season.schedulingPhilosophy,
          allowCrossDivisionScheduling: season.allowCrossDivisionScheduling,
          tiebreakerOrder: season.tiebreakerOrder,
          rosterChangePolicy: season.rosterChangePolicy,
          playoffMinGames: season.playoffMinGames,
          allowGuestPlayers: season.allowGuestPlayers,
        },
        select: { id: true },
      })
      for (const d of season.divisions) {
        await tx.division.create({
          data: {
            seasonId: next.id,
            name: d.name,
            ageGroup: d.ageGroup,
            gender: d.gender,
            tier: d.tier,
            maxTeams: d.maxTeams,
          },
        })
      }
      for (const sv of season.seasonVenues) {
        await tx.seasonVenue.create({
          data: {
            seasonId: next.id,
            venueId: sv.venueId,
            isPrimary: sv.isPrimary,
            courtsAvailable: sv.courtsAvailable,
            hours: {
              create: sv.hours.map((h: any) => ({
                dayOfWeek: h.dayOfWeek,
                openTime: h.openTime,
                closeTime: h.closeTime,
              })),
            },
          },
        })
      }
      for (const sess of season.sessions) {
        const newSession = await tx.seasonSession.create({
          data: {
            seasonId: next.id,
            label: sess.label,
            phase: sess.phase,
            targetGamesPerTeam: sess.targetGamesPerTeam,
          },
          select: { id: true },
        })
        for (const day of sess.days) {
          const newDay = await tx.seasonSessionDay.create({
            data: { sessionId: newSession.id, date: shift(day.date) },
            select: { id: true },
          })
          for (const dv of day.dayVenues) {
            const newDv = await tx.seasonSessionDayVenue.create({
              data: {
                dayId: newDay.id,
                venueId: dv.venueId,
                startTime: dv.startTime,
                endTime: dv.endTime,
              },
              select: { id: true },
            })
            for (const c of dv.courts) {
              await tx.seasonSessionDayVenueCourt.create({
                data: { dayVenueId: newDv.id, courtId: c.courtId },
              })
            }
          }
        }
      }
      return next
    })

    await auditSafe({
      actorId: auth.realUserId,
      actorRole: "LeagueOwner",
      action: "SEASON_CLONED",
      resource: "Season",
      resourceId: created.id,
      changes: { fromSeasonId: params.id, fromLabel: season.label, label },
      request,
    })

    return NextResponse.json({ id: created.id, label }, { status: 201 })
  } catch (error) {
    console.error("Season clone error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
