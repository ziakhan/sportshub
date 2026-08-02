import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { planHoursPreview } from "@/lib/scheduler/planner"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  // Four hours either way is more than any operator moves a gym day, and it
  // keeps a stray value from asking for a season-long recompute of nothing.
  deltaStartMinutes: z.number().int().min(-240).max(240).default(0),
  deltaEndMinutes: z.number().int().min(-240).max(240).default(0),
  // The calendar on screen, which may be an unsaved proposal. Session ids and
  // unit keys are seed-friendly plain strings, never uuids.
  assignment: z.record(z.string(), z.array(z.string())).optional(),
})

/**
 * POST /api/seasons/[id]/planner/preview-hours {deltaStartMinutes,
 * deltaEndMinutes, assignment} — what an earlier start, a later start or an
 * earlier finish would do to THIS plan (owner 2026-08-02).
 *
 * Read only by construction: the shifted day window lives in memory for the
 * length of the request. Applying the change goes through the ordinary season
 * venue hours route, the same one step 2 writes with.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: "Invalid hours change" }, { status: 400 })

    const preview = await planHoursPreview(
      params.id,
      {
        startMinutes: parsed.data.deltaStartMinutes,
        endMinutes: parsed.data.deltaEndMinutes,
      },
      parsed.data.assignment
    )
    return NextResponse.json({ preview })
  } catch (error) {
    console.error("Planner preview-hours error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
