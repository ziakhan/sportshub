import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { findOwnedPlan } from "@/lib/scheduler/season-plans"

export const dynamic = "force-dynamic"

/**
 * POST .../division-intent — set one grade's "run as N divisions" intent on
 * a plan. Exists because the ACTIVE plan's board draws the season (no
 * sandbox world in the session), yet its stored settings are exactly where
 * the one-button generate reads division intents from — so the control
 * needs a write path that works for every plan (owner hit the disabled
 * control on his real plan, 2026-08-09).
 */
const bodySchema = z.object({
  gradeKey: z.string().min(1).max(80),
  count: z.number().int().min(1).max(4),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; planId: string } }
) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    const plan = await findOwnedPlan(params.id, params.planId)
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const { gradeKey, count } = bodySchema.parse(await req.json())
    const settings = (plan.settings ?? {}) as any
    const state = { ...(settings.state ?? {}) }
    const plans = { ...(state.divisionPlans ?? {}) }
    if (count <= 1) delete plans[gradeKey]
    else plans[gradeKey] = { count }
    state.divisionPlans = plans
    await (prisma as any).seasonPlan.update({
      where: { id: plan.id },
      data: { settings: { ...settings, state } },
    })
    return NextResponse.json({ saved: true, divisionPlans: plans })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("division-intent error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
