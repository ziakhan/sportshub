import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { loadSchedulerInput } from "@/lib/scheduler/load"
import { computeSessionCapacity } from "@/lib/scheduler/capacity"

export const dynamic = "force-dynamic"

/**
 * GET /api/seasons/[id]/schedule/capacity
 * Session-level supply/demand report BEFORE any schedule is generated:
 * slots each session offers vs games each division/group needs, so the
 * owner can decide what to squeeze into which session. Pure math, no writes.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
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

    const { input, errors } = await loadSchedulerInput(params.id)
    if (!input) return NextResponse.json({ error: "Season not found", errors }, { status: 404 })

    // Unlike preview/commit, report capacity even with setup gaps (e.g. no
    // gamesGuaranteed yet) — the errors ride along for the UI to surface.
    return NextResponse.json({ sessions: computeSessionCapacity(input), errors })
  } catch (error) {
    console.error("Schedule capacity error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
