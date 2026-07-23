import { NextResponse } from "next/server"
import { getPublicFeed } from "@/lib/queries/content"
import { prisma } from "@youthbasketballhub/db"
import { appBaseUrl } from "@/lib/email"

export const dynamic = "force-dynamic"

/** GET /api/mobile/browse/news — the public news feed (posts + public announcements). Anonymous. */
export async function GET() {
  try {
    const items = await getPublicFeed(30)
    // PNG covers toward the app (SVG data-URIs don't render in RN Image
    // bundles in the field) — same mapping as browse/home, so the news tab
    // and the social feed show the IDENTICAL image for the same game.
    const ids = items.map((n: any) => n.id)
    const tags = ids.length
      ? await prisma.postTag.findMany({
          where: { postId: { in: ids }, gameId: { not: null } },
          select: { postId: true, gameId: true },
        })
      : []
    const gameByPost = new Map(tags.map((t: any) => [t.postId, t.gameId]))
    return NextResponse.json({
      items: items.map((n: any) => ({
        ...n,
        coverUrl: n.coverUrl?.startsWith("data:image/svg")
          ? gameByPost.has(n.id)
            ? `${appBaseUrl()}/api/live/${gameByPost.get(n.id)}/cover?v=5`
            : null
          : (n.coverUrl ?? null),
      })),
    })
  } catch (error) {
    console.error("Mobile news error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
