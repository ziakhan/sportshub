import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import {
  attachVenueToSession,
  defaultCourtIdsForVenue,
  detachVenueFromSession,
} from "@/lib/seasons/venue-propagation"

export const dynamic = "force-dynamic"

/**
 * POST /api/seasons/[id]/venues/[seasonVenueId]/toggle-season { on } — a gym
 * on, or off, for the WHOLE season in one press (owner 2026-08-02: "turning a
 * gym off for every weekend is the same as not having that gym", and trying a
 * one-gym season against a two-gym season should cost one click, not thirteen).
 *
 * Same gate as the sibling court/fill-order route: league owner or platform
 * admin, never on a finalized season, and the link row must belong to THIS
 * season.
 *
 * On: every REGULAR weekend the season already has gets the gym, on the
 * season's own court count. Weekends that do not exist yet are not created —
 * this turns a gym on, it does not invent a calendar.
 *
 * Off: every weekend releases it, except the ones where a game is already
 * scheduled at that gym. Those are reported back rather than silently
 * stranding a game, exactly the way one-weekend release does.
 */

const bodySchema = z.object({ on: z.boolean() })

export async function POST(
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

    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error?.errors ?? [] },
        { status: 400 }
      )
    }
    const { on } = parsed.data

    // The link row must belong to THIS season (IDOR guard).
    const seasonVenue = await prisma.seasonVenue.findFirst({
      where: { id: params.seasonVenueId, seasonId: params.id },
      select: { id: true, venueId: true, courtsAvailable: true, venue: { select: { name: true } } },
    })
    if (!seasonVenue) {
      return NextResponse.json({ error: "Season venue not found" }, { status: 404 })
    }
    const venueId = (seasonVenue as any).venueId as string
    const venueName = (seasonVenue as any).venue?.name ?? null

    const sessions = await (prisma as any).seasonSession.findMany({
      where: { seasonId: params.id, phase: "REGULAR" },
      select: { id: true },
      orderBy: { id: "asc" },
    })

    let weekendsChanged = 0
    let weekendsBlocked = 0
    let gamesBlocking = 0

    if (on) {
      const courtIds = await defaultCourtIdsForVenue(venueId, (seasonVenue as any).courtsAvailable)
      if (courtIds.length === 0) {
        return NextResponse.json(
          { error: "This gym has no courts yet. Set its court count first." },
          { status: 400 }
        )
      }
      for (const session of sessions) {
        const res = await attachVenueToSession(params.id, session.id, venueId, courtIds)
        if (res.daysAttached > 0) weekendsChanged++
      }
    } else {
      for (const session of sessions) {
        const res = await detachVenueFromSession(params.id, session.id, venueId)
        if (res.gamesBlocking > 0) {
          weekendsBlocked++
          gamesBlocking += res.gamesBlocking
        } else if (res.daysReleased > 0) {
          weekendsChanged++
        }
      }
    }

    return NextResponse.json({
      success: true,
      on,
      venueName,
      weekends: sessions.length,
      weekendsChanged,
      weekendsBlocked,
      gamesBlocking,
    })
  } catch (error) {
    console.error("Season venue whole-season toggle error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
