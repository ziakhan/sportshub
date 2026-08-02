import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { applyAssignment, buildPlannerState } from "@/lib/scheduler/planner"
import { currentAssignment, suggestFor } from "@/lib/scheduler/planner-core"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  assignment: z.record(z.string(), z.array(z.string()).max(50)),
})

/** POST /api/seasons/[id]/planner/apply {assignment} — persist a plan onto
 *  SeasonSession.unitKeys (grade clusters expand to division keys; the
 *  scheduler reads the same column it always has). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    // The board goes read-only when the season locks; the API must agree
    // (wave 3 review, 2026-08-02 — the client was the only guard).
    if (isSeasonLocked(gate.seasonStatus)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: gate.seasonStatus },
        { status: 409 }
      )
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "assignment required" }, { status: 400 })

    const { updated } = await applyAssignment(params.id, parsed.data.assignment)
    const state = await buildPlannerState(params.id)
    return NextResponse.json({
      success: true,
      updated,
      state,
      suggestions: suggestFor(state, currentAssignment(state)),
    })
  } catch (error) {
    console.error("Planner apply error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
