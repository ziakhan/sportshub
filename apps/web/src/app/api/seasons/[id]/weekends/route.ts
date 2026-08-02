import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import {
  attachVenueToSession,
  clearVenueUnavailability,
  defaultCourtIdsForVenue,
  ensureWeekendSession,
} from "@/lib/seasons/venue-propagation"

export const dynamic = "force-dynamic"

/**
 * POST /api/seasons/[id]/weekends — turn a gym on for a weekend the season
 * does not have yet (planner step 2, owner 2026-08-02: "make it open for
 * every month, all weekends, and people can choose"). The grid draws every
 * Sat–Sun of the season; most of them have no session, so one tap has to
 * create the weekend and attach the gym together, or the operator would be
 * sent off to a sessions screen to do it by hand.
 *
 * Weekends that already exist keep using the per-session endpoint
 * (sessions/[sessionId]/venues/[venueId]); this one is idempotent either way.
 *
 * Same override rule as that endpoint: putting the gym on a weekend the
 * season had marked unavailable ("Taken: NJC/NSC") drops the mark, because
 * the operator has just said the season does have it after all.
 */

const postSchema = z.object({
  /** The Saturday of the weekend, YYYY-MM-DD or a full ISO date. */
  satDate: z.string().min(8),
  venueId: z.string().min(1),
  /** Explicit courts for this weekend; defaults to the season's court set. */
  courtIds: z.array(z.string()).optional(),
})

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }
    if (isSeasonLocked(gate.seasonStatus)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: gate.seasonStatus },
        { status: 409 }
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = postSchema.safeParse(body ?? {})
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.errors },
        { status: 400 }
      )
    }
    const { satDate, venueId } = parsed.data

    const seasonVenue = await prisma.seasonVenue.findFirst({
      where: { seasonId: params.id, venueId },
      select: { id: true, courtsAvailable: true },
    })
    if (!seasonVenue) {
      return NextResponse.json(
        { error: "That gym is not on this season yet. Add it first." },
        { status: 404 }
      )
    }

    const courtIds = parsed.data.courtIds?.length
      ? parsed.data.courtIds
      : await defaultCourtIdsForVenue(venueId, seasonVenue.courtsAvailable)
    if (courtIds.length === 0) {
      return NextResponse.json(
        { error: "This gym has no courts yet. Add courts before putting it on a weekend." },
        { status: 400 }
      )
    }

    // Courts must belong to the gym (IDOR guard — a court id from another
    // venue would otherwise be schedulable here).
    const owned = await (prisma as any).court.count({
      where: { id: { in: courtIds }, venueId },
    })
    if (owned !== courtIds.length) {
      return NextResponse.json({ error: "Those courts are not at this gym" }, { status: 400 })
    }

    const weekend = await ensureWeekendSession(params.id, satDate)
    if (!weekend) {
      return NextResponse.json(
        { error: "That is not a weekend on this season. Pick a Saturday." },
        { status: 400 }
      )
    }

    const overrode = await clearVenueUnavailability(params.id, venueId, [satDate])
    const result = await attachVenueToSession(params.id, weekend.sessionId, venueId, courtIds)
    return NextResponse.json({
      success: true,
      sessionId: weekend.sessionId,
      createdSession: weekend.created,
      ...result,
      overrodeUnavailable: overrode,
    })
  } catch (error) {
    console.error("Add weekend error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
