import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { canManageClubPolls } from "@/lib/polls/authz"
import { isClubPollAudience } from "@/lib/polls/audience"
import { submitPollVote, voteSchema } from "@/lib/polls/vote"

export const dynamic = "force-dynamic"

/**
 * POST /api/clubs/[id]/polls/[pollId]/vote — any club poll audience member.
 * Same validate-then-replace semantics as the team vote route (shared core
 * in lib/polls/vote.ts).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; pollId: string } }
) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!auth.isPlatformAdmin && !(await isClubPollAudience(auth.userId, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const poll = await (prisma as any).poll.findFirst({
      where: { id: params.pollId, tenantId: params.id },
      select: { id: true },
    })
    if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 })

    const parsed = voteSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid vote" },
        { status: 400 }
      )
    }

    const isStaffView = await canManageClubPolls(auth.userId, params.id, auth.isPlatformAdmin)
    const result = await submitPollVote(params.pollId, auth.userId, parsed.data, isStaffView)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ poll: result.poll })
  } catch (error) {
    console.error("Club poll vote error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
