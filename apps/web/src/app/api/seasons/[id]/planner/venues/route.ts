import { NextRequest, NextResponse } from "next/server"
import { buildVenueWeekendGrid } from "@/lib/seasons/venue-grid"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"

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
    return NextResponse.json({ grid, seasonStatus: gate.seasonStatus })
  } catch (error) {
    console.error("Planner venue grid error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
