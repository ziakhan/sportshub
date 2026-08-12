import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { buildPlannerState } from "@/lib/scheduler/planner"
import {
  packPlanVenues,
  planRentalBlocks,
  proposePlan,
  rentalAsk,
  suggestFor,
} from "@/lib/scheduler/planner-core"
import { fridayPolicyPrepass, fridayPolicyRescue, withFridayBlocks } from "@/lib/scheduler/plan-world"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  // "one-gym" is balance with a second building priced ten times higher
  // (owner 2026-08-02: "pack one gym" is one of the options).
  lever: z.enum(["balance", "compact", "spread", "one-gym"]).default("balance"),
})

/** POST /api/seasons/[id]/planner/propose {lever} — deterministic proposal,
 *  nothing saved. The board previews it; Apply persists it. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: "Invalid lever" }, { status: 400 })

    const base = await buildPlannerState(params.id)
    // The Fridays declaration (owner design 2026-08-11, QA T-018): REGULAR
    // folds the Friday windows in as normal capacity before the solve;
    // IF_NEEDED plans Sat+Sun first and adds Friday supply only where the
    // drawn load leaves a weekend over or tight. No declaration = both maps
    // empty = the old path, byte for byte.
    const pre = fridayPolicyPrepass(base)
    const preState = withFridayBlocks(base, pre)
    const assignment = proposePlan(preState, parsed.data.lever)
    const rescue = fridayPolicyRescue(preState, assignment)
    const state = withFridayBlocks(preState, rescue)
    const venues = packPlanVenues(state, assignment)
    // What the plan RENTS (owner ruling 2026-08-03). Derived, never stored:
    // the plan document keeps the calendar and the gyms, and the blocks are
    // read off them so they can never drift.
    const blocks = planRentalBlocks(state, assignment, venues)
    return NextResponse.json({
      lever: parsed.data.lever,
      assignment,
      // Which building each grade plays in, weekend by weekend. Apply sends
      // this straight back so the saved plan keeps the gyms it was scored on.
      venues,
      blocks,
      // Friday blocks the declaration added (courtCapKey → courts). Additive:
      // a reader that does not know about them still has the whole answer.
      fridays: { ...pre, ...rescue },
      ask: rentalAsk(state, blocks),
      suggestions: suggestFor(state, assignment),
    })
  } catch (error) {
    console.error("Planner propose error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
