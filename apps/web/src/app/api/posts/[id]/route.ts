import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { canManageRecapPost } from "@/lib/content/recap-authz"

export const dynamic = "force-dynamic"

/**
 * Moderation controls for posts (recaps first — plan §6.1 promised league
 * owners edit/takedown; this is that promise, kept).
 *
 * PATCH /api/posts/[id]
 *   { title?, body? }            — edit a PUBLISHED post in place
 *   { action: "takedown" }       — status → TAKEN_DOWN (drops out of every
 *                                  public query; they all filter PUBLISHED)
 *   { action: "restore" }        — status → PUBLISHED
 *   Authz: PlatformAdmin, the league owner of the recap's game, or a
 *   ClubOwner/ClubManager of either participating team's tenant.
 *
 * DELETE /api/posts/[id] — PlatformAdmin only. Hard delete; PostTag and
 * MediaAsset rows cascade (schema onDelete: Cascade).
 */

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).optional(),
    action: z.enum(["takedown", "restore"]).optional(),
  })
  .refine((d) => d.action !== undefined || d.title !== undefined || d.body !== undefined, {
    message: "Nothing to update",
  })
  .refine((d) => !(d.action !== undefined && (d.title !== undefined || d.body !== undefined)), {
    message: "Send either an action or field edits, not both",
  })

const postSelect = {
  id: true,
  kind: true,
  title: true,
  slug: true,
  body: true,
  status: true,
  publishedAt: true,
  aiModel: true,
  updatedAt: true,
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const post = await (prisma as any).post.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, authorId: true },
    })
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Authors manage their OWN posts (owner 2026-07-23, Instagram-style:
    // edit caption, delete) — parents' shared cards, org admins' posts.
    // Recap-moderation rights stay for everything else.
    const isAuthor = !!post.authorId && post.authorId === sessionInfo.userId
    if (!isAuthor) {
      const manage = await canManageRecapPost(params.id, sessionInfo)
      if (!manage.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const data = patchSchema.parse(await request.json())
    if (isAuthor && data.action) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (data.action === "takedown") {
      const updated = await (prisma as any).post.update({
        where: { id: params.id },
        data: { status: "TAKEN_DOWN" },
        select: postSelect,
      })
      return NextResponse.json({ post: updated })
    }

    if (data.action === "restore") {
      const updated = await (prisma as any).post.update({
        where: { id: params.id },
        data: { status: "PUBLISHED" },
        select: postSelect,
      })
      return NextResponse.json({ post: updated })
    }

    // Field edits are for live copy only — restore a taken-down post first.
    if (post.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Only published posts can be edited — restore it first" },
        { status: 409 }
      )
    }

    const update: Record<string, string> = {}
    if (data.title !== undefined) update.title = data.title
    if (data.body !== undefined) update.body = data.body

    const updated = await (prisma as any).post.update({
      where: { id: params.id },
      data: update,
      select: postSelect,
    })
    return NextResponse.json({ post: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Post PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const post = await (prisma as any).post.findUnique({
      where: { id: params.id },
      select: { id: true, authorId: true },
    })
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })
    // Authors delete their own posts (Instagram-style); platform admin anything
    if (!sessionInfo.isPlatformAdmin && post.authorId !== sessionInfo.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await (prisma as any).post.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Post DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
