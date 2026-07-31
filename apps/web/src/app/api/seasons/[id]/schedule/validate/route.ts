import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { findPlacementConflicts } from "@/lib/games/conflicts"

export const dynamic = "force-dynamic"

const validateSchema = z.object({
  /** When moving an existing game, exclude it from its own conflict check. */
  gameId: z.string().optional(),
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  courtId: z.string().nullable().optional(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(10).max(240).default(90),
})

/**
 * POST /api/seasons/[id]/schedule/validate — dry-run a placement
 * (Schedule Studio P0): "could this matchup sit in this slot?" → ok or the
 * exact conflicts. Powers client-side hatching on the future board and the
 * manual-add form; writes nothing.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const season = await (prisma as any).season.findUnique({
      where: { id: params.id },
      select: { league: { select: { ownerId: true } } },
    })
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (season.league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const data = validateSchema.parse(await request.json())
    if (data.homeTeamId === data.awayTeamId) {
      return NextResponse.json({ ok: false, conflicts: ["Home and away team must differ"] })
    }
    const conflicts = await findPlacementConflicts({
      excludeGameIds: data.gameId ? [data.gameId] : undefined,
      homeTeamId: data.homeTeamId,
      awayTeamId: data.awayTeamId,
      courtId: data.courtId ?? null,
      start: new Date(data.scheduledAt),
      durationMinutes: data.durationMinutes,
    })
    return NextResponse.json({ ok: conflicts.length === 0, conflicts })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Schedule validate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
