import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { notify } from "@/lib/notifications"

export const dynamic = "force-dynamic"

// Auto-hide threshold: code constant by design (no schema knob to fight over)
const HIDE_AT = 3

const reportSchema = z.object({ reason: z.string().trim().max(300).optional() })

/**
 * POST /api/comments/[id]/report — one report per user per comment; at
 * HIDE_AT distinct reports the comment auto-hides pending review and the
 * post author is belled (social-feed-plan moderation kit).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { reason } = reportSchema.parse(await request.json().catch(() => ({})))

    const comment = await (prisma as any).comment.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, post: { select: { id: true, authorId: true, title: true } } },
    })
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 })

    let hidden = false
    try {
      await (prisma as any).$transaction(async (tx: any) => {
        await tx.commentReport.create({
          data: { commentId: comment.id, reporterId: sessionInfo.userId, reason: reason ?? null },
        })
        const updated = await tx.comment.update({
          where: { id: comment.id },
          data: { reportCount: { increment: 1 } },
          select: { reportCount: true, status: true },
        })
        if (updated.reportCount >= HIDE_AT && updated.status === "VISIBLE") {
          await tx.comment.update({ where: { id: comment.id }, data: { status: "HIDDEN" } })
          hidden = true
        }
      })
    } catch (err: any) {
      if (err?.code === "P2002") {
        return NextResponse.json({ ok: true, already: true }) // one report per user
      }
      throw err
    }

    if (hidden && comment.post.authorId) {
      try {
        await notify(prisma, {
          userId: comment.post.authorId,
          type: "comment_hidden",
          title: "Comment hidden",
          message: `A reported comment on "${comment.post.title}" was hidden automatically.`,
          link: "/feed",
          referenceId: comment.post.id,
          referenceType: "Post",
        })
      } catch (bellErr) {
        console.error("Comment-hidden bell failed:", bellErr)
      }
    }

    return NextResponse.json({ ok: true, hidden })
  } catch (error) {
    console.error("Comment report error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
