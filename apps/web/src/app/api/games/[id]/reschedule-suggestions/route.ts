import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { buildSlots } from "@/lib/scheduler/generate"
import { loadSchedulerInput } from "@/lib/scheduler/load"

export const dynamic = "force-dynamic"

/**
 * POST /api/games/[id]/reschedule-suggestions
 * Returns ranked alternate slots for the given game. A slot is viable if:
 *   - no other active game in the season uses the same court at that time
 *   - neither team is booked at that time
 * Ranking prefers slots on the same session day, then chronologically nearest
 * to the original time.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const game = (await (prisma as any).game.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        seasonId: true,
        scheduledAt: true,
        duration: true,
        homeTeamId: true,
        awayTeamId: true,
        courtId: true,
        dayId: true,
        season: { select: { league: { select: { ownerId: true } } } },
      },
    })) as any
    if (!game || !game.seasonId)
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (
      game.season?.league?.ownerId !== sessionInfo.userId &&
      !sessionInfo.isPlatformAdmin
    )
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { input, errors } = await loadSchedulerInput(game.seasonId)
    if (!input || errors.length > 0) {
      return NextResponse.json({ error: "Season incomplete", errors }, { status: 422 })
    }

    const slots = buildSlots(input)

    // Other active games in the season (excluding this one)
    const otherGames = (await (prisma as any).game.findMany({
      where: {
        seasonId: game.seasonId,
        id: { not: params.id },
        status: { in: ["SCHEDULED", "LIVE"] },
      },
      select: {
        scheduledAt: true,
        duration: true,
        courtId: true,
        homeTeamId: true,
        awayTeamId: true,
      },
    })) as Array<any>

    const toRange = (scheduledAt: Date, duration: number) => ({
      start: scheduledAt.getTime(),
      end: scheduledAt.getTime() + duration * 60000,
    })
    const otherRanges = otherGames.map((g) => ({
      ...toRange(new Date(g.scheduledAt), g.duration ?? 90),
      courtId: g.courtId,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
    }))

    const targetStart = new Date(game.scheduledAt).getTime()

    const viable = slots
      .map((s) => {
        const sStart = s.startAt.getTime()
        const sEnd = s.endAt.getTime()
        const overlap = otherRanges.find((r) => sStart < r.end && r.start < sEnd)
        if (overlap) {
          if (overlap.courtId === s.courtId) return null
          if (
            overlap.homeTeamId === game.homeTeamId ||
            overlap.awayTeamId === game.homeTeamId ||
            overlap.homeTeamId === game.awayTeamId ||
            overlap.awayTeamId === game.awayTeamId
          )
            return null
        }
        const sameDay = s.dayId === game.dayId
        const distance = Math.abs(sStart - targetStart)
        return {
          slot: s,
          score: (sameDay ? 1000 : 0) - distance / 60000,
        }
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => b.score - a.score)
      .slice(0, 25)

    return NextResponse.json({
      suggestions: viable.map((v) => ({
        sessionId: v.slot.sessionId,
        dayId: v.slot.dayId,
        dayVenueId: v.slot.dayVenueId,
        courtId: v.slot.courtId,
        venueId: v.slot.venueId,
        startAt: v.slot.startAt.toISOString(),
        endAt: v.slot.endAt.toISOString(),
        sameDay: v.slot.dayId === game.dayId,
      })),
    })
  } catch (error) {
    console.error("Reschedule suggestions error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
