import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { canActForPlayer } from "@/lib/authz/player-scope"
import { notify } from "@/lib/notifications"

export const dynamic = "force-dynamic"

const actionSchema = z.object({ action: z.enum(["approve", "decline"]) })

/**
 * PATCH /api/follows/[id] — approve or decline a PENDING player-follow
 * request. Only whoever can act for the player (parent, or the 13+ player
 * themself) may decide. Decline deletes the row so the requester can ask
 * again later; approve flips it ACTIVE and bells the follower.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { action } = actionSchema.parse(await request.json())

    const follow = await (prisma as any).follow.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        userId: true,
        playerId: true,
        status: true,
        player: { select: { firstName: true, lastName: true } },
      },
    })
    if (!follow?.playerId || follow.status !== "PENDING") {
      return NextResponse.json({ error: "No pending request" }, { status: 404 })
    }
    if (!(await canActForPlayer(sessionInfo.userId, follow.playerId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (action === "approve") {
      await (prisma as any).follow.update({
        where: { id: follow.id },
        data: { status: "ACTIVE" },
      })
      try {
        await notify(prisma, {
          userId: follow.userId,
          type: "follow_approved",
          title: "Follow request approved",
          message: `You now follow ${follow.player?.firstName ?? "the player"} ${follow.player?.lastName ?? ""}`.trim(),
          link: `/player/${follow.playerId}`,
          referenceId: follow.playerId,
          referenceType: "Player",
        })
      } catch (bellErr) {
        console.error("Follow-approved bell failed:", bellErr)
      }
      return NextResponse.json({ status: "ACTIVE" })
    }

    await (prisma as any).follow.delete({ where: { id: follow.id } })
    return NextResponse.json({ status: "DECLINED" })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 })
    }
    console.error("Follow decision error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
