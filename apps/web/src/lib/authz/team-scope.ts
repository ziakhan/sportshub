// Team-scoped authorization for club staff (security fix 2026-07-20).
//
// Root cause of the coach-leak bug: a coach's Staff UserRole carries BOTH
// tenantId and teamId, so every `{ tenantId, role: { in: [..."Staff"] } }`
// check matched a one-team coach CLUB-WIDE. The rule going forward:
//   - ClubOwner / ClubManager (or PlatformAdmin): club-wide, unchanged.
//   - Staff / TeamManager: only the team(s) their role rows actually
//     reference via teamId. A tenant-level Staff row with teamId null makes
//     the person assignable in the staff pool; it grants NO team authority.
// Owner rulings preserved: coaches keep tryout-posting, roster-finalizing,
// offer-sending powers (2026-07-07 "the circle that runs the team") — scoped
// to their own team.

import { prisma } from "@youthbasketballhub/db"

/**
 * ClubOwner/ClubManager at the tenant, or PlatformAdmin. Trainer counts too:
 * a TRAINER tenant is a one-person org and its Trainer role IS the admin
 * (batch-backlog §5) — Trainer roles only ever exist on trainer tenants.
 */
export async function isClubAdmin(userId: string, tenantId: string): Promise<boolean> {
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      OR: [
        { tenantId, role: { in: ["ClubOwner", "ClubManager", "Trainer"] as any } },
        { role: "PlatformAdmin" as any },
      ],
    },
    select: { id: true },
  })
  return !!role
}

/** Teams at this tenant where the user holds a team-scoped Staff/TeamManager role. */
export async function coachedTeamIds(userId: string, tenantId: string): Promise<string[]> {
  const roles = await prisma.userRole.findMany({
    where: {
      userId,
      tenantId,
      teamId: { not: null },
      role: { in: ["Staff", "TeamManager"] as any },
    },
    select: { teamId: true },
  })
  return Array.from(new Set(roles.map((r) => r.teamId).filter(Boolean))) as string[]
}

/** Coached teams with names (for the club layout's coach nav). */
export async function coachedTeams(
  userId: string,
  tenantId: string
): Promise<{ id: string; name: string }[]> {
  const ids = await coachedTeamIds(userId, tenantId)
  if (ids.length === 0) return []
  const teams = await prisma.team.findMany({
    where: { id: { in: ids }, tenantId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return teams
}

/** Most-privileged role label the user holds at this tenant (for audit trails). */
export async function actorRoleAtTenant(userId: string, tenantId: string): Promise<string> {
  const roles = await prisma.userRole.findMany({
    where: { userId, tenantId },
    select: { role: true },
  })
  const names = roles.map((r) => r.role as string)
  for (const preferred of ["ClubOwner", "ClubManager", "Trainer", "TeamManager", "Staff"]) {
    if (names.includes(preferred)) return preferred
  }
  return names[0] ?? "Staff"
}

/**
 * May the user act on this specific team? Club admins always; staff only when
 * one of their role rows points at the team.
 */
export async function canActOnTeam(
  userId: string,
  tenantId: string,
  teamId: string
): Promise<boolean> {
  if (await isClubAdmin(userId, tenantId)) return true
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      tenantId,
      teamId,
      role: { in: ["Staff", "TeamManager"] as any },
    },
    select: { id: true },
  })
  return !!role
}

/**
 * Is this user a "club member" for the given team — any role scoped to the
 * team or its tenant (owner, manager, staff, parent, player), or the
 * parent/self-account of a player rostered on the team. Used to gate
 * club-internal info (e.g. the practice schedule) on the public team page:
 * the whole club is fine, the public never (QA-105).
 */
export async function isTeamMember(
  userId: string,
  tenantId: string,
  teamId: string
): Promise<boolean> {
  const role = await prisma.userRole.findFirst({
    where: { userId, OR: [{ tenantId }, { teamId }] },
    select: { id: true },
  })
  if (role) return true

  const rosterLink = await prisma.teamPlayer.findFirst({
    where: {
      teamId,
      status: "ACTIVE",
      player: { deletedAt: null, OR: [{ parentId: userId }, { userId }] },
    },
    select: { id: true },
  })
  return !!rosterLink
}
