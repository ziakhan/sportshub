import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { canManageRecapPost } from "@/lib/content/recap-authz"
import { upsertGameRecap } from "@/lib/content/recap-service"

export const dynamic = "force-dynamic"

/**
 * POST /api/posts/[id]/regenerate — re-run the AI recap for the post's game
 * (the exact same upsertGameRecap the finalize flow calls; it locates the
 * post via the gameId tag and rewrites title/body/aiModel in place, keeping
 * the slug, tags, media, and current status).
 *
 * ⚠️ DESTRUCTIVE TO EDITS: regeneration OVERWRITES any manual title/body
 * edits with fresh AI copy. UIs must confirm before calling this — the
 * response echoes `warning` for exactly that reason.
 *
 * Authz: same circle as PATCH — PlatformAdmin, the game's league owner, or
 * a ClubOwner/ClubManager of either participating team's tenant.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const post = await (prisma as any).post.findUnique({
      where: { id: params.id },
      select: { id: true, kind: true },
    })
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const manage = await canManageRecapPost(params.id, sessionInfo)
    if (!manage.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (post.kind !== "RECAP_AI" || !manage.gameId) {
      return NextResponse.json(
        { error: "Only game recaps can be regenerated" },
        { status: 400 }
      )
    }

    // The service refuses unless the game is COMPLETED with a final score —
    // surface that as a conflict rather than silently doing nothing.
    const result = await upsertGameRecap(manage.gameId)
    if (!result) {
      return NextResponse.json(
        { error: "Game has no final score to recap — re-finalize it first" },
        { status: 409 }
      )
    }

    const refreshed = await (prisma as any).post.findUnique({
      where: { id: result.postId },
      select: {
        id: true,
        kind: true,
        title: true,
        slug: true,
        body: true,
        status: true,
        publishedAt: true,
        aiModel: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      post: refreshed,
      warning: "Regeneration overwrote any manual edits with a fresh AI recap.",
    })
  } catch (error) {
    console.error("Post regenerate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
