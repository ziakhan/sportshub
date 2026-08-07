import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import {
  ACTIVE_PLAN_DELETE_MESSAGE,
  assignmentSchema,
  currentSettings,
  findOwnedPlan,
  IMPORTED_PLAN_DELETE_MESSAGE,
  IMPORTED_PLAN_READONLY_MESSAGE,
  planSettingsSchema,
  sanitizePlanWorld,
  venuesSchema,
} from "@/lib/scheduler/season-plans"
import { settingsOf, withHealedGyms, worldGyms } from "@/lib/scheduler/plan-world"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  assignment: assignmentSchema.optional(),
  venues: venuesSchema.optional(),
  /**
   * THE PLAN'S OWN WORLD (owner ruling 2026-08-05; write-through died
   * 2026-08-07). Steps 1 and 2 edit THIS on every plan, active included: the
   * grade estimates and which grades are in, the gyms with their roles,
   * courts and hours, which weekends the plan runs and which gym it has on
   * each. The season's rows never move from here — only the generate button,
   * a separate endpoint, does that.
   */
  settings: planSettingsSchema.optional(),
})

/** GET — the whole document, assignment and gyms included, for loading a plan
 *  onto the board. `settings` rides along: the world the plan was saved in, so
 *  the board can draw it under its own numbers and name the drift.
 *
 *  EVERY PLAN READS ITS OWN STORED SETTINGS NOW, the active plan included
 *  (write-through died, owner ruling 2026-08-07: plans are sandboxes, full
 *  stop). The active plan used to be read LIVE off the season's own rows,
 *  because steps 1 and 2 wrote straight through to them and a stored snapshot
 *  would have started disagreeing with the rows it had just written. Now every
 *  step writes the plan's own document and nothing else, so the active plan is
 *  a plan like any other: it reads what was saved, same as every plan below
 *  it in the list. The season only takes on a plan's world through the
 *  generate button, never through this route. */
export async function GET(_request: NextRequest, { params }: { params: { id: string; planId: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const plan = await findOwnedPlan(params.id, params.planId)
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })
    /**
     * A PLAN SAVED BEFORE PLANS HAD A ROSTER IS HEALED ON OPEN (owner ruling
     * 2026-08-06), the same way its grades are.
     *
     * `gyms` arrived after the first plans did, so those documents opened onto a
     * step 2 with half its controls missing: no rank arrows, no bookings picker,
     * nothing to explain it. The season's buildings are folded in here, keeping
     * everything the plan already knew about the ones it had, and SAVED FORWARD
     * so a plan is only ever healed once.
     *
     * It is a read that writes, deliberately and narrowly: the alternative is
     * every step healing its own copy and disagreeing about the result.
     */
    const world = plan.settings?.state
    if (world) {
      const healed = withHealedGyms(world, worldGyms((await currentSettings(params.id)).state))
      if (healed !== world) {
        const settings = settingsOf(healed)
        await (prisma as any).seasonPlan.update({ where: { id: plan.id }, data: { settings } })
        return NextResponse.json({ plan: { ...plan, settings } })
      }
      return NextResponse.json({ plan })
    }
    /**
     * A PLAN WITH NO WORLD AT ALL IS GIVEN ONE THE SAME WAY (2026-08-06 wave,
     * A2; extended 2026-08-07 to the active plan too, now that write-through
     * has died and an active plan is exactly as likely to arrive here with
     * nothing saved as any other). Documents from before plans owned a world
     * open onto steps that have nothing to draw: step 1 hangs on "opening this
     * plan's numbers" and step 2 quietly shows the season's buildings under
     * the plan's name. The nearest record of the world those plans were drawn
     * in IS the season's — the same answer PATCH has always given a
     * null-settings plan on its first content write — so it is recorded here
     * once and saved forward. The reference plan included: this is the system
     * writing down what it already knows, not an operator rewriting the
     * published record.
     */
    const settings = await currentSettings(params.id)
    await (prisma as any).seasonPlan.update({ where: { id: plan.id }, data: { settings } })
    return NextResponse.json({ plan: { ...plan, settings } })
  } catch (error) {
    console.error("Season plan read error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH {name?, assignment?, venues?} — rename a plan, or rewrite what it
 * says. Renaming is always allowed, including on the imported reference;
 * rewriting its CONTENT is not, because that reference is the only record of
 * what the league actually published.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string; planId: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    if (isSeasonLocked(gate.seasonStatus)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: gate.seasonStatus },
        { status: 409 }
      )
    }

    const plan = await findOwnedPlan(params.id, params.planId)
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    const { name, assignment, venues, settings: sent } = parsed.data
    if (name === undefined && assignment === undefined && venues === undefined && sent === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    // Its world is its content too: the reference plan is the only record of
    // what the league published, including the gyms and estimates it was
    // published under.
    const rewritesContent = assignment !== undefined || venues !== undefined || sent !== undefined
    if (rewritesContent && plan.source === "imported") {
      return NextResponse.json({ error: IMPORTED_PLAN_READONLY_MESSAGE }, { status: 409 })
    }

    /**
     * WHOSE WORLD THE PLAN KEEPS (owner ruling 2026-08-05; the active-plan
     * case retired 2026-08-07). Two cases now:
     *
     *  - the operator SENT a world: that is the plan's world now, clamped to
     *    ids this season has. Every plan takes this path the same way, the
     *    active plan included — plans are sandboxes, full stop, so an active
     *    plan's steps write its own document exactly like any other plan's.
     *  - the plan predates worlds entirely (settings still null): the
     *    season's world is snapshotted once, so the plan has something to
     *    compare and draw rather than nothing.
     *  - anything else: LEFT ALONE. A plan that owns its world must not have it
     *    quietly replaced by this month's season just because its calendar was
     *    saved — that was the bug the whole ruling is about.
     */
    const settings =
      sent !== undefined
        ? settingsOf(await sanitizePlanWorld(params.id, sent.state))
        : rewritesContent && plan.settings == null
          ? await currentSettings(params.id)
          : undefined

    const updated = await (prisma as any).seasonPlan.update({
      where: { id: plan.id },
      data: {
        ...(name === undefined ? {} : { name }),
        ...(assignment === undefined ? {} : { assignment }),
        ...(venues === undefined ? {} : { venues }),
        ...(settings === undefined ? {} : { settings }),
      },
    })

    // WRITE-THROUGH DIED HERE (owner ruling 2026-08-07, #2): editing a plan's
    // calendar or world never touches the season's own sessions any more, the
    // active plan included. The season is always "the last plan generated
    // from", never "whatever plan was touched most recently" — it takes on a
    // plan's calendar and world only through the generate button, a separate
    // endpoint this route no longer calls.

    return NextResponse.json({ plan: updated })
  } catch (error) {
    console.error("Season plan update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE — throw a plan away (owner ruling 2026-08-05, #2: delete lives in the
 *  picker). Two refusals, each with the reason on it: never the active one, or
 *  the season would keep running a calendar with nothing left to name it, and
 *  never the imported reference, which is the only record of what the league
 *  actually published. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string; planId: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    if (isSeasonLocked(gate.seasonStatus)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: gate.seasonStatus },
        { status: 409 }
      )
    }

    const plan = await findOwnedPlan(params.id, params.planId)
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (plan.isActive) {
      return NextResponse.json({ error: ACTIVE_PLAN_DELETE_MESSAGE }, { status: 409 })
    }
    if (plan.source === "imported") {
      return NextResponse.json({ error: IMPORTED_PLAN_DELETE_MESSAGE }, { status: 409 })
    }

    await (prisma as any).seasonPlan.delete({ where: { id: plan.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Season plan delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
