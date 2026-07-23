import { prisma } from "@youthbasketballhub/db"
import { publicPlayerName } from "@/lib/privacy/names"

/**
 * The personalized social feed (social-feed-plan P5): published posts tagged
 * to anything the viewer follows (teams/clubs/leagues/players, ACTIVE only)
 * or is part of (own kids' teams, staff teams), plus PUBLIC reposts made by
 * the accounts of followed players. FOLLOWERS-visibility posts only surface
 * for approved followers and family. Single page (top N) for v1.
 */

export interface FeedItem {
  id: string
  kind: string
  title: string
  body: string
  slug: string
  publishedAt: string | null
  visibility: string
  authorName: string | null
  /** Set when this row reached the feed via a repost */
  repostedBy: string | null
  repostedAt: string | null
  /** Card kinds: the on-demand card image */
  cardImage: string | null
  /** First media asset for photo/video kinds */
  mediaUrl: string | null
  mediaType: string | null
  gameId: string | null
  playerName: string | null
  /** True for the platform's final-score posts (POTG kind, no player tag) */
  isSystemFinal: boolean
  counts: { reactions: number; comments: number; reposts: number }
  myEmojis: string[]
  myRepost: boolean
}

export interface FeedTargets {
  teamIds: string[]
  tenantIds: string[]
  leagueIds: string[]
  playerIds: string[] // approved follows + own kids
  ownPlayerIds: string[]
}

export async function getFeedTargets(userId: string): Promise<FeedTargets> {
  const [follows, children, staffRoles] = await Promise.all([
    (prisma as any).follow.findMany({
      where: { userId, status: "ACTIVE" },
      select: { teamId: true, tenantId: true, leagueId: true, playerId: true },
    }),
    (prisma as any).player.findMany({
      where: { parentId: userId, deletedAt: null },
      select: { id: true, teams: { where: { status: "ACTIVE" }, select: { teamId: true } } },
    }),
    (prisma as any).userRole.findMany({
      where: { userId, teamId: { not: null }, role: { in: ["Staff", "TeamManager"] } },
      select: { teamId: true },
    }),
  ])

  const teamIds = new Set<string>()
  const tenantIds = new Set<string>()
  const leagueIds = new Set<string>()
  const playerIds = new Set<string>()
  for (const f of follows) {
    if (f.teamId) teamIds.add(f.teamId)
    if (f.tenantId) tenantIds.add(f.tenantId)
    if (f.leagueId) leagueIds.add(f.leagueId)
    if (f.playerId) playerIds.add(f.playerId)
  }
  const ownPlayerIds: string[] = []
  for (const child of children) {
    ownPlayerIds.push(child.id)
    playerIds.add(child.id)
    for (const tp of child.teams) teamIds.add(tp.teamId)
  }
  for (const r of staffRoles) teamIds.add(r.teamId)

  return {
    teamIds: [...teamIds],
    tenantIds: [...tenantIds],
    leagueIds: [...leagueIds],
    playerIds: [...playerIds],
    ownPlayerIds,
  }
}

const POST_INCLUDE = {
  author: { select: { firstName: true, lastName: true } },
  tags: {
    select: {
      gameId: true,
      playerId: true,
      player: { select: { firstName: true, lastName: true, mediaConsent: true } },
    },
  },
  media: { orderBy: { sortOrder: "asc" as const }, take: 1 },
  _count: { select: { reactions: true, comments: true, reposts: true } },
}

function toItem(post: any, viewerReactions: Map<string, string[]>, viewerReposts: Set<string>): FeedItem {
  const gameTag = post.tags.find((t: any) => t.gameId)
  const playerTag = post.tags.find((t: any) => t.playerId)
  const isCard = post.kind === "STAT_CARD" || post.kind === "PLAYER_OF_GAME"
  const gameId = gameTag?.gameId ?? null
  return {
    id: post.id,
    kind: post.kind,
    title: post.title,
    body: post.body,
    slug: post.slug,
    publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString() : null,
    visibility: post.visibility,
    authorName: post.author
      ? `${post.author.firstName ?? ""} ${post.author.lastName ?? ""}`.trim() || null
      : null,
    repostedBy: null,
    repostedAt: null,
    cardImage:
      isCard && gameId
        ? post.kind === "PLAYER_OF_GAME"
          ? playerTag
            ? `/api/live/${gameId}/card?src=post:${post.id}&aspect=portrait&v=3`
            : // System final post (no player tag) → SCORE card, so the feed
              // never shows two POTG cards for the same game
              `/api/live/${gameId}/card?variant=score&aspect=portrait&v=3`
          : playerTag
            ? `/api/live/${gameId}/card/${playerTag.playerId}?src=post:${post.id}&aspect=portrait&v=3`
            : null
        : null,
    // SVG data-URI covers can't render in React Native — recaps fall back
    // to the game's PNG score card (native + web consistent)
    mediaUrl: post.media[0]?.url?.startsWith("data:image/svg")
      ? gameId
        ? `/api/live/${gameId}/card?variant=score&v=3`
        : null
      : (post.media[0]?.url ?? null),
    mediaType: post.media[0]?.type ?? null,
    gameId,
    playerName: playerTag?.player ? publicPlayerName(playerTag.player) : null,
    isSystemFinal: post.kind === "PLAYER_OF_GAME" && !playerTag,
    counts: {
      reactions: post._count.reactions,
      comments: post._count.comments,
      reposts: post._count.reposts,
    },
    myEmojis: viewerReactions.get(post.id) ?? [],
    myRepost: viewerReposts.has(post.id),
  }
}

