import { redirect } from "next/navigation"
import { prisma } from "@youthbasketballhub/db"
import { getCurrentUser } from "@/lib/auth-helpers"
import { getChatMembership, getMemberTeamIds } from "@/lib/teams/chat-access"
import { pollInclude, serializePoll } from "@/lib/teams/polls"
import { canManageClubPolls, canManageLeaguePolls } from "@/lib/polls/authz"
import { AllPollsClient, type ScopedPollView } from "./all-polls-client"

export const dynamic = "force-dynamic"

/**
 * The findable poll surface (three-tier polls ruling, owner 2026-07-24):
 * every OPEN poll across the viewer's teams, clubs, and leagues. Club/league
 * manage tabs live in the staff-only workspace, so this is the only place a
 * plain family member can see — and vote on — a club or league poll at all.
 */
export default async function PollsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in?callbackUrl=%2Fpolls")

  const isPlatformAdmin = user.roles.some((r: { role: string }) => r.role === "PlatformAdmin")

  const memberTeamIds = [...(await getMemberTeamIds(user.id))]

  const [teamsInfo, directTenantRoles, directLeagueRoles] = await Promise.all([
    memberTeamIds.length > 0
      ? prisma.team.findMany({
          where: { id: { in: memberTeamIds } },
          select: { id: true, name: true, tenantId: true },
        })
      : Promise.resolve([] as any[]),
    prisma.userRole.findMany({
      where: { userId: user.id, tenantId: { not: null } },
      select: { tenantId: true },
    }),
    prisma.userRole.findMany({
      where: { userId: user.id, leagueId: { not: null } },
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

  // The awaited Promise.all tuple mixes typed prisma results with `any`
  // ternary branches; pin each result to `any[]` explicitly rather than
  // rely on TS to unify the branches.
  const teamPollRows = teamPolls as any[]
  const clubPollRows = clubPolls as any[]
  const leaguePollRows = leaguePolls as any[]

  const teamNameById = new Map(teamsInfo.map((t: { id: string; name: string }) => [t.id, t.name]))
  const tenantNameById = new Map(tenantsMeta.map((t: { id: string; name: string }) => [t.id, t.name]))
  const leagueNameById = new Map(leaguesMeta.map((l: { id: string; name: string }) => [l.id, l.name]))

  // Staff flags, computed once per distinct scope instance (never per poll).
  const teamStaffMap = new Map<string, boolean>()
  for (const teamId of new Set<string>(teamPollRows.map((p) => p.teamId))) {
    const membership = await getChatMembership(teamId, user.id, isPlatformAdmin)
    teamStaffMap.set(teamId, isPlatformAdmin || (!!membership && membership.role !== "family"))
  }
  const clubStaffMap = new Map<string, boolean>()
  for (const tenantId of new Set<string>(clubPollRows.map((p) => p.tenantId))) {
    clubStaffMap.set(tenantId, await canManageClubPolls(user.id, tenantId, isPlatformAdmin))
  }
  const leagueStaffMap = new Map<string, boolean>()
  for (const leagueId of new Set<string>(leaguePollRows.map((p) => p.leagueId))) {
    leagueStaffMap.set(leagueId, await canManageLeaguePolls(user.id, leagueId, isPlatformAdmin))
  }

  const items: ScopedPollView[] = [
    ...teamPollRows.map((p: any) => ({
      scope: "team" as const,
      scopeId: p.teamId as string,
      scopeName: teamNameById.get(p.teamId) ?? "Team",
      scopeHref: `/teams/${p.teamId}/polls`,
      isStaff: teamStaffMap.get(p.teamId) ?? false,
      poll: serializePoll(p, user.id, teamStaffMap.get(p.teamId) ?? false),
    })),
    ...clubPollRows.map((p: any) => ({
      scope: "club" as const,
      scopeId: p.tenantId as string,
      scopeName: tenantNameById.get(p.tenantId) ?? "Club",
      scopeHref: `/clubs/${p.tenantId}/polls`,
      isStaff: clubStaffMap.get(p.tenantId) ?? false,
      poll: serializePoll(p, user.id, clubStaffMap.get(p.tenantId) ?? false),
    })),
    ...leaguePollRows.map((p: any) => ({
      scope: "league" as const,
      scopeId: p.leagueId as string,
      scopeName: leagueNameById.get(p.leagueId) ?? "League",
      scopeHref: `/manage/leagues/${p.leagueId}/polls`,
      isStaff: leagueStaffMap.get(p.leagueId) ?? false,
      poll: serializePoll(p, user.id, leagueStaffMap.get(p.leagueId) ?? false),
    })),
  ].sort((a, b) => new Date(b.poll.createdAt).getTime() - new Date(a.poll.createdAt).getTime())

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-ink-900 text-xl font-bold md:text-2xl">Polls</h1>
        <p className="text-ink-500 mt-1 text-sm">
          Open polls from your teams, clubs, and leagues, all in one place.
        </p>
      </div>
      <AllPollsClient initial={items} />
    </div>
  )
}
