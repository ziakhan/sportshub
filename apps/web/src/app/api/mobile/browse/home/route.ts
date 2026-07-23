import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getPublicFeed, getScoreboardGames } from "@/lib/queries/content"
import { getAllPrograms } from "@/lib/queries/programs"
import { appBaseUrl } from "@/lib/email"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/browse/home — the PUBLIC layer for the native Home and
 * Browse hub in one anonymous round trip (audit v2 §3): featured clubs,
 * active leagues, latest news, next programs. The web homepage's public
 * sections, native-shaped.
 */
export async function GET() {
  try {
    const [scoreboard, totalClubs, totalTeams, totalTryouts] = await Promise.all([
      // Guest-home parity (native-parity-v2): the SAME scoreboard + stats the
      // web homepage renders
      getScoreboardGames(),
      prisma.tenant.count({ where: { status: { in: ["ACTIVE", "UNCLAIMED"] } } }),
      prisma.team.count(),
      prisma.tryout.count({ where: { isPublished: true, isPublic: true } }),
    ])
    const [clubs, leagues, news, programs] = await Promise.all([
      prisma.tenant.findMany({
        where: { status: { in: ["ACTIVE", "UNCLAIMED"] } },
        select: {
          id: true,
          slug: true,
          name: true,
          city: true,
          state: true,
          branding: { select: { primaryColor: true, logoUrl: true } },
          _count: { select: { teams: true } },
        },
        orderBy: { teams: { _count: "desc" } },
        take: 6,
      }),
      (prisma as any).league.findMany({
        where: { seasons: { some: { status: { in: ["REGISTRATION", "IN_PROGRESS"] } } } },
        select: {
          id: true,
          name: true,
          seasons: {
            where: { status: { in: ["REGISTRATION", "IN_PROGRESS"] } },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              label: true,
              status: true,
              _count: { select: { teamSubmissions: true } },
            },
            take: 2,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      getPublicFeed(6),
      getAllPrograms(),
    ])

    // RN can't render the web's inline-SVG matchup covers — map each game
    // recap to its PNG score card instead (same art, native-safe).
    const newsIds = news.map((n: any) => n.id)
    const gameTags = newsIds.length
      ? await prisma.postTag.findMany({
          where: { postId: { in: newsIds }, gameId: { not: null } },
          select: { postId: true, gameId: true },
        })
      : []
    const gameByPost = new Map(gameTags.map((t: any) => [t.postId, t.gameId]))
    const newsWithImages = news.map((n: any) => ({
      ...n,
      imageUrl: n.coverUrl?.startsWith("data:image/svg")
        ? gameByPost.has(n.id)
          ? `${appBaseUrl()}/api/live/${gameByPost.get(n.id)}/cover?v=5`
          : null
        : (n.coverUrl ?? null),
    }))

    return NextResponse.json({
      scoreboard,
      stats: { totalClubs, totalTeams, totalTryouts },
      clubs: clubs.map((c: any) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        city: c.city,
        state: c.state,
        teamCount: c._count.teams,
        primaryColor: c.branding?.primaryColor ?? null,
        logoUrl: c.branding?.logoUrl ?? null,
      })),
      leagues: leagues.map((l: any) => ({
        id: l.id,
        name: l.name,
        seasons: l.seasons.map((s: any) => ({
          id: s.id,
          name: s.label,
          status: s.status,
          teamCount: s._count.teamSubmissions,
        })),
      })),
      news: newsWithImages,
      programs: programs.slice(0, 6),
    })
  } catch (error) {
    console.error("Mobile browse home error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
