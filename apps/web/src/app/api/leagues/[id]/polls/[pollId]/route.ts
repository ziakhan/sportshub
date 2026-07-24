import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { canManageLeaguePolls } from "@/lib/polls/authz"

export const dynamic = "force-dynamic"

const patchSchema = z.object({ action: z.enum(["close", "reopen"]) })

async function authorizeStaff(leagueId: string, pollId: string, userId: string, isPlatformAdmin: boolean) {
  if (!(await canManageLeaguePolls(userId, leagueId, isPlatformAdmin))) {
    return { error: "Forbidden", status: 403 as const }
  }
  const poll = await (prisma as any).poll.findFirst({
    where: { id: pollId, leagueId },
    select: { id: true },
  })
  if (!poll) return { error: "Poll not found", status: 404 as const }
  return { poll }
}

/** PATCH /api/leagues/[id]/polls/[pollId] — staff close/reopen voting */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; pollId: string } }
) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const result = await authorizeStaff(params.id, params.pollId, auth.userId, auth.isPlatformAdmin)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid action" },
        { status: 400 }
      )
    }

    const closing = parsed.data.action === "close"
    await (prisma as any).poll.update({
      where: { id: params.pollId },
      data: { status: closing ? "CLOSED" : "OPEN", closedAt: closing ? new Date() : null },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("League poll update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE /api/leagues/[id]/polls/[pollId] — staff; cascades questions/votes */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; pollId: string } }
) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const result = await authorizeStaff(params.id, params.pollId, auth.userId, auth.isPlatformAdmin)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    await (prisma as any).poll.delete({ where: { id: params.pollId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("League poll delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
