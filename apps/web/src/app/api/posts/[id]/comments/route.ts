import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { canSeePost } from "@/lib/social/post-access"
import { notify } from "@/lib/notifications"

export const dynamic = "force-dynamic"

const createSchema = z.object({ body: z.string().trim().min(1).max(1000) })

// Rate limit: 5 comments/min per user (in-memory; per-instance is fine for
// the single-box deploy — revisit if we ever scale out)
const recent = new Map<string, number[]>()
function allow(userId: string): boolean {
  const now = Date.now()
  const stamps = (recent.get(userId) ?? []).filter((t) => now - t < 60_000)
  if (stamps.length >= 5) return false
  stamps.push(now)
  recent.set(userId, stamps)
  return true
}

/** GET /api/posts/[id]/comments — visible comments, oldest first */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const sessionInfo = await getSessionUserId()
  if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await canSeePost(sessionInfo.userId, params.id))) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 })
  }

  const comments = await (prisma as any).comment.findMany({
    where: { postId: params.id, status: "VISIBLE" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      authorId: true,
      author: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  })
  return NextResponse.json({
    comments: comments.map((c: any) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      mine: c.authorId === sessionInfo.userId,
      authorName: `${c.author?.firstName ?? ""} ${c.author?.lastName ?? ""}`.trim() || "User",
    })),
  })
}

/** POST /api/posts/[id]/comments — add a comment (text day one, owner-ruled;
 *  the moderation kit rides along: report → auto-hide → removal). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!allow(sessionInfo.userId)) {
      return NextResponse.json(
        { error: "You're commenting too fast — give it a minute", code: "RATE_LIMITED" },
        { status: 429 }
      )
    }
    const { body } = createSchema.parse(await request.json())
    if (!(await canSeePost(sessionInfo.userId, params.id))) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    const comment = await (prisma as any).comment.create({
      data: { postId: params.id, authorId: sessionInfo.userId, body },
      select: {
        id: true,
        body: true,
        createdAt: true,
        post: { select: { authorId: true, title: true } },
        author: { select: { firstName: true, lastName: true } },
      },
    })

    // Bell the post author (not yourself)
    if (comment.post.authorId && comment.post.authorId !== sessionInfo.userId) {
      try {
        const who =
          `${comment.author?.firstName ?? ""} ${comment.author?.lastName ?? ""}`.trim() || "Someone"
        await notify(prisma, {
          userId: comment.post.authorId,
          type: "post_comment",
          title: "New comment",
          message: `${who} commented on "${comment.post.title}"`,
          link: `/feed`,
          referenceId: params.id,
          referenceType: "Post",
        })
      } catch (bellErr) {
        console.error("Comment bell failed:", bellErr)
      }
    }

    return NextResponse.json({
      comment: {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        mine: true,
        authorName:
          `${comment.author?.firstName ?? ""} ${comment.author?.lastName ?? ""}`.trim() || "You",
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Comment must be 1-1000 characters" }, { status: 400 })
    }
    console.error("Comment create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
