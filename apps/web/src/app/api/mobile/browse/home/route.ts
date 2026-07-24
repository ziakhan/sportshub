import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getPublicFeed, getScoreboardGames } from "@/lib/queries/content"
import { getAllPrograms } from "@/lib/queries/programs"
import { getClubsDirectory } from "@/lib/queries/directory-clubs"
import { getLeaguesDirectory } from "@/lib/queries/directory-leagues"
import { appBaseUrl } from "@/lib/email"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/browse/home — the PUBLIC layer for the native Home and
 * Browse hub in one anonymous round trip (audit v2 §3): featured clubs,
 * active leagues, latest news, next programs. The web homepage's public
 * sections, native-shaped.
 *
 * Clubs/leagues subsections now share getClubsDirectory()/getLeaguesDirectory()
 * with the web /club and /leagues pages (2026-07-24 drift fix) instead of
 * hand-rolling their own prisma — this route used to skip the test-world
 * exclusion the directory applies, and its league query missed any league
 * whose only season wasn't REGISTRATION/IN_PROGRESS at fetch time. Response
 * shape kept backward-compatible (additive only).
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
    const [clubsDirectory, leaguesDirectory, news, programs] = await Promise.all([
      getClubsDirectory(),
      getLeaguesDirectory(),
      getPublicFeed(6),
      getAllPrograms(),
    ])

    // Top clubs by team count (the home widget's original ordering) — merge
    // the directory's featured/regular split back into one list first since
    // "featured" isn't a home-widget concept, just top clubs overall.
    const clubs = [...clubsDirectory.featured, ...clubsDirectory.clubs]
      .sort((a, b) => b._count.teams - a._count.teams)
      .slice(0, 6)

    // Active leagues only (registration open or underway) — the home
    // widget's original scope, narrower than the full directory.
    const leagues = leaguesDirectory
      .filter((l) => l.season.status === "REGISTRATION" || l.season.status === "IN_PROGRESS")
      .slice(0, 6)

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
      clubs: clubs.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        city: c.city,
        state: c.state,
        teamCount: c._count.teams,
        primaryColor: c.branding?.primaryColor ?? null,
        logoUrl: c.branding?.logoUrl ?? null,
        // Additive (2026-07-24 five-tab parity pass): the SAME published-review
        // rating the web /club page and native Clubs/Programs screens show.
        rating: c.rating ? { average: c.rating.average, count: c.rating.count } : null,
      })),
      leagues: leagues.map((l) => ({
        id: l.id,
        name: l.name,
        // Kept as an array (old shape) — always the one latest active season.
        seasons: [
          {
            id: l.season.id,
            name: l.season.label,
            status: l.season.status,
            teamCount: l.season.teamCount,
            // Additive: matches the richer directory fields the web /leagues
            // page and native Leagues screen already show.
            divisionCount: l.season.divisionCount,
          },
        ],
        // Additive
        description: l.description,
        completedGames: l.completedGames,
        liveGames: l.liveGames,
      })),
      news: newsWithImages,
      programs: programs.slice(0, 6),
    })
  } catch (error) {
    console.error("Mobile browse home error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
