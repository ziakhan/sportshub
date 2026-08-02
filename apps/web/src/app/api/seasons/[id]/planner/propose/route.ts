import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { buildPlannerState } from "@/lib/scheduler/planner"
import { proposePlan, suggestFor } from "@/lib/scheduler/planner-core"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  lever: z.enum(["balance", "compact", "spread"]).default("balance"),
})

/** POST /api/seasons/[id]/planner/propose {lever} — deterministic proposal,
 *  nothing saved. The board previews it; Apply persists it. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: "Invalid lever" }, { status: 400 })

    const state = await buildPlannerState(params.id)
    const assignment = proposePlan(state, parsed.data.lever)
    return NextResponse.json({
      lever: parsed.data.lever,
      assignment,
      suggestions: suggestFor(state, assignment),
    })
  } catch (error) {
    console.error("Planner propose error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
