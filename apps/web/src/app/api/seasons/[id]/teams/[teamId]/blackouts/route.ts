import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { addDirectBlackout } from "@/lib/schedule-requests/blackouts"

export const dynamic = "force-dynamic"

const hhmm = z.string().regex(/^\d{2}:\d{2}$/)
const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: hhmm.optional(),
  endTime: hhmm.optional(),
  reason: z.string().trim().max(300).optional(),
})

async function leagueSideOr403(seasonId: string, submissionId: string) {
  const auth = await getSessionUserId()
  if (!auth) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const submission = await (prisma as any).teamSubmission.findFirst({
    where: { id: submissionId, seasonId },
    select: {
      id: true,
      season: { select: { leagueId: true, league: { select: { ownerId: true } } } },
    },
  })
  if (!submission) return { res: NextResponse.json({ error: "Not found" }, { status: 404 }) }
  const isOwner = submission.season.league.ownerId === auth.userId
  const managerRole = isOwner
    ? null
    : await prisma.userRole.findFirst({
        where: {
          userId: auth.userId,
          leagueId: submission.season.leagueId,
          role: { in: ["LeagueOwner", "LeagueManager"] },
        },
        select: { id: true },
      })
  if (!isOwner && !auth.isPlatformAdmin && !managerRole) {
    return { res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { submission }
}

/**
 * POST /api/seasons/[id]/teams/[teamId]/blackouts — league-direct no-play
 * date for a team (owner 2026-08-01), no request/approval involved.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; teamId: string } }
) {
  try {
    const gate = await leagueSideOr403(params.id, params.teamId)
    if ("res" in gate) return gate.res
    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid blackout" }, { status: 400 })
    }
    const result = await addDirectBlackout({ submissionId: params.teamId, ...parsed.data })
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    }
    return NextResponse.json({ success: true, blackoutId: result.blackoutId }, { status: 201 })
  } catch (error) {
    console.error("Add blackout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
