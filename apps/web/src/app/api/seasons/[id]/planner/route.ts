import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { buildPlannerState } from "@/lib/scheduler/planner"
import { currentAssignment, suggestFor } from "@/lib/scheduler/planner-core"
import { seasonPlannerAuth } from "@/lib/scheduler/planner-auth"
import { isSeasonLocked, SEASON_LOCKED_MESSAGE } from "@/lib/seasons/season-lock"
import { lastSeasonTeamCounts } from "@/lib/seasons/last-season"

export const dynamic = "force-dynamic"

/** GET /api/seasons/[id]/planner — the board's whole state. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })

    const [state, lastSeasonTeams] = await Promise.all([
      buildPlannerState(params.id),
      // Step 1's "13 last season" hint. Additive on this response rather
      // than its own route: the step needs units, the lock and the hints
      // together, and the PATCH below already answers with `state`.
      lastSeasonTeamCounts(params.id),
    ])
    const assignment = currentAssignment(state)
    return NextResponse.json({
      state,
      suggestions: suggestFor(state, assignment),
      seasonStatus: gate.seasonStatus,
      seasonLabel: gate.seasonLabel,
      leagueName: gate.leagueName,
      // Step 4 asks one question of this response: is the calendar public
      // yet? Additive, same reasoning as the fields above.
      planPublishedAt: gate.planPublishedAt,
      lastSeasonTeams,
    })
  } catch (error) {
    console.error("Planner state error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const patchSchema = z.object({
  expected: z
    .array(z.object({ divisionId: z.string(), expectedTeams: z.number().int().min(0).max(500) }))
    .min(1),
})

/** PATCH /api/seasons/[id]/planner — save expected team counts (the
 *  pre-registration estimate planning runs off). */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const gate = await seasonPlannerAuth(params.id)
    if (gate.status !== 200) return NextResponse.json({ error: gate.error }, { status: gate.status })
    // Step 1 goes read-only when the season locks; the API must agree
    // (wave 3 review, 2026-08-02 — the client was the only guard).
    if (isSeasonLocked(gate.seasonStatus)) {
      return NextResponse.json(
        { error: SEASON_LOCKED_MESSAGE, status: gate.seasonStatus },
        { status: 409 }
      )
    }

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "expected[] required" }, { status: 400 })

    const owned = await (prisma as any).division.findMany({
      where: { seasonId: params.id, id: { in: parsed.data.expected.map((e) => e.divisionId) } },
      select: { id: true },
    })
    const ownedIds = new Set(owned.map((d: any) => d.id))
    let updated = 0
    for (const e of parsed.data.expected) {
      if (!ownedIds.has(e.divisionId)) continue
      await (prisma as any).division.update({
        where: { id: e.divisionId },
        data: { expectedTeams: e.expectedTeams },
      })
      updated++
    }
    const state = await buildPlannerState(params.id)
    return NextResponse.json({ success: true, updated, state })
  } catch (error) {
    console.error("Planner expected-teams error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
