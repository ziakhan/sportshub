import { prisma } from "@youthbasketballhub/db"

/**
 * Can this user SEE (and therefore react to / comment on / share) this post?
 * PUBLIC published posts: anyone signed-in. FOLLOWERS posts: approved
 * followers of the tagged player, or the player's own family.
 */
export async function canSeePost(userId: string, postId: string): Promise<boolean> {
  const post = await (prisma as any).post.findUnique({
    where: { id: postId },
    select: {
      status: true,
      visibility: true,
      tags: { where: { playerId: { not: null } }, select: { playerId: true, player: { select: { parentId: true } } } },
    },
  })
  if (!post || post.status !== "PUBLISHED") return false
  if (post.visibility === "PUBLIC") return true

  const playerIds = post.tags.map((t: any) => t.playerId).filter(Boolean) as string[]
  if (playerIds.length === 0) return false
  if (post.tags.some((t: any) => t.player?.parentId === userId)) return true

  const follow = await (prisma as any).follow.findFirst({
    where: { userId, playerId: { in: playerIds }, status: "ACTIVE" },
    select: { id: true },
  })
  return !!follow
}
