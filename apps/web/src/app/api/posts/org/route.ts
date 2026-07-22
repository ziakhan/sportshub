import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { isClubAdmin } from "@/lib/authz/team-scope"

export const dynamic = "force-dynamic"

/**
 * POST /api/posts/org — org posting (social-feed-plan P5): clubs and leagues
 * author picture/video/article posts. Identified adult authors only; tags
 * auto-place on the org's own pages (cross-tag collab approval arrives with
 * the media role). Photos ride the house capped-data-URL pattern; video is
 * embed links (upload-lite).
 */
const orgPostSchema = z
  .object({
    tenantId: z.string().optional(),
    leagueId: z.string().optional(),
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().max(4000).optional(),
    photos: z
      .array(
        z
          .string()
          .regex(/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/)
          .max(2_000_000)
      )
      .max(4)
      .optional(),
    videoUrl: z.string().url().max(500).optional(),
  })
  .refine((d) => [d.tenantId, d.leagueId].filter(Boolean).length === 1, {
    message: "Provide exactly one of tenantId, leagueId",
  })

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60)
}

export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const input = orgPostSchema.parse(await request.json())

    if (input.tenantId) {
      if (!(await isClubAdmin(sessionInfo.userId, input.tenantId)) && !sessionInfo.isPlatformAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else if (input.leagueId) {
      const league = await (prisma as any).league.findUnique({
        where: { id: input.leagueId },
        select: { ownerId: true },
      })
      if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 })
      if (league.ownerId !== sessionInfo.userId && !sessionInfo.isPlatformAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const kind = input.videoUrl ? "VIDEO" : input.photos?.length ? "PHOTO_SET" : "ARTICLE"
    const slug = `${slugify(input.title)}-${Math.random().toString(36).slice(2, 8)}`

    const post = await (prisma as any).post.create({
      data: {
        kind,
        title: input.title,
        slug,
        body: input.body ?? "",
        status: "PUBLISHED",
        publishedAt: new Date(),
        authorId: sessionInfo.userId,
        visibility: "PUBLIC",
        tags: {
          create: [
            input.tenantId ? { tenantId: input.tenantId } : { leagueId: input.leagueId },
          ],
        },
        media: {
          create: [
            ...(input.photos ?? []).map((url, i) => ({ type: "IMAGE", url, sortOrder: i })),
            ...(input.videoUrl ? [{ type: "VIDEO_EMBED", url: input.videoUrl, sortOrder: 99 }] : []),
          ],
        },
      },
      select: { id: true, slug: true },
    })

    return NextResponse.json({ post })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 })
    }
    console.error("Org post error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
