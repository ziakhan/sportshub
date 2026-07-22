import { prisma } from "@youthbasketballhub/db"

/**
 * True when this user may act FOR this player — approve followers, share
 * their cards, open their moments archive. Today that's the guardian
 * (Player.parentId), which for self-registered 13+ players is the player
 * themself (parentId === their own user id). Single seam so co-guardian
 * households later change ONE function, not every raw parentId comparison
 * (social-feed-plan P3).
 */
export async function canActForPlayer(userId: string, playerId: string): Promise<boolean> {
  const player = await (prisma as any).player.findUnique({
    where: { id: playerId },
    select: { parentId: true },
  })
  return !!player && player.parentId === userId
}

/** The user ids who act for this player (guardian today). */
export async function guardianUserIds(playerId: string): Promise<string[]> {
  const player = await (prisma as any).player.findUnique({
    where: { id: playerId },
    select: { parentId: true },
  })
  return player ? [player.parentId] : []
}
