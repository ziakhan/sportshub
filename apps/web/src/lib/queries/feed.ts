import { prisma } from "@youthbasketballhub/db"
import { publicPlayerName } from "@/lib/privacy/names"
import { appBaseUrl } from "@/lib/email"
import { dateInTz } from "@/lib/calendar/timezone"

/** Image URLs leave the server ABSOLUTE (bug 2026-07-25): native app bundles
 * historically mishandled relative /api/live paths — absolute URLs render on
 * every client and every bundle version, web included (same origin). */
const abs = (u: string | null) => (u && u.startsWith("/") ? `${appBaseUrl()}${u}` : u)

/**
 * The personalized social feed (social-feed-plan P5): published posts tagged
 * to anything the viewer follows (teams/clubs/leagues/players, ACTIVE only)
 * or is part of (own kids' teams, staff teams), plus PUBLIC reposts made by
 * the accounts of followed players. FOLLOWERS-visibility posts only surface
 * for approved followers and family. Single page (top N) for v1.
 */

export interface FeedItem {
  /** Discriminant for the render union (business-model-v2 §16 S1) — always
   * "post" for a real Post row. Virtual items (digest/preview) are a
   * SEPARATE type, never mixed into this shape; see FeedExtras below. */
  type: "post"
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

/** One routine final folded into a digest bucket (not a Post — no reactions/comments). */
export interface DigestGameRow {
  gameId: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
}

/**
 * VIRTUAL "Yesterday around your clubs" card (owner ruling: routine finals
 * never flood the feed) — one per calendar day per viewer, computed at
 * query time from Game rows. No Post row exists for this; see the crash-
 * safety note on FeedExtras for why it never rides in `items`.
 */
export interface DigestFeedItem {
  type: "digest"
  id: string
  dateKey: string // "2026-07-24" in APP_TIMEZONE
  title: string // "Yesterday around your clubs"
  games: DigestGameRow[]
  /** Sort key for interleaving with real posts (ISO timestamp) */
  sortAt: string
}

/** VIRTUAL upcoming-game heads-up card ("Sat: Lords vs Kings"). No Post row. */
export interface PreviewFeedItem {
  type: "preview"
  id: string
  gameId: string
  title: string
  homeTeam: string
  awayTeam: string
  scheduledAt: string
  sortAt: string
}

/**
 * Virtual items ship SEPARATELY from `items` (native-parity-v2 crash-safety
 * rule): an old client that only knows how to render Post-shaped FeedItems
 * would throw reading `.counts.reactions` etc. off a digest/preview row if
 * they were mixed into `items`. `extras` is purely additive — a client that
 * doesn't read it just never renders digest/preview cards, gracefully.
 */
export interface FeedExtras {
  digest: DigestFeedItem[]
  previews: PreviewFeedItem[]
}

/**
 * Render union for a merged, time-ordered feed. `items` (real Posts) and
 * `extras` (virtual digest/preview) are fetched and shipped SEPARATELY —
 * see FeedExtras — and merged only on the client via mergeFeedWithExtras.
 */
export type FeedRenderItem = FeedItem | DigestFeedItem | PreviewFeedItem

// Routine-final notability (owner ruling, business-model-v2 §12): a margin
// this close ("clutch") or a game that already produced a milestone card
// earns a standalone card instead of folding into the digest. Upset
// detection (beat a team ranked >=3 spots higher) is SKIPPED for v1 per the
// owner's own escape hatch ("else skip upsets v1 and note it") — computing
// standings per candidate final on every feed load is real cost for a
// nice-to-have; revisit once games flow through S3 recsys scoring anyway.
const DIGEST_MARGIN_THRESHOLD = 3
// Trailing days of routine finals folded into digest buckets.
const DIGEST_LOOKBACK_DAYS = 3
const PREVIEW_WINDOW_HOURS = 48
const PREVIEW_LIMIT = 6

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function digestDateKey(d: Date): string {
  const { year, month, day } = dateInTz(d)
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** "2026-07-24" → weekday index, via plain calendar math (no second tz call needed). */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function digestTitle(dateKey: string, now: Date): string {
  const todayKey = digestDateKey(now)
  const yesterdayKey = digestDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  if (dateKey === todayKey) return "Today around your clubs"
  if (dateKey === yesterdayKey) return "Yesterday around your clubs"
  return `${WEEKDAYS[weekdayOf(dateKey)]} around your clubs`
}

export function previewDayLabel(d: Date): string {
  return WEEKDAYS_SHORT[dateInTz(d).dayOfWeek]
}

/** Shared by getSocialFeed (items) and getFeedExtras (digest) so the same
 * game never reads as "standalone" in one place and "routine" in the other. */
export function isNotableFinal(marginAbs: number, hasMilestone: boolean): boolean {
  return marginAbs <= DIGEST_MARGIN_THRESHOLD || hasMilestone
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
    type: "post",
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
    // cardImage stays RELATIVE: every shipped native bundle prefixes it with
    // the API host unconditionally (absolute broke it — 2026-07-25).
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
    // PNG covers ONLY toward clients: SVG data-URIs render on web but not in
    // the RN Image bundles still in the field. PNG renders on every bundle
    // AND in expo-image — lowest common denominator wins (2026-07-25).
    mediaUrl: abs(
      post.media[0]?.url?.startsWith("data:image/svg")
        ? gameId
          ? `/api/live/${gameId}/cover?v=5`
          : null
        : (post.media[0]?.url ?? null)
    ),
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

export async function getSocialFeed(
  userId: string,
  limit = 30,
  targetsIn?: FeedTargets
): Promise<FeedItem[]> {
  const t = targetsIn ?? (await getFeedTargets(userId))
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

  // Digest folding (owner ruling, §12): a "final-<gameId>" post with kind
  // ANNOUNCEMENT (no POTG picked) is a ROUTINE final — collapse it out of
  // the feed unless it's notable; the routine ones surface via the digest
  // virtual card instead (getFeedExtras). POTG finals (kind PLAYER_OF_GAME)
  // and every other kind are untouched — Class A, always standalone.
  const routineFinalCandidates = (posts as any[]).filter(
    (p) => p.kind === "ANNOUNCEMENT" && typeof p.slug === "string" && p.slug.startsWith("final-")
  )
  const excludeIds = new Set<string>()
  if (routineFinalCandidates.length > 0) {
    const byId = new Map<string, string>() // postId -> gameId
    for (const p of routineFinalCandidates) {
      const gameId = p.tags.find((tg: any) => tg.gameId)?.gameId
      if (gameId) byId.set(p.id, gameId)
    }
    const gameIds = [...new Set(byId.values())]
    const [games, milestoneTags] = await Promise.all([
      (prisma as any).game.findMany({
        where: { id: { in: gameIds } },
        select: { id: true, homeScore: true, awayScore: true },
      }),
      (prisma as any).postTag.findMany({
        where: { gameId: { in: gameIds }, post: { kind: "MILESTONE", status: "PUBLISHED" } },
        select: { gameId: true },
      }),
    ])
    const scoreByGame = new Map(games.map((g: any) => [g.id, g]))
    const milestoneGameIds = new Set(milestoneTags.map((mt: any) => mt.gameId))
    for (const p of routineFinalCandidates) {
      const gameId = byId.get(p.id)
      const g = gameId ? (scoreByGame.get(gameId) as any) : null
      const margin =
        g && g.homeScore != null && g.awayScore != null ? Math.abs(g.homeScore - g.awayScore) : Infinity
      const notable = isNotableFinal(margin, !!gameId && milestoneGameIds.has(gameId))
      if (!notable) excludeIds.add(p.id)
    }
  }
  const visiblePosts = excludeIds.size ? (posts as any[]).filter((p) => !excludeIds.has(p.id)) : posts
  const visibleReposts = excludeIds.size
    ? (reposts as any[]).filter((r) => !excludeIds.has(r.post.id))
    : reposts

  const pageIds = [
    ...visiblePosts.map((p: any) => p.id),
    ...visibleReposts.map((r: any) => r.post.id),
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
    ...visiblePosts.map((p: any) => toItem(p, reactionsByPost, repostSet)),
    ...visibleReposts.map((r: any) => ({
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

/**
 * Virtual feed content (business-model-v2 §12/§16 S1): the digest of
 * routine finals folded out of getSocialFeed, plus upcoming-48h matchup
 * previews for followed teams. Computed at query time — no cron, no stored
 * rows. Returns `{ digest: [], previews: [] }` (never throws) when the
 * viewer follows nothing.
 */
export async function getFeedExtras(userId: string, targetsIn?: FeedTargets): Promise<FeedExtras> {
  const t = targetsIn ?? (await getFeedTargets(userId))

  const teamScopeIds = new Set(t.teamIds)
  if (t.tenantIds.length) {
    const tenantTeams = await (prisma as any).team.findMany({
      where: { tenantId: { in: t.tenantIds } },
      select: { id: true },
    })
    for (const tt of tenantTeams) teamScopeIds.add(tt.id)
  }
  const teamIdList = [...teamScopeIds]
  if (teamIdList.length === 0) return { digest: [], previews: [] }

  const now = new Date()
  const lookbackStart = new Date(now.getTime() - DIGEST_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const previewEnd = new Date(now.getTime() + PREVIEW_WINDOW_HOURS * 60 * 60 * 1000)

  const [finishedGames, upcomingGames] = await Promise.all([
    (prisma as any).game.findMany({
      where: {
        status: "COMPLETED",
        scheduledAt: { gte: lookbackStart },
        OR: [{ homeTeamId: { in: teamIdList } }, { awayTeamId: { in: teamIdList } }],
      },
      select: {
        id: true,
        scheduledAt: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 60,
    }),
    (prisma as any).game.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { gte: now, lte: previewEnd },
        OR: [{ homeTeamId: { in: teamIdList } }, { awayTeamId: { in: teamIdList } }],
      },
      select: {
        id: true,
        scheduledAt: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: PREVIEW_LIMIT,
    }),
  ])

  let digest: DigestFeedItem[] = []
  if (finishedGames.length > 0) {
    const [finalPosts, milestoneTags] = await Promise.all([
      (prisma as any).post.findMany({
        where: { slug: { in: finishedGames.map((g: any) => `final-${g.id}`) } },
        select: { slug: true, kind: true, status: true },
      }),
      (prisma as any).postTag.findMany({
        where: {
          gameId: { in: finishedGames.map((g: any) => g.id) },
          post: { kind: "MILESTONE", status: "PUBLISHED" },
        },
        select: { gameId: true },
      }),
    ])
    const finalBySlug = new Map(finalPosts.map((p: any) => [p.slug, p]))
    const milestoneGameIds = new Set(milestoneTags.map((mt: any) => mt.gameId))

    const buckets = new Map<string, { games: DigestGameRow[]; latest: Date }>()
    for (const g of finishedGames) {
      const fp = finalBySlug.get(`final-${g.id}`) as any
      // No system final post yet, or it's already Class A (POTG picked) —
      // either way it's not a ROUTINE final, skip.
      if (!fp || fp.status !== "PUBLISHED" || fp.kind !== "ANNOUNCEMENT") continue
      if (g.homeScore == null || g.awayScore == null) continue
      const margin = Math.abs(g.homeScore - g.awayScore)
      if (isNotableFinal(margin, milestoneGameIds.has(g.id))) continue // already standalone in items

      const dateKey = digestDateKey(g.scheduledAt)
      let bucket = buckets.get(dateKey)
      if (!bucket) {
        bucket = { games: [], latest: g.scheduledAt }
        buckets.set(dateKey, bucket)
      }
      bucket.games.push({
        gameId: g.id,
        homeTeam: g.homeTeam.name,
        awayTeam: g.awayTeam.name,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
      })
      if (g.scheduledAt > bucket.latest) bucket.latest = g.scheduledAt
    }

    digest = [...buckets.entries()]
      .map(([dateKey, b]) => ({
        type: "digest" as const,
        id: `digest-${dateKey}`,
        dateKey,
        title: digestTitle(dateKey, now),
        games: b.games,
        sortAt: b.latest.toISOString(),
      }))
      .sort((a, b) => b.sortAt.localeCompare(a.sortAt))
  }

  const previews: PreviewFeedItem[] = upcomingGames.map((g: any) => ({
    type: "preview" as const,
    id: `preview-${g.id}`,
    gameId: g.id,
    title: `${previewDayLabel(g.scheduledAt)}: ${g.homeTeam.name} vs ${g.awayTeam.name}`,
    homeTeam: g.homeTeam.name,
    awayTeam: g.awayTeam.name,
    scheduledAt: g.scheduledAt.toISOString(),
    sortAt: g.scheduledAt.toISOString(),
  }))

  return { digest, previews }
}

/**
 * Merge real posts with virtual digest/preview items into one time-ordered
 * render list. Native (apps/mobile/src/app/(tabs)/social.tsx) mirrors this
 * exact sort in TS since it can't import server code — keep them in sync.
 */
export function mergeFeedWithExtras(items: FeedItem[], extras: FeedExtras): FeedRenderItem[] {
  const all: FeedRenderItem[] = [...items, ...extras.digest, ...extras.previews]
  const sortKey = (r: FeedRenderItem): string =>
    r.type === "post" ? (r.repostedAt ?? r.publishedAt ?? "") : r.sortAt
  return all.sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
}
