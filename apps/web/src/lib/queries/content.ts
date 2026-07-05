import { prisma } from "@youthbasketballhub/db"
import { cache } from "./request-cache"

/**
 * Public content queries (plan §3/§6): the news feed (published posts +
 * public announcements, one merged stream) and the scoreboard strip. All
 * density-graceful — empty arrays mean the homepage section doesn't render.
 */

export interface FeedItem {
  id: string
  type: "post" | "announcement"
  kind: string
  title: string
  excerpt: string
  dateISO: string
  href: string | null
  author: string | null
  coverUrl: string | null
}

function coverOf(media: Array<{ type: string; url: string; posterUrl: string | null }>): string | null {
  const image = media.find((m) => m.type === "IMAGE")
  if (image) return image.url
  const video = media.find((m) => m.type === "VIDEO_EMBED" && m.posterUrl)
  return video?.posterUrl ?? null
}

function excerptOf(body: string, len = 180): string {
  const clean = body.replace(/\s+/g, " ").trim()
  return clean.length > len ? `${clean.slice(0, len - 1)}…` : clean
}

export const getPublicFeed = cache(async (limit = 12): Promise<FeedItem[]> => {
  const [posts, announcements] = await Promise.all([
    (prisma as any).post.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        kind: true,
        title: true,
        slug: true,
        body: true,
        publishedAt: true,
        media: {
          select: { type: true, url: true, posterUrl: true },
          orderBy: { sortOrder: "asc" },
          take: 3,
        },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
    }),
    (prisma as any).announcement.findMany({
      where: { isPublic: true },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        tenant: { select: { name: true, slug: true } },
        team: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ])

  const items: FeedItem[] = [
    ...posts.map((p: any): FeedItem => ({
      id: p.id,
      type: "post",
      kind: p.kind,
      title: p.title,
      excerpt: excerptOf(p.body),
      dateISO: new Date(p.publishedAt ?? Date.now()).toISOString(),
      href: `/news/${p.slug}`,
      author: p.kind === "RECAP_AI" ? "Game recap" : p.kind === "VIDEO" ? "Highlights" : null,
      coverUrl: coverOf(p.media ?? []),
    })),
    ...announcements.map((a: any): FeedItem => ({
      id: a.id,
      type: "announcement",
      kind: "ANNOUNCEMENT",
      title: a.title,
      excerpt: excerptOf(a.content),
      dateISO: new Date(a.createdAt).toISOString(),
      href: a.tenant?.slug ? `/club/${a.tenant.slug}` : null,
      author: [a.tenant?.name, a.team?.name].filter(Boolean).join(" · ") || null,
      coverUrl: null,
    })),
  ]

  return items
    .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1))
    .slice(0, limit)
})

export interface ScoreboardGame {
  id: string
  status: "SCHEDULED" | "LIVE" | "FINAL"
  dateISO: string
  home: { name: string; color: string | null; score: number | null }
  away: { name: string; color: string | null; score: number | null }
  venue: string | null
  leagueName: string | null
}

const gameSelect = {
  id: true,
  status: true,
  scheduledAt: true,
  homeScore: true,
  awayScore: true,
  homeTeam: {
    select: { name: true, tenant: { select: { branding: { select: { primaryColor: true } } } } },
  },
  awayTeam: {
    select: { name: true, tenant: { select: { branding: { select: { primaryColor: true } } } } },
  },
  venue: { select: { name: true } },
  season: { select: { league: { select: { name: true } } } },
}

function toScoreboardGame(g: any, status: ScoreboardGame["status"]): ScoreboardGame {
  return {
    id: g.id,
    status,
    dateISO: new Date(g.scheduledAt).toISOString(),
    home: {
      name: g.homeTeam.name,
      color: g.homeTeam.tenant?.branding?.primaryColor ?? null,
      score: g.homeScore,
    },
    away: {
      name: g.awayTeam.name,
      color: g.awayTeam.tenant?.branding?.primaryColor ?? null,
      score: g.awayScore,
    },
    venue: g.venue?.name ?? null,
    leagueName: g.season?.league?.name ?? null,
  }
}

/** Live games first, then upcoming (next 7 days), then recent finals. */
export const getScoreboardGames = cache(async (): Promise<ScoreboardGame[]> => {
  const now = new Date()
  const weekAhead = new Date(now.getTime() + 7 * 24 * 3600 * 1000)
  const weekBack = new Date(now.getTime() - 7 * 24 * 3600 * 1000)

  const [live, upcoming, finals] = await Promise.all([
    (prisma as any).game.findMany({
      where: { status: "LIVE" },
      select: gameSelect,
      orderBy: { scheduledAt: "asc" },
      take: 8,
    }),
    (prisma as any).game.findMany({
      where: { status: "SCHEDULED", scheduledAt: { gte: now, lte: weekAhead } },
      select: gameSelect,
      orderBy: { scheduledAt: "asc" },
      take: 6,
    }),
    (prisma as any).game.findMany({
      where: { status: "COMPLETED", scheduledAt: { gte: weekBack } },
      select: gameSelect,
      orderBy: { scheduledAt: "desc" },
      take: 8,
    }),
  ])

  return [
    ...live.map((g: any) => toScoreboardGame(g, "LIVE")),
    ...upcoming.map((g: any) => toScoreboardGame(g, "SCHEDULED")),
    ...finals.map((g: any) => toScoreboardGame(g, "FINAL")),
  ]
})

export interface HighlightItem {
  id: string
  slug: string
  title: string
  posterUrl: string | null
  dateISO: string
}

/** Recent published VIDEO posts for the homepage highlights reel (plan §3.5). */
export const getHighlightPosts = cache(async (limit = 8): Promise<HighlightItem[]> => {
  const posts = await (prisma as any).post.findMany({
    where: { status: "PUBLISHED", kind: "VIDEO", media: { some: { type: "VIDEO_EMBED" } } },
    select: {
      id: true,
      slug: true,
      title: true,
      publishedAt: true,
      media: {
        where: { type: "VIDEO_EMBED" },
        select: { posterUrl: true },
        orderBy: { sortOrder: "asc" },
        take: 1,
      },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
  })
  return posts.map((p: any) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    posterUrl: p.media[0]?.posterUrl ?? null,
    dateISO: new Date(p.publishedAt ?? Date.now()).toISOString(),
  }))
})

/** A published post by slug, with its tags resolved for entity links. */
export const getPublishedPost = cache(async (slug: string) => {
  const post = await (prisma as any).post.findUnique({
    where: { slug },
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      status: true,
      publishedAt: true,
      aiModel: true,
      media: {
        select: { id: true, type: true, url: true, posterUrl: true, title: true },
        orderBy: { sortOrder: "asc" },
      },
      tags: {
        select: {
          gameId: true,
          teamId: true,
          leagueId: true,
          team: { select: { id: true, name: true } },
          tenant: { select: { id: true, name: true, slug: true } },
          league: { select: { id: true, name: true, seasons: { select: { id: true }, orderBy: { createdAt: "desc" as const }, take: 1 } } },
        },
      },
    },
  })
  if (!post || post.status !== "PUBLISHED") return null
  return post
})
