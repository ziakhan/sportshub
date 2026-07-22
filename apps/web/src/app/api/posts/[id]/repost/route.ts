import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/posts/[id]/repost — repost a PUBLIC published post (guarded at
 * create AND at render, so a later takedown/visibility change silently pulls
 * every repost). DELETE undoes. One repost per user per post.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const post = await (prisma as any).post.findUnique({
      where: { id: params.id },
      select: { status: true, visibility: true },
    })
    if (!post || post.status !== "PUBLISHED" || post.visibility !== "PUBLIC") {
      return NextResponse.json(
        { error: "Only public posts can be reposted", code: "NOT_REPOSTABLE" },
        { status: post ? 400 : 404 }
      )
    }

    try {
      await (prisma as any).repost.create({
        data: { postId: params.id, userId: sessionInfo.userId },
      })
    } catch (err: any) {
      if (err?.code !== "P2002") throw err // already reposted — idempotent
    }
    return NextResponse.json({ reposted: true })
  } catch (error) {
    console.error("Repost error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await (prisma as any).repost.deleteMany({
      where: { postId: params.id, userId: sessionInfo.userId },
    })
    return NextResponse.json({ reposted: false })
  } catch (error) {
    console.error("Un-repost error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
