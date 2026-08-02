import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import { setSessionVenueWindow } from "@/lib/seasons/venue-propagation"

export const dynamic = "force-dynamic"

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

const patchSchema = z.union([
  z.object({
    startTime: z.string().regex(timeRegex),
    endTime: z.string().regex(timeRegex),
  }),
  z.object({ reset: z.literal(true) }),
])

/**
 * PATCH /api/seasons/[id]/sessions/[sessionId]/venues/[venueId]/hours —
 * a one-weekend hours exception, edited on the grid cell (owner 2026-08-02).
 *
 * Writes only this session's day-venue rows. SeasonVenueHours — the
 * season-wide default the rest of the weekends inherit — is never touched,
 * which is the whole distinction the step-2 screen makes: season-wide edits
 * live on the gym card, one-off overrides live on the cell.
 *
 * `{ reset: true }` puts the weekend back on the season default.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string; venueId: string } }
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

    const seasonVenue = await prisma.seasonVenue.findFirst({
      where: { seasonId: params.id, venueId: params.venueId },
      select: { id: true },
    })
    if (!seasonVenue) {
      return NextResponse.json(
        { error: "That gym is not on this season yet. Add it first." },
        { status: 404 }
      )
    }

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Provide startTime and endTime as HH:MM, or reset: true" },
        { status: 400 }
      )
    }

    const window = "reset" in parsed.data ? null : parsed.data
    if (window && window.startTime >= window.endTime) {
      return NextResponse.json({ error: "The end time has to be after the start time" }, { status: 400 })
    }

    const result = await setSessionVenueWindow(
      params.id,
      params.sessionId,
      params.venueId,
      window ? { startTime: window.startTime, endTime: window.endTime } : null
    )
    if (result.updated === 0) {
      return NextResponse.json(
        { error: "This gym is not on that weekend yet, so there are no hours to change." },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Session venue hours error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
