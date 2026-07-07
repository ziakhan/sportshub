import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembership } from "@/lib/teams/chat-access"

export const dynamic = "force-dynamic"

/**
 * Remove a message: senders take back their own; staff/admin moderate any.
 * Soft delete — the row stays for accountability in a kids' sports chat.
 * DELETE /api/teams/[id]/messages/[messageId]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; messageId: string } }
) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const message = await prisma.teamMessage.findFirst({
      where: { id: params.messageId, teamId: params.id, deletedAt: null },
      select: { id: true, senderId: true, pollId: true },
    })
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 })

    const canModerate = membership.role === "staff" || membership.role === "admin"
    if (message.senderId !== auth.userId && !canModerate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.teamMessage.update({
      where: { id: message.id },
      data: { deletedAt: new Date(), deletedById: auth.userId },
    })

    // A taken-back/moderated poll message takes its poll (and votes) with it
    if (message.pollId) {
      await (prisma as any).poll.delete({ where: { id: message.pollId } }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Team chat delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
