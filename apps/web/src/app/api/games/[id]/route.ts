import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const patchSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  venueId: z.string().nullable().optional(),
  courtId: z.string().nullable().optional(),
  dayId: z.string().nullable().optional(),
  dayVenueId: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  homeTeamId: z.string().optional(),
  awayTeamId: z.string().optional(),
  status: z
    .enum(["SCHEDULED", "LIVE", "COMPLETED", "CANCELLED", "POSTPONED", "DEFAULTED"])
    .optional(),
  isLocked: z.boolean().optional(),
  defaultedBy: z.string().nullable().optional(),
  duration: z.number().int().min(10).max(240).optional(),
})

async function loadGameWithOwner(gameId: string) {
  return (await (prisma as any).game.findUnique({
    where: { id: gameId },
    include: {
      season: { select: { id: true, status: true, league: { select: { ownerId: true } } } },
    },
  })) as any
}

/**
 * GET /api/games/[id] — fetch a single game with relations.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const game = await (prisma as any).game.findUnique({
      where: { id: params.id },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        venue: { select: { id: true, name: true } },
        court: { select: { id: true, name: true } },
        season: { select: { id: true, label: true, leagueId: true } },
      },
    })
    if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ game })
  } catch (error) {
    console.error("Game GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/games/[id] — edit time/venue/court/teams/status.
 * Validates against team and court double-bookings within the season.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const game = await loadGameWithOwner(params.id)
    if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (
      game.season?.league?.ownerId !== sessionInfo.userId &&
      !sessionInfo.isPlatformAdmin
    )
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const data = patchSchema.parse(body)

    // Derived values for conflict check
    const newStart = data.scheduledAt ? new Date(data.scheduledAt) : new Date(game.scheduledAt)
    const duration = data.duration ?? game.duration ?? 90
    const newEnd = new Date(newStart.getTime() + duration * 60000)
    const newCourtId = data.courtId !== undefined ? data.courtId : game.courtId
    const newHomeTeamId = data.homeTeamId ?? game.homeTeamId
    const newAwayTeamId = data.awayTeamId ?? game.awayTeamId

    if (newHomeTeamId === newAwayTeamId) {
      return NextResponse.json(
        { error: "Home and away team must differ" },
        { status: 400 }
      )
    }

    // Conflict check only applies when the game is still active
    const nextStatus = data.status ?? game.status
    const checkConflicts =
      game.seasonId && ["SCHEDULED", "LIVE", "POSTPONED"].includes(nextStatus)

    if (checkConflicts) {
      const overlappers = await (prisma as any).game.findMany({
        where: {
          seasonId: game.seasonId,
          id: { not: params.id },
          status: { in: ["SCHEDULED", "LIVE"] },
          OR: [
            { homeTeamId: { in: [newHomeTeamId, newAwayTeamId] } },
            { awayTeamId: { in: [newHomeTeamId, newAwayTeamId] } },
            ...(newCourtId ? [{ courtId: newCourtId }] : []),
          ],
        },
        select: {
          id: true,
          scheduledAt: true,
          duration: true,
          homeTeamId: true,
          awayTeamId: true,
          courtId: true,
        },
      })
      const conflicts: string[] = []
      for (const g of overlappers) {
        const gStart = new Date(g.scheduledAt)
        const gEnd = new Date(gStart.getTime() + (g.duration ?? 90) * 60000)
        const overlaps = gStart < newEnd && newStart < gEnd
        if (!overlaps) continue
        if (g.homeTeamId === newHomeTeamId || g.awayTeamId === newHomeTeamId)
          conflicts.push(`Home team double-booked against game ${g.id}`)
        if (g.homeTeamId === newAwayTeamId || g.awayTeamId === newAwayTeamId)
          conflicts.push(`Away team double-booked against game ${g.id}`)
        if (newCourtId && g.courtId === newCourtId)
          conflicts.push(`Court double-booked against game ${g.id}`)
      }
      if (conflicts.length > 0) {
        return NextResponse.json(
          { error: "Conflict detected", conflicts },
          { status: 409 }
        )
      }
    }

    const update: Record<string, any> = {}
    if (data.scheduledAt !== undefined) update.scheduledAt = new Date(data.scheduledAt)
    if (data.venueId !== undefined) update.venueId = data.venueId
    if (data.courtId !== undefined) update.courtId = data.courtId
    if (data.dayId !== undefined) update.dayId = data.dayId
    if (data.dayVenueId !== undefined) update.dayVenueId = data.dayVenueId
    if (data.sessionId !== undefined) update.sessionId = data.sessionId
    if (data.homeTeamId !== undefined) update.homeTeamId = data.homeTeamId
    if (data.awayTeamId !== undefined) update.awayTeamId = data.awayTeamId
    if (data.status !== undefined) update.status = data.status
    if (data.isLocked !== undefined) update.isLocked = data.isLocked
    if (data.defaultedBy !== undefined) update.defaultedBy = data.defaultedBy
    if (data.duration !== undefined) update.duration = data.duration

    const updated = await (prisma as any).game.update({
      where: { id: params.id },
      data: update,
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        venue: { select: { id: true, name: true } },
        court: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json({ game: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Game PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/games/[id] — mark the game CANCELLED (soft). Refuses if
 * the game has a final score already.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const game = await loadGameWithOwner(params.id)
    if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (
      game.season?.league?.ownerId !== sessionInfo.userId &&
      !sessionInfo.isPlatformAdmin
    )
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (game.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot cancel a completed game" },
        { status: 400 }
      )
    }

    const updated = await (prisma as any).game.update({
      where: { id: params.id },
      data: { status: "CANCELLED" },
    })
    return NextResponse.json({ game: updated })
  } catch (error) {
    console.error("Game DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
