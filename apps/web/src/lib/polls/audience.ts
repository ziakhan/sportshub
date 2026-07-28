import { prisma } from "@youthbasketballhub/db"
import { getChatMembership } from "@/lib/teams/chat-access"

/**
 * Poll audience helpers — three-tier polls ruling (owner 2026-07-24). A poll
 * has exactly one scope (teamId / tenantId / leagueId); each scope has its
 * own "who's the audience" rule, reused by the vote + list APIs so every
 * scope enforces the same viewer/creator boundary.
 */

export interface PollScopeIds {
  teamId: string | null
  tenantId: string | null
  leagueId: string | null
}

/**
 * Club-wide audience: everyone with a role at the tenant, plus parents of
 * an ACTIVE rostered player on any of the tenant's teams — the exact
 * cascade `api/clubs/[id]/announcements` uses for its bell fanout.
 */
export async function isClubPollAudience(userId: string, tenantId: string): Promise<boolean> {
  const role = await prisma.userRole.findFirst({ where: { userId, tenantId }, select: { id: true } })
  if (role) return true

  const rostered = await (prisma as any).teamPlayer.findFirst({
    where: {
      team: { tenantId },
      status: "ACTIVE",
      player: { parentId: userId, deletedAt: null },
    },
    select: { id: true },
  })
  return !!rostered
}

/** Every user id in a club's poll audience — used for the create-time bell fanout. */
export async function clubPollAudienceUserIds(tenantId: string): Promise<string[]> {
  const [roleHolders, rosterSpots] = await Promise.all([
    prisma.userRole.findMany({ where: { tenantId }, select: { userId: true } }),
    (prisma as any).teamPlayer.findMany({
      where: { team: { tenantId }, status: "ACTIVE", player: { deletedAt: null } },
      select: { player: { select: { parentId: true } } },
    }),
  ])
  const audience = new Set<string>()
  for (const r of roleHolders) audience.add(r.userId)
  for (const tp of rosterSpots as Array<{ player: { parentId: string | null } | null }>) {
    if (tp.player?.parentId) audience.add(tp.player.parentId)
  }
  return [...audience]
}

/**
 * League-wide audience: the league owner + anyone with a league-scoped role,
 * plus every team with an APPROVED submission into one of the league's
 * seasons — their club admins, team staff, and rostered families. Mirrors
 * the fan-out `seasons/[id]/schedule/commit` uses for `schedule_published`.
 */
export async function isLeaguePollAudience(userId: string, leagueId: string): Promise<boolean> {
  const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { ownerId: true } })
  if (!league) return false
  if (league.ownerId === userId) return true

  const opRole = await prisma.userRole.findFirst({ where: { userId, leagueId }, select: { id: true } })
  if (opRole) return true

  const teamRole = await prisma.userRole.findFirst({
    where: {
      userId,
      OR: [
        {
          role: { in: ["ClubOwner", "ClubManager"] },
          tenant: { teams: { some: { seasonSubmissions: { some: { status: "APPROVED", season: { leagueId } } } } } },
        },
        {
          role: { in: ["Staff", "TeamManager"] },
          team: { seasonSubmissions: { some: { status: "APPROVED", season: { leagueId } } } },
        },
      ],
    },
    select: { id: true },
  })
  if (teamRole) return true

  const rostered = await (prisma as any).teamPlayer.findFirst({
    where: {
      status: "ACTIVE",
      player: { parentId: userId, deletedAt: null },
      team: { seasonSubmissions: { some: { status: "APPROVED", season: { leagueId } } } },
    },
    select: { id: true },
  })
  return !!rostered
}

/** Every user id in a league's poll audience — used for the create-time bell fanout. */
export async function leaguePollAudienceUserIds(leagueId: string): Promise<string[]> {
  const [league, opRoles] = await Promise.all([
    prisma.league.findUnique({ where: { id: leagueId }, select: { ownerId: true } }),
    prisma.userRole.findMany({ where: { leagueId }, select: { userId: true } }),
  ])
  const submissions: Array<{ teamId: string; team: { tenantId: string } }> = await (
    prisma as any
  ).teamSubmission.findMany({
    where: { status: "APPROVED", season: { leagueId } },
    select: { teamId: true, team: { select: { tenantId: true } } },
  })

  const audience = new Set<string>()
  if (league?.ownerId) audience.add(league.ownerId)
  for (const r of opRoles) audience.add(r.userId)

  const teamIds = [...new Set(submissions.map((s: { teamId: string }) => s.teamId))]
  const tenantIds = [
    ...new Set(submissions.map((s: { team: { tenantId: string } }) => s.team.tenantId)),
  ]
  if (teamIds.length > 0) {
    const [staffRoles, rosterSpots] = await Promise.all([
      prisma.userRole.findMany({
        where: {
          OR: [
            { role: { in: ["ClubOwner", "ClubManager"] }, tenantId: { in: tenantIds } },
            { role: { in: ["Staff", "TeamManager"] }, teamId: { in: teamIds } },
          ],
        },
        select: { userId: true },
      }),
      (prisma as any).teamPlayer.findMany({
        where: { teamId: { in: teamIds }, status: "ACTIVE", player: { deletedAt: null } },
        select: { player: { select: { parentId: true } } },
      }),
    ])
    for (const r of staffRoles) audience.add(r.userId)
    for (const tp of rosterSpots as Array<{ player: { parentId: string | null } | null }>) {
      if (tp.player?.parentId) audience.add(tp.player.parentId)
    }
  }
  return [...audience]
}

/**
 * May this user see/vote on the poll, based on its scope? Team scope reuses
 * the exact chat-membership check the team polls API already enforces;
 * club/league scope reuse the audience cascades above. PlatformAdmin bypass
 * is the caller's job (matches every other authz helper in this codebase).
 */
export async function canSeePoll(userId: string, poll: PollScopeIds): Promise<boolean> {
  if (poll.teamId) {
    const membership = await getChatMembership(poll.teamId, userId)
    return !!membership
  }
  if (poll.tenantId) return isClubPollAudience(userId, poll.tenantId)
  if (poll.leagueId) return isLeaguePollAudience(userId, poll.leagueId)
  return false
}
