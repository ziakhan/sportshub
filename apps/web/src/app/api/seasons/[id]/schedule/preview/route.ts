import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { generateSchedule } from "@/lib/scheduler/generate"
import { loadSchedulerInput } from "@/lib/scheduler/load"

export const dynamic = "force-dynamic"

const previewSchema = z.object({
  // sessionId → unit keys that session hosts (capacity planning); a session
  // absent from the map hosts any unit.
  sessionUnits: z.record(z.array(z.string())).optional(),
})

/**
 * POST /api/seasons/[id]/schedule/preview
 * Runs the scheduler and returns the proposed game list + warnings.
 * Does NOT write anything.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const owner = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { league: { select: { ownerId: true } } },
    })
    if (!owner) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (owner.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const { sessionUnits } = previewSchema.parse(body ?? {})

    const { input, errors } = await loadSchedulerInput(params.id)
    if (!input || errors.length > 0) {
      return NextResponse.json({ error: "Cannot preview", errors }, { status: 422 })
    }
    if (sessionUnits) input.sessionUnitFilter = sessionUnits

    const result = generateSchedule(input)

    // Enrich output with team names so UI can render without extra lookups
    const teamNameById = new Map<string, string>()
    for (const d of input.divisions) for (const t of d.teams) teamNameById.set(t.teamId, t.name)

    return NextResponse.json({
      games: result.games.map((g) => ({
        ...g,
        homeTeamName: teamNameById.get(g.homeTeamId) ?? g.homeTeamId,
        awayTeamName: teamNameById.get(g.awayTeamId) ?? g.awayTeamId,
      })),
      unscheduled: result.unscheduled.map((u) => ({
        ...u,
        homeTeamName: teamNameById.get(u.homeTeamId) ?? u.homeTeamId,
        awayTeamName: teamNameById.get(u.awayTeamId) ?? u.awayTeamId,
      })),
      warnings: result.warnings,
      utilization: result.utilization,
    })
  } catch (error) {
    console.error("Schedule preview error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
