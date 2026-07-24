import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembership, getMemberTeamIds } from "@/lib/teams/chat-access"
import { pollInclude, serializePoll } from "@/lib/teams/polls"
import { canManageClubPolls, canManageLeaguePolls } from "@/lib/polls/authz"

export const dynamic = "force-dynamic"

/**
 * GET /api/mobile/polls — the native twin of the (platform)/polls page (the
 * findable poll surface, three-tier polls ruling owner 2026-07-24): every
 * OPEN poll the viewer can see across their teams, clubs and leagues, in one
 * list, with enough scope info for the client to vote directly against the
 * right scope's existing vote endpoint (no new vote route needed). Bearer or
 * session auth via getSessionUserId.
 */
export async function GET() {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = auth.userId
    const isPlatformAdmin = auth.isPlatformAdmin

    const memberTeamIds = [...(await getMemberTeamIds(userId))]

    const [teamsInfo, directTenantRoles, directLeagueRoles] = await Promise.all([
      memberTeamIds.length > 0
        ? prisma.team.findMany({
            where: { id: { in: memberTeamIds } },
            select: { id: true, name: true, tenantId: true },
          })
        : Promise.resolve([] as any[]),
      prisma.userRole.findMany({
        where: { userId, tenantId: { not: null } },
        select: { tenantId: true },
      }),
      prisma.userRole.findMany({
        where: { userId, leagueId: { not: null } },
        select: { leagueId: true },
      }),
    ])

    const tenantIds = new Set<string>()
    for (const t of teamsInfo) tenantIds.add(t.tenantId)
    for (const r of directTenantRoles) if (r.tenantId) tenantIds.add(r.tenantId)

    const leagueIds = new Set<string>()
    for (const r of directLeagueRoles) if (r.leagueId) leagueIds.add(r.leagueId)
    if (memberTeamIds.length > 0) {
      const approvedSubs = await (prisma as any).teamSubmission.findMany({
        where: { teamId: { in: memberTeamIds }, status: "APPROVED" },
        select: { season: { select: { leagueId: true } } },
      })
      for (const s of approvedSubs as Array<{ season: { leagueId: string } }>) {
        leagueIds.add(s.season.leagueId)
      }
    }

    const [teamPolls, clubPolls, leaguePolls, tenantsMeta, leaguesMeta] = await Promise.all([
      memberTeamIds.length > 0
        ? (prisma as any).poll.findMany({
            where: { teamId: { in: memberTeamIds }, status: "OPEN" },
            include: pollInclude,
            orderBy: { createdAt: "desc" },
            take: 30,
          })
        : Promise.resolve([] as any[]),
      tenantIds.size > 0
        ? (prisma as any).poll.findMany({
            where: { tenantId: { in: [...tenantIds] }, status: "OPEN" },
            include: pollInclude,
            orderBy: { createdAt: "desc" },
            take: 30,
          })
        : Promise.resolve([] as any[]),
      leagueIds.size > 0
        ? (prisma as any).poll.findMany({
            where: { leagueId: { in: [...leagueIds] }, status: "OPEN" },
            include: pollInclude,
            orderBy: { createdAt: "desc" },
            take: 30,
          })
        : Promise.resolve([] as any[]),
      tenantIds.size > 0
        ? prisma.tenant.findMany({ where: { id: { in: [...tenantIds] } }, select: { id: true, name: true } })
        : Promise.resolve([] as any[]),
      leagueIds.size > 0
        ? prisma.league.findMany({ where: { id: { in: [...leagueIds] } }, select: { id: true, name: true } })
        : Promise.resolve([] as any[]),
    ])

    const teamPollRows = teamPolls as any[]
    const clubPollRows = clubPolls as any[]
    const leaguePollRows = leaguePolls as any[]

    const teamNameById = new Map(teamsInfo.map((t: { id: string; name: string }) => [t.id, t.name]))
    const tenantNameById = new Map(tenantsMeta.map((t: { id: string; name: string }) => [t.id, t.name]))
    const leagueNameById = new Map(leaguesMeta.map((l: { id: string; name: string }) => [l.id, l.name]))

    const teamStaffMap = new Map<string, boolean>()
    for (const teamId of new Set<string>(teamPollRows.map((p) => p.teamId))) {
      const membership = await getChatMembership(teamId, userId, isPlatformAdmin)
      teamStaffMap.set(teamId, isPlatformAdmin || (!!membership && membership.role !== "family"))
    }
    const clubStaffMap = new Map<string, boolean>()
    for (const tenantId of new Set<string>(clubPollRows.map((p) => p.tenantId))) {
      clubStaffMap.set(tenantId, await canManageClubPolls(userId, tenantId, isPlatformAdmin))
    }
    const leagueStaffMap = new Map<string, boolean>()
    for (const leagueId of new Set<string>(leaguePollRows.map((p) => p.leagueId))) {
      leagueStaffMap.set(leagueId, await canManageLeaguePolls(userId, leagueId, isPlatformAdmin))
    }

    const items = [
      ...teamPollRows.map((p: any) => ({
        scope: "team" as const,
        scopeId: p.teamId as string,
        scopeName: teamNameById.get(p.teamId) ?? "Team",
        isStaff: teamStaffMap.get(p.teamId) ?? false,
        poll: serializePoll(p, userId, teamStaffMap.get(p.teamId) ?? false),
      })),
      ...clubPollRows.map((p: any) => ({
        scope: "club" as const,
        scopeId: p.tenantId as string,
        scopeName: tenantNameById.get(p.tenantId) ?? "Club",
        isStaff: clubStaffMap.get(p.tenantId) ?? false,
        poll: serializePoll(p, userId, clubStaffMap.get(p.tenantId) ?? false),
      })),
      ...leaguePollRows.map((p: any) => ({
        scope: "league" as const,
        scopeId: p.leagueId as string,
        scopeName: leagueNameById.get(p.leagueId) ?? "League",
        isStaff: leagueStaffMap.get(p.leagueId) ?? false,
        poll: serializePoll(p, userId, leagueStaffMap.get(p.leagueId) ?? false),
      })),
    ].sort((a, b) => new Date(b.poll.createdAt).getTime() - new Date(a.poll.createdAt).getTime())

    return NextResponse.json({ items })
  } catch (error) {
    console.error("Mobile polls error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
