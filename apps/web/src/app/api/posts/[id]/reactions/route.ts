import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { canSeePost } from "@/lib/social/post-access"

export const dynamic = "force-dynamic"

// Same fixed set as team chat — zero-moderation engagement
const EMOJIS = ["👍", "❤️", "😂", "🎉", "🔥", "🏀"] as const
const bodySchema = z.object({ emoji: z.enum(EMOJIS) })

/** POST /api/posts/[id]/reactions — toggle one emoji (social-feed-plan P5) */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { emoji } = bodySchema.parse(await request.json())
    if (!(await canSeePost(sessionInfo.userId, params.id))) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    const existing = await (prisma as any).postReaction.findUnique({
      where: { postId_userId_emoji: { postId: params.id, userId: sessionInfo.userId, emoji } },
      select: { id: true },
    })
    if (existing) {
      await (prisma as any).postReaction.delete({ where: { id: existing.id } })
    } else {
      try {
        await (prisma as any).postReaction.create({
          data: { postId: params.id, userId: sessionInfo.userId, emoji },
        })
      } catch (err: any) {
        if (err?.code !== "P2002") throw err
      }
    }

    const grouped = await (prisma as any).postReaction.groupBy({
      by: ["emoji"],
      where: { postId: params.id },
      _count: true,
    })
    const mine = await (prisma as any).postReaction.findMany({
      where: { postId: params.id, userId: sessionInfo.userId },
      select: { emoji: true },
    })
    return NextResponse.json({
      reactions: grouped.map((g: any) => ({ emoji: g.emoji, count: g._count })),
      mine: mine.map((m: any) => m.emoji),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Unknown emoji" }, { status: 400 })
    }
    console.error("Post reaction error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
