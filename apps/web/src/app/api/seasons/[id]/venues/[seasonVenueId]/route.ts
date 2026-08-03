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
 * It also carries `role` — what this gym IS to the league (owner ruling
 * 2026-08-03): "home" is the building it owns, which fills first and costs
 * nothing, and "pool" is a gym it rents by the court-day. HOME IS EXCLUSIVE:
 * naming one gym home makes every other gym of the season pool, in one
 * transaction, because a league owns one building and two home gyms would
 * make every rental number a guess.
 *
 * `fillOrder` is still accepted so an older client does not 400, but it is a
 * dead column: nothing in the planner reads it. Neither a role change nor a
 * fill-order write is a capacity edit, so neither touches courts or rewires a
 * weekend.
 *
 * Same gate as the wave-1 session-venue routes: league owner or platform
 * admin, and never on a finalized season.
 */

const patchSchema = z
  .object({
    courtsAvailable: z.number().int().min(1).max(30).optional(),
    role: z.enum(["home", "pool"]).optional(),
    fillOrder: z.number().int().min(0).max(99).optional(),
  })
  .refine(
    (v) =>
      v.courtsAvailable !== undefined || v.role !== undefined || v.fillOrder !== undefined,
    { message: "courtsAvailable, role or fillOrder required" }
  )

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
    const { courtsAvailable, role, fillOrder } = parsed.data

    // The link row must belong to THIS season (IDOR guard).
    const seasonVenue = await prisma.seasonVenue.findFirst({
      where: { id: params.seasonVenueId, seasonId: params.id },
      select: { id: true, venueId: true, venue: { select: { name: true } } },
    })
    if (!seasonVenue) {
      return NextResponse.json({ error: "Season venue not found" }, { status: 404 })
    }
    const venueId = (seasonVenue as any).venueId as string
    const venueName = (seasonVenue as any).venue?.name ?? null

    /** Naming the home gym is exclusive: one building, one owner. Every other
     *  gym of the season becomes pool in the same transaction, so there is
     *  never a moment where two gyms are free. */
    const writeRole = async () => {
      if (role === undefined) return
      if (role !== "home") {
        await prisma.seasonVenue.update({
          where: { id: params.seasonVenueId },
          data: { role: "pool" },
        })
        return
      }
      await (prisma as any).$transaction([
        (prisma as any).seasonVenue.updateMany({
          where: { seasonId: params.id, id: { not: params.seasonVenueId } },
          data: { role: "pool" },
        }),
        (prisma as any).seasonVenue.update({
          where: { id: params.seasonVenueId },
          data: { role: "home" },
        }),
      ])
    }

    // Roles and ordering alone: no courts change, so nothing gets rewired.
    if (courtsAvailable === undefined) {
      await writeRole()
      if (fillOrder !== undefined) {
        await prisma.seasonVenue.update({
          where: { id: params.seasonVenueId },
          data: { fillOrder },
        })
      }
      return NextResponse.json({ success: true, role: role ?? null, fillOrder, venueName })
    }
    await writeRole()

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
      data: fillOrder === undefined ? { courtsAvailable } : { courtsAvailable, fillOrder },
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
      role: role ?? null,
      fillOrder: fillOrder ?? null,
      venueName,
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