/**
 * "My posts" (owner 2026-07-23: makes sense for every role): everything this
 * user authored — parents' shared player cards, org admins' club/league
 * posts — plus their reposts. One surface, role-agnostic.
 */
export async function getMyPosts(userId: string, limit = 50): Promise<FeedItem[]> {
  const [posts, reposts] = await Promise.all([
    (prisma as any).post.findMany({
      where: { authorId: userId, status: "PUBLISHED" },
      include: POST_INCLUDE,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: limit,
    }),
    (prisma as any).repost.findMany({
      where: { userId, post: { status: "PUBLISHED" } },
      include: { post: { include: POST_INCLUDE } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ])
  const pageIds = [...posts.map((p: any) => p.id), ...reposts.map((r: any) => r.post.id)]
  const myReactions = await (prisma as any).postReaction.findMany({
    where: { userId, postId: { in: pageIds } },
    select: { postId: true, emoji: true },
  })
  const reactionsByPost = new Map<string, string[]>()
  for (const r of myReactions) {
    reactionsByPost.set(r.postId, [...(reactionsByPost.get(r.postId) ?? []), r.emoji])
  }
  const repostSet = new Set<string>(reposts.map((r: any) => r.postId))
  const items = [
    ...posts.map((p: any) => toItem(p, reactionsByPost, repostSet)),
    ...reposts
      .filter((r: any) => !posts.some((p: any) => p.id === r.post.id))
      .map((r: any) => ({
        ...toItem(r.post, reactionsByPost, repostSet),
        repostedBy: "You",
        repostedAt: new Date(r.createdAt).toISOString(),
      })),
  ]
  return items
    .sort((a, b) =>
      (b.repostedAt ?? b.publishedAt ?? "").localeCompare(a.repostedAt ?? a.publishedAt ?? "")
    )
    .slice(0, limit)
}

export async function getSocialFeed(userId: string, limit = 30): Promise<FeedItem[]> {
  const t = await getFeedTargets(userId)
  const tagOr: any[] = []
  if (t.teamIds.length) tagOr.push({ teamId: { in: t.teamIds } })
  if (t.tenantIds.length) tagOr.push({ tenantId: { in: t.tenantIds } })
  if (t.leagueIds.length) tagOr.push({ leagueId: { in: t.leagueIds } })
  if (t.playerIds.length) tagOr.push({ playerId: { in: t.playerIds } })
  if (tagOr.length === 0) return []

  // Reposters the viewer should hear from: the accounts behind followed players
  const followedPlayers = await (prisma as any).player.findMany({
    where: { id: { in: t.playerIds } },
    select: { parentId: true },
  })
  const reposterIds = [...new Set<string>(followedPlayers.map((p: any) => p.parentId))]

  const [posts, reposts] = await Promise.all([
    (prisma as any).post.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { visibility: "PUBLIC", tags: { some: { OR: tagOr } } },
          // FOLLOWERS posts: only via the tagged player, for approved followers/family
          ...(t.playerIds.length
            ? [{ visibility: "FOLLOWERS", tags: { some: { playerId: { in: t.playerIds } } } }]
            : []),
        ],
      },
      include: POST_INCLUDE,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: limit,
    }),
    reposterIds.length
      ? (prisma as any).repost.findMany({
          where: {
            userId: { in: reposterIds },
            post: { status: "PUBLISHED", visibility: "PUBLIC" },
          },
          include: {
            post: { include: POST_INCLUDE },
            user: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : [],
  ])

  const pageIds = [
    ...posts.map((p: any) => p.id),
    ...reposts.map((r: any) => r.post.id),
  ]
  const [myReactions, myReposts] = await Promise.all([
    (prisma as any).postReaction.findMany({
      where: { userId, postId: { in: pageIds } },
      select: { postId: true, emoji: true },
    }),
    (prisma as any).repost.findMany({
      where: { userId, postId: { in: pageIds } },
      select: { postId: true },
    }),
  ])
  const reactionsByPost = new Map<string, string[]>()
  for (const r of myReactions) {
    reactionsByPost.set(r.postId, [...(reactionsByPost.get(r.postId) ?? []), r.emoji])
  }
  const repostSet = new Set<string>(myReposts.map((r: any) => r.postId))

  const items: FeedItem[] = [
    ...posts.map((p: any) => toItem(p, reactionsByPost, repostSet)),
    ...reposts.map((r: any) => ({
      ...toItem(r.post, reactionsByPost, repostSet),
      repostedBy: `${r.user?.firstName ?? ""} ${r.user?.lastName ?? ""}`.trim() || "Someone",
      repostedAt: new Date(r.createdAt).toISOString(),
    })),
  ]

  // Dedup (a repost of something already in the feed keeps the repost row
  // only if it's newer), then merge by time
  const seen = new Map<string, FeedItem>()
  for (const item of items) {
    const key = item.id
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, item)
      continue
    }
    const a = existing.repostedAt ?? existing.publishedAt ?? ""
    const b = item.repostedAt ?? item.publishedAt ?? ""
    if (b > a) seen.set(key, item)
  }
  return [...seen.values()]
    .sort((a, b) =>
      (b.repostedAt ?? b.publishedAt ?? "").localeCompare(a.repostedAt ?? a.publishedAt ?? "")
    )
    .slice(0, limit)
}
