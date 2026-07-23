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
    select: { parentId: true, userId: true },
  })
  // Guardian (parentId) OR the player's own login (userId — family-accounts
  // plan 2026-07-23: a parent-added 13+ kid with a claimed account).
  return !!player && (player.parentId === userId || player.userId === userId)
}

/** The user ids who act for this player (guardian + own account). */
export async function guardianUserIds(playerId: string): Promise<string[]> {
  const player = await (prisma as any).player.findUnique({
    where: { id: playerId },
    select: { parentId: true, userId: true },
  })
  if (!player) return []
  return [...new Set([player.parentId, player.userId].filter(Boolean))] as string[]
}
