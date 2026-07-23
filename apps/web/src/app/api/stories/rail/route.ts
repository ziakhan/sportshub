import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { publicPlayerName } from "@/lib/privacy/names"
import { appBaseUrl } from "@/lib/email"

export const dynamic = "force-dynamic"

/**
 * GET /api/stories/rail — the viewer's stories rail (social-feed-plan P4):
 * unexpired stories from players they follow (ACTIVE only) plus their own
 * kids, grouped per player, oldest-first within a player. Names are full for
 * your own kids and consent-gated for everyone else (the card itself gates
 * again at render).
 */
export async function GET() {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [follows, ownKids] = await Promise.all([
      (prisma as any).follow.findMany({
        where: { userId: sessionInfo.userId, playerId: { not: null }, status: "ACTIVE" },
        select: { playerId: true },
      }),
      (prisma as any).player.findMany({
        where: { parentId: sessionInfo.userId, deletedAt: null },
        select: { id: true },
      }),
    ])
    const ownIds = new Set<string>(ownKids.map((k: any) => k.id))
    const playerIds = Array.from(
      new Set([...follows.map((f: any) => f.playerId), ...ownIds])
    ).filter(Boolean) as string[]
    if (playerIds.length === 0) return NextResponse.json({ rail: [] })

    const stories = await (prisma as any).story.findMany({
      where: { playerId: { in: playerIds }, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        playerId: true,
        gameId: true,
        cardType: true,
        visibility: true,
        templateId: true,
        createdAt: true,
        player: { select: { firstName: true, lastName: true, mediaConsent: true, handle: true } },
        views: { where: { userId: sessionInfo.userId }, select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    const byPlayer = new Map<string, any>()
    for (const s of stories) {
      // FOLLOWERS stories reach followers + family; PUBLIC also fine here
      // (rail is already scoped to followed/own players).
      const entry = byPlayer.get(s.playerId) ?? {
        playerId: s.playerId,
        // Instagram-style: the handle IS the label; names only as fallback
        name:
          s.player.handle ??
          (ownIds.has(s.playerId) ? s.player.firstName : publicPlayerName(s.player)),
        own: ownIds.has(s.playerId),
        stories: [],
        allViewed: true,
      }
      const viewed = s.views.length > 0
      entry.stories.push({
        id: s.id,
        cardUrl: `${appBaseUrl()}${
          s.cardType === "POTG"
            ? `/api/live/${s.gameId}/card?src=story:${s.id}&aspect=portrait&v=3`
            : `/api/live/${s.gameId}/card/${s.playerId}?src=story:${s.id}&aspect=portrait&v=3`
        }`,
        cardType: s.cardType,
        createdAt: s.createdAt,
        viewed,
      })
      entry.allViewed = entry.allViewed && viewed
      byPlayer.set(s.playerId, entry)
    }

    return NextResponse.json({ rail: Array.from(byPlayer.values()) })
  } catch (error) {
    console.error("Stories rail error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
