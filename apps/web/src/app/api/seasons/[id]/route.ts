import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/seasons/[id] — Get season details (includes league, divisions, team submissions, counts)
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      include: {
        league: { select: { id: true, name: true, description: true, ownerId: true } },
        divisions: { orderBy: { ageGroup: "asc" } },
        teamSubmissions: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                ageGroup: true,
                gender: true,
                tenant: { select: { id: true, name: true, slug: true } },
              },
            },
            division: { select: { id: true, name: true } },
          },
        },
        _count: { select: { teamSubmissions: true, games: true, sessions: true } },
      },
    })

    if (!season) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({
      ...season,
      teamFee: season.teamFee ? Number(season.teamFee) : null,
      teamSubmissions: season.teamSubmissions.map((t: any) => ({
        ...t,
        registrationFee: t.registrationFee ? Number(t.registrationFee) : null,
      })),
    })
  } catch (error) {
    console.error("Get season error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/seasons/[id] — Update season fields (scheduling, pricing, status)
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { leagueId: true, league: { select: { ownerId: true } } },
    })
    if (!season) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const isOwner = season.league.ownerId === sessionInfo.userId
    if (!isOwner && !sessionInfo.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const update: Record<string, any> = {}

    // Tiebreaker order locks at finalize via tiebreakersLockedAt. Reject any
    // attempt to mutate it after the lock is set.
    if (body.tiebreakerOrder !== undefined) {
      const seasonLock = await (prisma as any).season.findUnique({
        where: { id: params.id },
        select: { tiebreakersLockedAt: true },
      })
      if (seasonLock?.tiebreakersLockedAt) {
        return NextResponse.json(
          {
            error: "Tiebreakers are locked for this season and cannot be edited.",
            tiebreakersLockedAt: seasonLock.tiebreakersLockedAt,
          },
          { status: 409 }
        )
      }
    }

    if (body.label !== undefined) update.label = body.label
    const passThrough = [
      "type",
      "status",
      "gamesGuaranteed",
      "gameSlotMinutes",
      "gameLengthMinutes",
      "gamePeriods",
      "periodLengthMinutes",
      "targetGamesPerSession",
      "idealGamesPerDayPerTeam",
      "defaultVenueOpenTime",
      "defaultVenueCloseTime",
      "playoffFormat",
      "playoffTeams",
      "schedulingPhilosophy",
      "allowCrossDivisionScheduling",
      "tiebreakerOrder",
    ]
    for (const field of passThrough) {
      if (body[field] !== undefined) update[field] = body[field]
    }
    if (body.teamFee !== undefined) update.teamFee = body.teamFee
    if (body.startDate) update.startDate = new Date(body.startDate)
    if (body.endDate) update.endDate = new Date(body.endDate)
    if (body.registrationDeadline)
      update.registrationDeadline = new Date(body.registrationDeadline)
    if (body.ageGroupCutoffDate) update.ageGroupCutoffDate = new Date(body.ageGroupCutoffDate)

    let finalizeWarnings: string[] = []

    // Preflight + lock when transitioning to FINALIZED
    if (body.status === "FINALIZED") {
      const preflight = await (prisma as any).season.findUnique({
        where: { id: params.id },
        include: {
          divisions: {
            select: {
              id: true,
              name: true,
              schedulingGroups: { select: { schedulingGroupId: true } },
              _count: {
                select: {
                  teamSubmissions: {
                    where: { status: { in: ["PENDING", "APPROVED"] } },
                  },
                },
              },
            },
          },
          sessions: {
            select: {
              id: true,
              label: true,
              days: {
                select: {
                  id: true,
                  dayVenues: {
                    select: {
                      id: true,
                      startTime: true,
                      endTime: true,
                      courts: { select: { id: true } },
                    },
                  },
                },
              },
            },
          },
          seasonVenues: { select: { id: true } },
          teamSubmissions: { select: { id: true, status: true } },
          schedulingGroups: {
            select: { id: true, divisions: { select: { divisionId: true } } },
          },
        },
      })

      const effective = { ...(preflight as any), ...update }
      const missing: string[] = []
      const warnings: string[] = []

      if (!effective.gamesGuaranteed)
        missing.push("Max games per team per season must be set in Scheduling Settings")
      if (!effective.periodLengthMinutes)
        missing.push("Period / half length (minutes) must be set in Scheduling Settings")
      if (preflight.divisions.length === 0)
        missing.push("At least one division is required")
      if (preflight.sessions.length === 0)
        missing.push("At least one game session is required")
      if (preflight.seasonVenues.length === 0)
        missing.push("At least one venue must be assigned")
      const pendingCount = preflight.teamSubmissions.filter(
        (t: any) => t.status === "PENDING"
      ).length
      if (pendingCount > 0)
        missing.push(
          `${pendingCount} team(s) are still pending — approve or reject all teams first`
        )

      // NEW: every session has ≥1 day with ≥1 day-venue with ≥1 court
      for (const s of preflight.sessions as any[]) {
        const hasUsableDay = (s.days ?? []).some((d: any) =>
          (d.dayVenues ?? []).some((dv: any) => (dv.courts ?? []).length > 0)
        )
        if (!hasUsableDay) {
          missing.push(
            `Session "${s.label || s.id.slice(0, 6)}" needs at least one day with a venue and court`
          )
        }
      }

      // NEW: tiebreaker order non-empty
      const effectiveTiebreakers: string[] = Array.isArray(effective.tiebreakerOrder)
        ? effective.tiebreakerOrder
        : []
      if (effectiveTiebreakers.length === 0)
        missing.push("Tiebreaker order is empty — configure at least one rule in the Tiebreakers tab")

      // NEW: every division in a scheduling group has ≥2 teams (only when cross-division scheduling is on)
      if (effective.allowCrossDivisionScheduling) {
        const divisionById = new Map<string, any>()
        for (const d of preflight.divisions as any[]) divisionById.set(d.id, d)
        const groupedDivisionIds = new Set<string>()
        for (const g of (preflight.schedulingGroups ?? []) as any[]) {
          for (const link of g.divisions ?? []) groupedDivisionIds.add(link.divisionId)
        }
        for (const divId of groupedDivisionIds) {
          const d = divisionById.get(divId)
          const teamCount = d?._count?.teamSubmissions ?? 0
          if (teamCount < 2) {
            missing.push(
              `Division "${d?.name ?? divId}" is in a scheduling group but has ${teamCount} team(s) — needs at least 2`
            )
          }
        }
      }

      // NEW: feasibility warning — court-minutes available vs. required
      const gameSlotMinutes: number = effective.gameSlotMinutes ?? 90
      const gamesGuaranteed: number = effective.gamesGuaranteed ?? 0
      const approvedTeamCount = preflight.teamSubmissions.filter(
        (t: any) => t.status === "APPROVED"
      ).length
      const requiredGameCount = Math.ceil((approvedTeamCount * gamesGuaranteed) / 2)
      const requiredCourtMinutes = requiredGameCount * gameSlotMinutes

      const parseHHMM = (hhmm?: string | null): number | null => {
        if (!hhmm) return null
        const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm)
        if (!m) return null
        return parseInt(m[1]) * 60 + parseInt(m[2])
      }
      let availableCourtMinutes = 0
      for (const s of preflight.sessions as any[]) {
        for (const d of s.days ?? []) {
          for (const dv of d.dayVenues ?? []) {
            const start = parseHHMM(dv.startTime) ?? parseHHMM(effective.defaultVenueOpenTime)
            const end = parseHHMM(dv.endTime) ?? parseHHMM(effective.defaultVenueCloseTime)
            const window = start !== null && end !== null ? Math.max(0, end - start) : 0
            availableCourtMinutes += window * (dv.courts?.length ?? 0)
          }
        }
      }
      if (requiredCourtMinutes > 0 && availableCourtMinutes < requiredCourtMinutes) {
        warnings.push(
          `Feasibility: ~${requiredCourtMinutes} court-minutes needed for ${requiredGameCount} games, but only ${availableCourtMinutes} are configured. The scheduler may leave games unplaced.`
        )
      }

      if (missing.length > 0) {
        return NextResponse.json(
          { error: "Cannot finalize: requirements not met", missing, warnings },
          { status: 422 }
        )
      }

      await (prisma as any).seasonRoster.updateMany({
        where: { seasonId: params.id },
        data: { isLocked: true, lockedAt: new Date() },
      })

      // Lock tiebreakers on successful finalize
      update.tiebreakersLockedAt = new Date()
      finalizeWarnings = warnings
    }

    const updated = await (prisma as any).season.update({
      where: { id: params.id },
      data: update,
      include: { league: { select: { id: true, name: true, description: true, ownerId: true } } },
    })

    return NextResponse.json({
      success: true,
      ...updated,
      teamFee: updated.teamFee ? Number(updated.teamFee) : null,
      warnings: finalizeWarnings,
    })
  } catch (error) {
    console.error("Update season error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/seasons/[id] — Delete season (only if no games or submissions yet)
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: {
        league: { select: { ownerId: true } },
        _count: { select: { games: true, teamSubmissions: true } },
      },
    })
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const isOwner = season.league.ownerId === sessionInfo.userId
    if (!isOwner && !sessionInfo.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (season._count.games > 0 || season._count.teamSubmissions > 0) {
      return NextResponse.json(
        { error: "Cannot delete a season with games or team submissions" },
        { status: 409 }
      )
    }

    await (prisma as any).season.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete season error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
