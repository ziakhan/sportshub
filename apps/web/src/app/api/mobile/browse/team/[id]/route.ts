import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getTeamPublicData } from "@/lib/queries/season-stats"
import { isTeamMember } from "@/lib/authz/team-scope"
import { formatSlotSummary } from "@/lib/teams/practices"
import { rosterState } from "@/lib/teams/roster-commitment"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/browse/team/[id] — the public team page, pre-folded for
 * the native app (native-parity gap 1). Mirrors the web (public)/team/[id]
 * page (getTeamPublicData): club header, record, upcoming/recent games.
 * Practices are club-members-only (owner privacy ruling 2026-07-24, same as
 * web QA-105) — only included when the bearer is a member of this team
 * (isTeamMember: any tenant/team role, or the roster parent/self-account).
 * Anonymous browsing otherwise allowed.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const data = await getTeamPublicData(params.id)
  if (!data) return NextResponse.json({ error: "Team not found" }, { status: 404 })
  const { team, games, record } = data

  const session = await getSessionUserId().catch(() => null)
  const viewerId = session?.userId ?? null
  const isMember = viewerId ? await isTeamMember(viewerId, team.tenantId, team.id) : false

  let practiceSummary: string | null = null
  if (isMember) {
    const practiceInfo = await (prisma as any).team.findUnique({
      where: { id: team.id },
      select: {
        practiceScheduleAnnouncedAt: true,
        practiceSlots: {
          select: { dayOfWeek: true, startTime: true },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        },
      },
    })
    practiceSummary =
      practiceInfo?.practiceScheduleAnnouncedAt && practiceInfo.practiceSlots.length > 0
        ? formatSlotSummary(practiceInfo.practiceSlots)
        : null
  }

  const roster = await rosterState(prisma, team.id)
  const showRosterFillChip = !!roster?.showFill && roster.cap != null

  const seasonInfo = games.find((g: any) => g.season)?.season ?? null

  const completed = games.filter((g: any) => g.status === "COMPLETED" || g.status === "LIVE")
  const upcoming = games
    .filter((g: any) => g.status === "SCHEDULED" && new Date(g.scheduledAt) >= new Date())
    .reverse() // query is desc; upcoming reads better ascending

  const gameShape = (g: any) => ({
    id: g.id,
    scheduledAt: g.scheduledAt,
    status: g.status,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    homeTeam: { id: g.homeTeam.id, name: g.homeTeam.name },
    awayTeam: { id: g.awayTeam.id, name: g.awayTeam.name },
    venue: g.venue ? { name: g.venue.name } : null,
  })

  return NextResponse.json({
    team: {
      id: team.id,
      name: team.name,
      ageGroup: team.ageGroup,
      gender: team.gender,
      season: team.season,
      playerCount: team.players.length,
      tenant: team.tenant
        ? {
            id: team.tenant.id,
            name: team.tenant.name,
            slug: team.tenant.slug,
            city: team.tenant.city,
            state: team.tenant.state,
            primaryColor: team.tenant.branding?.primaryColor ?? null,
            logoUrl: team.tenant.branding?.logoUrl ?? null,
          }
        : null,
    },
    record,
    seasonInfo: seasonInfo
      ? { id: seasonInfo.id, label: seasonInfo.label, leagueId: seasonInfo.league.id, leagueName: seasonInfo.league.name }
      : null,
    roster: showRosterFillChip ? { committed: roster!.committed, cap: roster!.cap } : null,
    isMember,
    practiceSummary,
    upcoming: upcoming.slice(0, 4).map(gameShape),
    recent: completed.slice(0, 8).map(gameShape),
  })
}
