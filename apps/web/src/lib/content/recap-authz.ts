import { prisma } from "@youthbasketballhub/db"

/**
 * Who may manage (edit / regenerate / take down) a RECAP_AI post — shared by
 * the /api/posts/[id] routes and the news detail page's admin bar so the
 * server-rendered UI and the API can never disagree.
 *
 * A recap is managed by:
 *  - a PlatformAdmin,
 *  - the owner of the league the game was played in (post's gameId tag →
 *    game.season.league.ownerId), or
 *  - a ClubOwner/ClubManager of either participating team's tenant.
 *
 * Posts without a gameId tag (non-recap editorial) are PlatformAdmin-only.
 */

export interface RecapManageContext {
  allowed: boolean
  /** The tagged game, resolved once so regenerate can reuse it. */
  gameId: string | null
}

export async function canManageRecapPost(
  postId: string,
  viewer: { userId: string; isPlatformAdmin: boolean }
): Promise<RecapManageContext> {
  const gameTag = await (prisma as any).postTag.findFirst({
    where: { postId, gameId: { not: null } },
    select: { gameId: true },
  })
  const gameId: string | null = gameTag?.gameId ?? null

  if (viewer.isPlatformAdmin) return { allowed: true, gameId }
  if (!gameId) return { allowed: false, gameId: null }

  const game = await (prisma as any).game.findUnique({
    where: { id: gameId },
    select: {
      homeTeam: { select: { tenantId: true } },
      awayTeam: { select: { tenantId: true } },
      season: { select: { league: { select: { ownerId: true } } } },
    },
  })
  if (!game) return { allowed: false, gameId }

  if (game.season?.league?.ownerId === viewer.userId) return { allowed: true, gameId }

  const tenantIds = [game.homeTeam?.tenantId, game.awayTeam?.tenantId].filter(
    (id): id is string => !!id
  )
  if (tenantIds.length > 0) {
    const clubRole = await prisma.userRole.findFirst({
      where: {
        userId: viewer.userId,
        role: { in: ["ClubOwner", "ClubManager"] },
        tenantId: { in: tenantIds },
      },
      select: { id: true },
    })
    if (clubRole) return { allowed: true, gameId }
  }

  return { allowed: false, gameId }
}
