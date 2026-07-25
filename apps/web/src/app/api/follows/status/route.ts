import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

// Mirrors the targetSchema in ../route.ts (route.ts can only export HTTP
// handlers + route config, so this can't be a shared import).
const targetSchema = z
  .object({
    teamId: z.string().optional(),
    tenantId: z.string().optional(),
    leagueId: z.string().optional(),
    playerId: z.string().optional(),
  })
  .refine((d) => [d.teamId, d.tenantId, d.leagueId, d.playerId].filter(Boolean).length === 1, {
    message: "Provide exactly one of teamId, tenantId, leagueId, playerId",
  })

/**
 * GET /api/follows/status?tenantId=|teamId=|leagueId=|playerId= — the
 * viewer's follow state for ONE target. Additive twin of POST/DELETE
 * /api/follows: those two + the bare GET (viewer's whole follow list) were
 * the only routes; a caller that just needs "am I following this club"
 * (native club/team/season screens, mobile follows.ts) had no cheap way to
 * ask without fetching and filtering the full list. Same auth contract as
 * POST/DELETE (bearer works — getSessionUserId), same "not found" is just
 * status NONE (never an error) since not-following is a valid answer.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const target = targetSchema.parse({
      teamId: searchParams.get("teamId") ?? undefined,
      tenantId: searchParams.get("tenantId") ?? undefined,
      leagueId: searchParams.get("leagueId") ?? undefined,
      playerId: searchParams.get("playerId") ?? undefined,
    })

    const follow = await (prisma as any).follow.findFirst({
      where: { userId: sessionInfo.userId, ...target },
      select: { status: true },
    })

    const status = follow?.status ?? "NONE"
    return NextResponse.json({ following: status === "ACTIVE", status })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 })
    }
    console.error("Follow status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
