import { prisma } from "@youthbasketballhub/db"
import { sendEmail } from "@/lib/email"
import { notifyMany } from "@/lib/notifications"
import { getChatMembers } from "@/lib/teams/chat-access"

/**
 * Team events domain service (owner ask 2026-07-07): arbitrary calendar
 * entries in the SAME team calendar as practices/games. One event can span
 * multiple teams; the editor circle is anyone with authority over EVERY
 * attached team — club owners/managers, team-scoped Staff/TeamManager, or
 * the owner of a league the team has an approved submission in.
 */

export interface EventTeamRef {
  id: string
  name: string
  tenantId: string
}

/**
 * Which of `teamIds` may this user manage events for? Returns the teams
 * when ALL are covered, or the ids that failed so the API can name them.
 */
export async function authorizeEventTeams(
  userId: string,
  teamIds: string[],
  isPlatformAdmin = false
): Promise<{ ok: true; teams: EventTeamRef[] } | { ok: false; deniedTeamIds: string[] }> {
  const unique = [...new Set(teamIds)]
  const teams = await prisma.team.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, tenantId: true },
  })
  if (teams.length !== unique.length) {
    const found = new Set(teams.map((t: EventTeamRef) => t.id))
    return { ok: false, deniedTeamIds: unique.filter((id) => !found.has(id)) }
  }
  if (isPlatformAdmin) return { ok: true, teams }

  const roles = await prisma.userRole.findMany({
    where: {
      userId,
      role: { in: ["ClubOwner", "ClubManager", "Staff", "TeamManager"] },
    },
    select: { role: true, tenantId: true, teamId: true },
  })
  const clubTenants = new Set(
    roles
      .filter((r: any) => r.role === "ClubOwner" || r.role === "ClubManager")
      .map((r: any) => r.tenantId)
  )
  const scopedTeams = new Set(
    roles
      .filter((r: any) => (r.role === "Staff" || r.role === "TeamManager") && r.teamId)
      .map((r: any) => r.teamId)
  )

  const uncovered = teams.filter(
    (t: EventTeamRef) => !clubTenants.has(t.tenantId) && !scopedTeams.has(t.id)
  )
  if (uncovered.length > 0) {
    // League scope: owner of a league with an APPROVED submission for the team
    const viaLeague = await prisma.teamSubmission.findMany({
      where: {
        teamId: { in: uncovered.map((t) => t.id) },
        status: "APPROVED",
        season: { league: { ownerId: userId } },
      },
      select: { teamId: true },
    })
    const leagueCovered = new Set(viaLeague.map((s: { teamId: string }) => s.teamId))
    const denied = uncovered.filter((t) => !leagueCovered.has(t.id))
    if (denied.length > 0) return { ok: false, deniedTeamIds: denied.map((t) => t.id) }
  }
  return { ok: true, teams }
}

export const eventInclude = {
  teams: { select: { team: { select: { id: true, name: true } } } },
  createdBy: { select: { firstName: true, lastName: true } },
}

export function serializeEvent(event: any) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startAt: event.startAt,
    durationMinutes: event.durationMinutes,
    status: event.status,
    teams: event.teams.map((l: any) => ({ id: l.team.id, name: l.team.name })),
    createdBy: [event.createdBy.firstName, event.createdBy.lastName].filter(Boolean).join(" "),
  }
}

/**
 * Bell + email every attached team's circle, deduped across teams (a club
 * owner pushing photo day to 6 teams must not bell a two-team coach twice).
 */
export async function notifyEventTeams(opts: {
  teams: EventTeamRef[]
  excludeUserId: string
  title: string
  message: string
  emailSubject: string
  emailHtml: (calendarLink: string) => string
  referenceId: string
}): Promise<number> {
  const linkByUser = new Map<string, string>() // first team's calendar wins
  for (const team of opts.teams) {
    const members = await getChatMembers(team.id, team.tenantId)
    for (const userId of members.userIds) {
      if (userId === opts.excludeUserId) continue
      if (!linkByUser.has(userId)) linkByUser.set(userId, `/teams/${team.id}/calendar`)
    }
  }
  if (linkByUser.size === 0) return 0

  // One bell per user; link goes to a calendar that shows the event
  const byLink = new Map<string, string[]>()
  for (const [userId, link] of linkByUser) {
    byLink.set(link, [...(byLink.get(link) ?? []), userId])
  }
  for (const [link, userIds] of byLink) {
    await notifyMany(prisma, userIds, {
      type: "team_event",
      title: opts.title,
      message: opts.message,
      link,
      referenceId: opts.referenceId,
      referenceType: "TeamEvent",
    })
  }

  const users = await prisma.user.findMany({
    where: { id: { in: [...linkByUser.keys()] } },
    select: { id: true, email: true },
  })
  const appUrl = process.env.NEXTAUTH_URL || ""
  await Promise.allSettled(
    users.map((u: { id: string; email: string }) =>
      sendEmail({
        to: u.email,
        subject: opts.emailSubject,
        html: opts.emailHtml(`${appUrl}${linkByUser.get(u.id)}`),
      })
    )
  )
  return linkByUser.size
}

export function formatEventDate(startAt: Date | string): string {
  const date = new Date(startAt)
  return date.toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: process.env.APP_TIMEZONE || "America/Toronto",
  })
}
