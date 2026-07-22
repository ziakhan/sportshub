import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { canActForPlayer } from "@/lib/authz/player-scope"

export const dynamic = "force-dynamic"

/**
 * GET /api/players/[id]/social — the family view of a player's social layer
 * (social-feed-plan P3/P4): visibility setting, follower count, pending
 * follow requests, and the "My moments" story archive with view counts.
 * Guardian-only (canActForPlayer).
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const sessionInfo = await getSessionUserId()
  if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await canActForPlayer(sessionInfo.userId, params.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [player, followerCount, pending, stories] = await Promise.all([
    (prisma as any).player.findUnique({
      where: { id: params.id },
      select: { socialVisibility: true },
    }),
    (prisma as any).follow.count({ where: { playerId: params.id, status: "ACTIVE" } }),
    (prisma as any).follow.findMany({
      where: { playerId: params.id, status: "PENDING" },
      select: {
        id: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    (prisma as any).story.findMany({
      where: { playerId: params.id },
      select: {
        id: true,
        gameId: true,
        cardType: true,
        visibility: true,
        createdAt: true,
        expiresAt: true,
        _count: { select: { views: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ])
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 })

  return NextResponse.json({
    socialVisibility: player.socialVisibility,
    followerCount,
    pendingRequests: pending.map((p: any) => ({
      id: p.id,
      name:
        `${p.user?.firstName ?? ""} ${p.user?.lastName ?? ""}`.trim() || p.user?.email || "User",
      createdAt: p.createdAt,
    })),
    moments: stories.map((s: any) => ({
      id: s.id,
      gameId: s.gameId,
      cardType: s.cardType,
      visibility: s.visibility,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      active: new Date(s.expiresAt).getTime() > Date.now(),
      views: s._count.views,
    })),
  })
}
