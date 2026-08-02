import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import {
  attachVenueToSession,
  clearSessionVenueUnavailability,
  defaultCourtIdsForVenue,
  detachVenueFromSession,
} from "@/lib/seasons/venue-propagation"

export const dynamic = "force-dynamic"

/**
 * One gym, one weekend (planner step 2, owner 2026-08-02). The season-wide
 * venue endpoints stay where they are; these two only ever touch the days of
 * the session named in the path, so ticking a cell off releases that weekend
 * and nothing else.
 *
 * Turning a weekend ON is also the operator's override of a weekend the
 * season had marked unavailable ("Taken: NJC/NSC"): the mark is dropped here,
 * server side, so the grid can never show a gym both attached and taken.
 * Turning one OFF stays plain off — only defaults and imports write reasons.
 */

const postSchema = z.object({
  /** Explicit courts for this weekend; defaults to the season's court set. */
  courtIds: z.array(z.string()).optional(),
})

type Ctx = { params: { id: string; sessionId: string; venueId: string } }

interface Gate {
  error?: NextResponse
  seasonVenue?: { id: string; courtsAvailable: number | null }
}

/** Shared preamble: owner-or-admin, season unlocked, gym is on the season. */
async function gateFor(params: Ctx["params"]): Promise<Gate> {
  const gate = await seasonPlannerAuth(params.id)
  if (gate.status !== 200) {
    return { error: NextResponse.json({ error: gate.error }, { status: gate.status }) }
  }
  if (isSeasonLocked(gate.seasonStatus)) {
    return {
      error: NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: gate.seasonStatus },
        { status: 409 }
      ),
    }
  }
  const seasonVenue = await prisma.seasonVenue.findFirst({
    where: { seasonId: params.id, venueId: params.venueId },
    select: { id: true, courtsAvailable: true },
  })
  if (!seasonVenue) {
    return {
      error: NextResponse.json(
        { error: "That gym is not on this season yet. Add it first." },
        { status: 404 }
      ),
    }
  }
  const session = await (prisma as any).seasonSession.findFirst({
    where: { id: params.sessionId, seasonId: params.id },
    select: { id: true },
  })
  if (!session) {
    return { error: NextResponse.json({ error: "Weekend not found" }, { status: 404 }) }
  }
  return { seasonVenue }
}

/** POST — put this gym on this one weekend. */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const gate = await gateFor(params)
    if (gate.error) return gate.error

    const body = await request.json().catch(() => ({}))
    const parsed = postSchema.safeParse(body ?? {})
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", details: parsed.error.errors }, { status: 400 })
    }

    const courtIds =
      parsed.data.courtIds?.length
        ? parsed.data.courtIds
        : await defaultCourtIdsForVenue(params.venueId, gate.seasonVenue!.courtsAvailable)

    if (courtIds.length === 0) {
      return NextResponse.json(
        { error: "This gym has no courts yet. Add courts before putting it on a weekend." },
        { status: 400 }
      )
    }

    // Courts must belong to the gym (IDOR guard — a court id from another
    // venue would otherwise be schedulable here).
    const owned = await (prisma as any).court.count({
      where: { id: { in: courtIds }, venueId: params.venueId },
    })
    if (owned !== courtIds.length) {
      return NextResponse.json({ error: "Those courts are not at this gym" }, { status: 400 })
    }

    // The override, before the attach: whatever the season had said about
    // this weekend, the operator has just said otherwise.
    const overrode = await clearSessionVenueUnavailability(
      params.id,
      params.sessionId,
      params.venueId
    )
    const result = await attachVenueToSession(params.id, params.sessionId, params.venueId, courtIds)
    return NextResponse.json({ success: true, ...result, overrodeUnavailable: overrode })
  } catch (error) {
    console.error("Attach venue to session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE — release this gym from this one weekend. */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const gate = await gateFor(params)
    if (gate.error) return gate.error

    const result = await detachVenueFromSession(params.id, params.sessionId, params.venueId)
    if (result.gamesBlocking > 0) {
      return NextResponse.json(
        {
          error: `${result.gamesBlocking} game${result.gamesBlocking === 1 ? " is" : "s are"} already scheduled at this gym that weekend. Move or remove them first.`,
          gamesBlocking: result.gamesBlocking,
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Release venue from session error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
