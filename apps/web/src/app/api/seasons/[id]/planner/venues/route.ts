import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { buildVenueWeekendGrid } from "@/lib/seasons/venue-grid"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"

export const dynamic = "force-dynamic"

/**
 * GET /api/seasons/[id]/planner/venues — the gyms-and-weekends grid: every
 * gym on the season, every weekend, and each cell's on / released / custom
 * hours state. Includes the weekends a gym is NOT on, so the grid can offer
 * a toggle back on instead of hiding the option.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const grid = await buildVenueWeekendGrid(params.id)
    // The Fridays declaration rides along (owner design 2026-08-11, QA
    // T-018): step 2 asks the question and needs the season's current answer.
    const season = (await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { fridayPolicy: true },
    })) as any
    return NextResponse.json({
      grid,
      seasonStatus: gate.seasonStatus,
      fridayPolicy: season?.fridayPolicy ?? null,
    })
  } catch (error) {
    console.error("Planner venue grid error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** A court held back is a court, not a policy: a small whole number, and
 *  bigger than any real gym is a typo, not an instruction. */
const patchSchema = z.object({
  courtBuffer: z.number().int().min(0).max(10),
})

/**
 * PATCH /api/seasons/[id]/planner/venues — the season's court buffer (owner
 * ruling 2026-08-03): how many courts the league leaves empty at every gym,
 * every day, for overruns and the teams that arrive late.
 *
 * It lives on the grid route because it is a fact about GYM TIME, and step 2
 * is where gym time is edited. Same gate as the rest of the planner
 * (seasonPlannerAuth) and the same lock: a finalized season's capacity is
 * history, not a setting. Answers with the rebuilt grid so the screen never
 * has to guess what it just saved.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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
        { error: "Courts held back has to be a whole number from 0 to 10." },
        { status: 400 }
      )
    }

    await (prisma as any).season.update({
      where: { id: params.id },
      data: { courtBuffer: parsed.data.courtBuffer },
    })
    const grid = await buildVenueWeekendGrid(params.id)
    return NextResponse.json({
      success: true,
      courtBuffer: parsed.data.courtBuffer,
      grid,
      seasonStatus: gate.seasonStatus,
    })
  } catch (error) {
    console.error("Planner court buffer error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
