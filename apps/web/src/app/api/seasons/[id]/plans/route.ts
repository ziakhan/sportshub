import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import {
  assignmentSchema,
  currentSettings,
  ensureImportedPlan,
  freshSettings,
  planSettingsSchema,
  planSourceSchema,
  PLAN_LIST_SELECT,
  sanitizePlanWorld,
  venuesSchema,
} from "@/lib/scheduler/season-plans"
import { settingsOf } from "@/lib/scheduler/plan-world"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  name: z.string().trim().min(1).max(60),
  /**
   * A FRESH PLAN HAS NO CALENDAR (owner ruling 2026-08-05). It cannot: a plan
   * chooses its own weekends and its own gym time, so there is nothing to solve
   * against until the operator has said when the league runs. So `assignment`
   * is optional now, and `fresh: true` asks for the starting world — the
   * season's grades with their numbers, and no gym time assumed at all.
   */
  assignment: assignmentSchema.optional(),
  venues: venuesSchema.optional(),
  source: planSourceSchema.default("manual"),
  fresh: z.boolean().optional(),
  /** The world to save it in. Ignored when `fresh` is asked for. */
  settings: planSettingsSchema.optional(),
})

/**
 * GET /api/seasons/[id]/plans — every calendar this season holds, for the
 * dropdown. Active first, then newest, so the plan currently driving the
 * season is always the row on top.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })

    // Deliberately NOT behind isSeasonLocked: the snapshot writes down a
    // calendar that already exists rather than changing one, and a finalized
    // season is exactly when an operator most wants to read back what was
    // published. Every route that CHANGES a plan keeps the lock guard.
    await ensureImportedPlan(params.id)

    const plans = await (prisma as any).seasonPlan.findMany({
      where: { seasonId: params.id },
      select: PLAN_LIST_SELECT,
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    })
    return NextResponse.json({ plans })
  } catch (error) {
    console.error("Season plans list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/seasons/[id]/plans {name, assignment, venues?, source?} — save the
 * board as a named plan. Saved, not applied: the new plan sits alongside the
 * others until somebody activates it, so an operator can keep three ideas
 * around without the season lurching between them.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
    if (!parsed.success) return NextResponse.json({ error: "A name is required" }, { status: 400 })

    // Before the operator's first save, not after: once a row exists the lazy
    // snapshot never fires again, and the league's own published calendar
    // would be lost behind the plan that replaced it.
    await ensureImportedPlan(params.id)

    /**
     * THE WORLD IT IS SAVED IN. Three cases, and each is the honest one:
     *  - `fresh`: the starting world. Grades prefilled, no gym time assumed.
     *  - a world the operator sent (a copy taken while editing a plan's own
     *    world): kept, after being clamped to ids this season really has.
     *  - nothing sent: the season as it stands, read HERE rather than taken
     *    from the client, which is how it has always worked.
     */
    const settings = parsed.data.fresh
      ? await freshSettings(params.id)
      : parsed.data.settings
        ? settingsOf(await sanitizePlanWorld(params.id, parsed.data.settings.state))
        : await currentSettings(params.id)

    const plan = await (prisma as any).seasonPlan.create({
      data: {
        seasonId: params.id,
        name: parsed.data.name,
        source: parsed.data.source,
        assignment: parsed.data.assignment ?? {},
        venues: parsed.data.venues ?? {},
        settings,
        isActive: false,
      },
    })
    return NextResponse.json({ plan })
  } catch (error) {
    console.error("Season plan create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
