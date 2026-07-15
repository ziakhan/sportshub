import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembership } from "@/lib/teams/chat-access"

export const dynamic = "force-dynamic"

const schema = z.object({ emoji: z.string().min(1).max(16) })
const ALLOWED = new Set(["👍", "❤️", "😂", "🎉", "🔥", "🏀"])

/**
 * POST /api/teams/[id]/messages/[messageId]/reactions { emoji } — toggle
 * the caller's reaction (2026-07-15). Fixed emoji set keeps it wholesome.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; messageId: string } }
) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const membership = await getChatMembership(params.id, auth.userId, auth.isPlatformAdmin)
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success || !ALLOWED.has(parsed.data.emoji)) {
      return NextResponse.json({ error: "Pick one of the reaction emoji" }, { status: 400 })
    }

    const message = await prisma.teamMessage.findFirst({
      where: { id: params.messageId, teamId: params.id, deletedAt: null },
      select: { id: true },
    })
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 })

    const existing = await (prisma as any).messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: message.id,
          userId: auth.userId,
          emoji: parsed.data.emoji,
        },
      },
      select: { id: true },
    })
    if (existing) {
      await (prisma as any).messageReaction.delete({ where: { id: existing.id } })
    } else {
      await (prisma as any).messageReaction.create({
        data: { messageId: message.id, userId: auth.userId, emoji: parsed.data.emoji },
      })
    }

    const rows = await (prisma as any).messageReaction.groupBy({
      by: ["emoji"],
      where: { messageId: message.id },
      _count: true,
    })
    const mine = await (prisma as any).messageReaction.findMany({
      where: { messageId: message.id, userId: auth.userId },
      select: { emoji: true },
    })
    const mineSet = new Set(mine.map((m: any) => m.emoji))
    return NextResponse.json({
      reactions: rows.map((r: any) => ({
        emoji: r.emoji,
        count: r._count,
        mine: mineSet.has(r.emoji),
      })),
    })
  } catch (error) {
    console.error("Reaction toggle error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
