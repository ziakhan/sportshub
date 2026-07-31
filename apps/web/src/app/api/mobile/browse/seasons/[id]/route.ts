import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getPublicSeason } from "@/lib/queries/season"
import { getSeasonStandings } from "@/lib/queries/standings"
import { getSeasonLeaders } from "@/lib/queries/season-stats"
import { resolveCoverUrl } from "@/lib/queries/content"
import { socialLinks } from "@/lib/club-page/blocks"
import { publicPlayerName } from "@/lib/privacy/names"
import { PUBLISHED_GAME } from "@/lib/games/visibility"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/browse/seasons/[id] — one league season for the native
 * league screen: info + standings + recent/upcoming games. Anonymous; the
 * same resolvers as the public /league/[id] page.
 *
 * 2026-07-25 (native league/season screen rebuild): additive fields for the
 * beautified native hero + web-parity sections that were missing before —
 * `season.league.logoUrl/bannerUrl/tagline/primaryColor/socials`,
 * `season.league.description`, `season.registrationDeadline/teamFee/
 * currency/gamesGuaranteed/playoffFormat`, `teams` (approved roster grouped
 * by division), `live` games, and `leaders` (scoring leaders). Existing
 * field names/shapes are unchanged.
 *
 * 2026-07-24 (news card sweep): additive `news` — the same league-tagged
 * posts the web /league/[id] page's "League news" card grid shows, missing
 * from this route before (the native season screen had no news section at
 * all). coverUrl is resolved through resolveCoverUrl (one cover per game,
 * everywhere) — never the raw SVG data-URI a recap post's own media stores.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [season, standings, leaders] = await Promise.all([
      getPublicSeason(params.id),
      getSeasonStandings(params.id),
      getSeasonLeaders(params.id, 5),
    ])
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const now = new Date()
    const gameSelect = {
      id: true,
      scheduledAt: true,
      status: true,
      homeScore: true,
      awayScore: true,
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      venue: { select: { name: true } },
    } as const
    const [upcoming, recent, live] = await Promise.all([
      prisma.game.findMany({
        where: { seasonId: params.id, scheduledAt: { gte: now }, status: { not: "CANCELLED" }, ...PUBLISHED_GAME },
        select: gameSelect,
        orderBy: { scheduledAt: "asc" },
        take: 15,
      }),
      prisma.game.findMany({
        where: { seasonId: params.id, scheduledAt: { lt: now }, ...PUBLISHED_GAME },
        select: gameSelect,
        orderBy: { scheduledAt: "desc" },
        take: 15,
      }),
      prisma.game.findMany({
        where: { seasonId: params.id, status: "LIVE" },
        select: gameSelect,
        orderBy: { scheduledAt: "asc" },
        take: 6,
      }),
    ])

    const approvedTeams = (season.teamSubmissions ?? []).filter((t: any) => t.status === "APPROVED")

    const leagueId = season.league?.id ?? null
    const rawPosts = leagueId
      ? await (prisma as any).post.findMany({
          where: { status: "PUBLISHED", tags: { some: { leagueId } } },
          select: {
            id: true,
            title: true,
            slug: true,
            publishedAt: true,
            kind: true,
            media: { select: { type: true, url: true, posterUrl: true }, orderBy: { sortOrder: "asc" as const }, take: 1 },
            tags: { where: { gameId: { not: null } }, select: { gameId: true }, take: 1 },
          },
          orderBy: { publishedAt: "desc" },
          take: 4,
        })
      : []
    const news = rawPosts.map((p: any) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      publishedAt: p.publishedAt,
      coverUrl: resolveCoverUrl(p.tags, p.media),
      isRecap: p.kind === "RECAP_AI",
    }))

    return NextResponse.json({
      season: {
        id: season.id,
        name: season.label,
        status: season.status,
        startDate: season.startDate,
        endDate: season.endDate,
        // Additive: registration + format details the web sidebar shows.
        registrationDeadline: season.registrationDeadline,
        teamFee: season.teamFee,
        currency: season.currency,
        gamesGuaranteed: season.gamesGuaranteed,
        playoffFormat: season.playoffFormat,
        league: season.league
          ? {
              id: season.league.id,
              name: season.league.name,
              description: season.league.description,
              perks: season.league.perks ?? [],
              perksNote: season.league.perksNote ?? null,
              // Additive: branded hero fields (same shape the club hero uses).
              logoUrl: season.league.logoUrl ?? null,
              bannerUrl: season.league.bannerUrl ?? null,
              tagline: season.league.tagline ?? null,
              primaryColor: season.league.primaryColor ?? null,
              socials: socialLinks(season.league.socials),
            }
          : null,
        divisions: (season.divisions ?? []).map((d: any) => ({
          id: d.id,
          name: d.name ?? d.ageGroup,
          ageGroup: d.ageGroup,
        })),
      },
      // Additive: approved teams, grouped by division on the client (small
      // list) — the web Teams block's data, missing from this route before.
      teams: approvedTeams.map((t: any) => ({
        id: t.team.id,
        name: t.team.name,
        clubName: t.team.tenant?.name ?? null,
        clubSlug: t.team.tenant?.slug ?? null,
        divisionName: t.division?.name ?? null,
      })),
      standings,
      // Anonymous route — never forward raw firstName/lastName; the public
      // consent-gated name only (same rule as playerDisplayName's signed-out
      // branch — this route has no session to know "participant").
      leaders: (leaders?.categories.find((c) => c.key === "ppg")?.rows.slice(0, 5) ?? []).map((r: any) => ({
        playerId: r.playerId,
        name: publicPlayerName(r),
        teamName: r.teamName,
        value: r.value,
      })),
      upcoming,
      recent,
      live,
      news,
    })
  } catch (error) {
    console.error("Mobile season error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
