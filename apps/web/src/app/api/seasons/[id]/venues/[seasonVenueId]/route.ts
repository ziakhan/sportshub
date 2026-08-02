import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import {
  applyVenueCourtsToSessionDays,
  defaultCourtIdsForVenue,
} from "@/lib/seasons/venue-propagation"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/seasons/[id]/venues/[seasonVenueId] — how many courts THIS
 * season runs at this gym, edited on the step-2 card (owner 2026-08-02: the
 * courts chip was a fact you could not change, and changing it anywhere else
 * never reached the weekends the planner counts).
 *
 * Three things happen together, because any one of them alone is a lie:
 *   1. SeasonVenue.courtsAvailable is the number,
 *   2. missing courts are created ("Court 6") so the number is real,
 *   3. every weekend the gym is already on is rewired to that court set, so
 *      planner capacity moves with it.
 *
 * Same gate as the wave-1 session-venue routes: league owner or platform
 * admin, and never on a finalized season.
 */

const patchSchema = z.object({
  courtsAvailable: z.number().int().min(1).max(30),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; seasonVenueId: string } }
) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    if (isSeasonLocked(gate.seasonStatus)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: gate.seasonStatus },
        { status: 409 }
      )
    }

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error?.errors ?? [] },
        { status: 400 }
      )
    }
    const { courtsAvailable } = parsed.data

    // The link row must belong to THIS season (IDOR guard).
    const seasonVenue = await prisma.seasonVenue.findFirst({
      where: { id: params.seasonVenueId, seasonId: params.id },
      select: { id: true, venueId: true, venue: { select: { name: true } } },
    })
    if (!seasonVenue) {
      return NextResponse.json({ error: "Season venue not found" }, { status: 404 })
    }
    const venueId = (seasonVenue as any).venueId as string

    // Pick "6 courts" and Court 1…Court 6 exist immediately — the same
    // auto-create the season-venue setup card does (owner 2026-07-31).
    const existing = await (prisma as any).court.count({ where: { venueId } })
    if (existing < courtsAvailable) {
      await (prisma as any).court.createMany({
        data: Array.from({ length: courtsAvailable - existing }, (_, i) => ({
          venueId,
          name: `Court ${existing + i + 1}`,
          displayOrder: existing + i,
        })),
      })
    }

    await prisma.seasonVenue.update({
      where: { id: params.seasonVenueId },
      data: { courtsAvailable },
    })

    const courtIds = await defaultCourtIdsForVenue(venueId, courtsAvailable)
    const rewire = await applyVenueCourtsToSessionDays(params.id, venueId, courtIds)

    const blockedCourts =
      rewire.blockedCourtIds.length > 0
        ? await (prisma as any).court.findMany({
            where: { id: { in: rewire.blockedCourtIds } },
            orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
            select: { id: true, name: true },
          })
        : []

    return NextResponse.json({
      success: true,
      courtsAvailable,
      venueName: (seasonVenue as any).venue?.name ?? null,
      courtCount: courtIds.length,
      daysRewired: rewire.daysRewired,
      daysBlocked: rewire.daysBlocked,
      courtsAdded: rewire.courtsAdded,
      courtsRemoved: rewire.courtsRemoved,
      blockedCourts,
    })
  } catch (error) {
    console.error("Season venue court count error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
