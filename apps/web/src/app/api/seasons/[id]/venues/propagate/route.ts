import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import {
  defaultCourtIdsForVenue,
  propagateVenueToSessions,
} from "@/lib/seasons/venue-propagation"

export const dynamic = "force-dynamic"

const propagateSchema = z.object({ venueId: z.string() })

/**
 * POST /api/seasons/[id]/venues/propagate — add an already-attached venue
 * (with its default courts) to every session that doesn't use it yet. The
 * "Add to all sessions" action when a venue arrived after sessions did.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const season = await prisma.season.findUnique({
      where: { id: params.id },
      select: { status: true, league: { select: { ownerId: true } } },
    })
    if (!season || (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (isSeasonLocked(season.status)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: season.status },
        { status: 409 }
      )
    }

    const { venueId } = propagateSchema.parse(await request.json())
    const seasonVenue = await (prisma as any).seasonVenue.findUnique({
      where: { seasonId_venueId: { seasonId: params.id, venueId } },
      select: { courtsAvailable: true, hours: { select: { openTime: true, closeTime: true } } },
    })
    if (!seasonVenue) {
      return NextResponse.json({ error: "Venue is not attached to this season" }, { status: 404 })
    }

    const courtIds = await defaultCourtIdsForVenue(venueId, seasonVenue.courtsAvailable)
    if (courtIds.length === 0) {
      return NextResponse.json(
        { error: "This venue has no courts yet — add courts first." },
        { status: 400 }
      )
    }
    const withHours = (seasonVenue.hours ?? []).find((h: any) => h.openTime && h.closeTime)
    const addedToSessions = await propagateVenueToSessions(params.id, venueId, courtIds, {
      startTime: withHours?.openTime ?? "09:00",
      endTime: withHours?.closeTime ?? "18:00",
    })
    return NextResponse.json({ success: true, addedToSessions })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Venue propagate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
