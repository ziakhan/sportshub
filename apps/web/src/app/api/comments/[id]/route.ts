import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * DELETE /api/comments/[id] — soft removal, never destruction (audit trail):
 * the commenter removes their own (REMOVED_AUTHOR); the post's author or a
 * platform admin removes anything on their post (REMOVED_ORG).
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const comment = await (prisma as any).comment.findUnique({
      where: { id: params.id },
      select: { id: true, authorId: true, post: { select: { authorId: true } } },
    })
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 })

    const isCommentAuthor = comment.authorId === sessionInfo.userId
    const isPostOwner =
      comment.post.authorId === sessionInfo.userId || !!sessionInfo.isPlatformAdmin
    if (!isCommentAuthor && !isPostOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await (prisma as any).comment.update({
      where: { id: comment.id },
      data: { status: isCommentAuthor ? "REMOVED_AUTHOR" : "REMOVED_ORG" },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Comment delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
