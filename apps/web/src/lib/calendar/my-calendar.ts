import { prisma } from "@youthbasketballhub/db"
import type { RsvpStatus } from "@/lib/rsvp-shared"
import { getRsvpsForItems } from "@/lib/rsvp"

/**
 * My Calendar (docs/roadmap/my-calendar-plan.md) — ONE cross-team feed per
 * user: every practice, game and team event for every team they touch,
 * family side (their kids' teams — 13+ self-players are their own parent,
 * so a player login sees their own schedule) and staff side (teams they
 * coach/manage, tenant-wide for club owners). Same membership set as the
 * personal iCal feed.
 */

export interface MyCalendarTeam {
  teamId: string
  teamName: string
  clubName: string
  /** Which UI this team gets on an item: RSVP buttons, roll-up, or both. */
  family: boolean
  staff: boolean
}

/**
 * A lens = ONE of the person's calendars (owner model 2026-07-11): a kid on
 * a team ("Miles · Lords Gr 9"), a team they coach ("Coaching · Force Gr
 * 10"), or a league they referee in. The UI colors and toggles by lens.
 */
export interface MyCalendarLens {
  key: string // fam:<playerId>:<teamId> | staff:<teamId> | ref:<leagueId>
  kind: "family" | "staff" | "referee"
  label: string
  teamId?: string
  playerId?: string
  leagueId?: string
}

export interface MyCalendarItem {
  kind: "practice" | "game" | "event"
  id: string
  /** The viewer's member teams this item belongs to (0..n; 0 = referee-only). */
  teamIds: string[]
  /** Which of the viewer's calendars (lenses) this item belongs to. */
  lensKeys: string[]
  at: Date
  durationMinutes: number
  status: string
  title: string
  location: string | null
  detail: string | null
}

export interface MyCalendarPayload {
  teams: MyCalendarTeam[]
  lenses: MyCalendarLens[]
  items: MyCalendarItem[]
  rsvp: {
    /** Family side: my players per team. */
    playersByTeam: Record<string, Array<{ id: string; name: string }>>
    /** Staff side: full active roster per team (for roll-ups). */
    rosterByTeam: Record<string, Array<{ id: string; name: string }>>
    byItem: Record<string, Record<string, { status: RsvpStatus; note: string | null }>>
  }
}

const fullName = (p: { firstName: string; lastName: string }) =>
  `${p.firstName} ${p.lastName}`.trim()

export async function getMyCalendar(userId: string): Promise<MyCalendarPayload> {
  const [roles, familyEntries, refereeRoles] = await Promise.all([
    prisma.userRole.findMany({
      where: { userId, role: { in: ["ClubOwner", "ClubManager", "Staff", "TeamManager"] } },
      select: { role: true, tenantId: true, teamId: true },
    }),
    prisma.teamPlayer.findMany({
      where: { status: "ACTIVE", player: { parentId: userId, deletedAt: null } },
      select: {
        teamId: true,
        playerId: true,
        player: { select: { firstName: true, lastName: true } },
      },
    }),
    // Referee lens: games this user is assigned to officiate (per-game roles)
    prisma.userRole.findMany({
      where: { userId, role: "Referee", gameId: { not: null } },
      select: { gameId: true },
    }),
  ])

  const staffTeamIds = new Set<string>(
    roles
      .filter((r: any) => (r.role === "Staff" || r.role === "TeamManager") && r.teamId)
      .map((r: any) => r.teamId as string)
  )
  const ownerTenantIds = roles
    .filter((r: any) => (r.role === "ClubOwner" || r.role === "ClubManager") && r.tenantId)
    .map((r: any) => r.tenantId as string)
  if (ownerTenantIds.length > 0) {
    const clubTeams = await prisma.team.findMany({
      where: { tenantId: { in: ownerTenantIds } },
      select: { id: true },
    })
    for (const t of clubTeams) staffTeamIds.add(t.id)
  }

  const familyTeamIds = new Set(familyEntries.map((e: any) => e.teamId))
  const allTeamIds = [...new Set([...staffTeamIds, ...familyTeamIds])]
  const refGameIds = [...new Set(refereeRoles.map((r: any) => r.gameId as string))]
  if (allTeamIds.length === 0 && refGameIds.length === 0) {
    return {
      teams: [],
      lenses: [],
      items: [],
      rsvp: { playersByTeam: {}, rosterByTeam: {}, byItem: {} },
    }
  }

  const now = Date.now()
  const from = new Date(now - 7 * 86_400_000)
  const to = new Date(now + 70 * 86_400_000)

  const [teams, practices, games, teamEvents, staffRoster] = await Promise.all([
    prisma.team.findMany({
      where: { id: { in: allTeamIds } },
      select: { id: true, name: true, tenant: { select: { name: true } } },
    }),
    (prisma as any).practice.findMany({
      where: { teamId: { in: allTeamIds }, scheduledAt: { gte: from, lte: to } },
      select: {
        id: true,
        teamId: true,
        scheduledAt: true,
        duration: true,
        location: true,
        notes: true,
        status: true,
        venue: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    (prisma as any).game.findMany({
      where: {
        OR: [
          { homeTeamId: { in: allTeamIds } },
          { awayTeamId: { in: allTeamIds } },
          ...(refGameIds.length > 0 ? [{ id: { in: refGameIds } }] : []),
        ],
        scheduledAt: { gte: from, lte: to },
        status: { in: ["SCHEDULED", "LIVE", "COMPLETED"] },
      },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        scheduledAt: true,
        duration: true,
        status: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        venue: { select: { name: true } },
        season: { select: { league: { select: { id: true, name: true } } } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    (prisma as any).teamEvent.findMany({
      where: {
        teams: { some: { teamId: { in: allTeamIds } } },
        startAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        startAt: true,
        durationMinutes: true,
        status: true,
        teams: { select: { teamId: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    staffTeamIds.size > 0
      ? prisma.teamPlayer.findMany({
          where: {
            teamId: { in: [...staffTeamIds] },
            status: "ACTIVE",
            player: { deletedAt: null },
          },
          select: {
            teamId: true,
            playerId: true,
            player: { select: { firstName: true, lastName: true } },
          },
        })
      : Promise.resolve([]),
  ])

  // ---- lenses: the person's individual calendars ----
  const teamName = new Map(teams.map((t: any) => [t.id, t.name]))
  const famLensesByTeam = new Map<string, string[]>()
  const familyLenses: MyCalendarLens[] = familyEntries.map((e: any) => {
    const key = `fam:${e.playerId}:${e.teamId}`
    famLensesByTeam.set(e.teamId, [...(famLensesByTeam.get(e.teamId) ?? []), key])
    return {
      key,
      kind: "family" as const,
      label: `${e.player.firstName} · ${teamName.get(e.teamId) ?? "Team"}`,
      teamId: e.teamId,
      playerId: e.playerId,
    }
  })
  const staffLenses: MyCalendarLens[] = [...staffTeamIds].map((teamId) => ({
    key: `staff:${teamId}`,
    kind: "staff" as const,
    label: `Coaching · ${teamName.get(teamId) ?? "Team"}`,
    teamId,
  }))
  const refGameIdSet = new Set(refGameIds)
  const refLensByLeague = new Map<string, MyCalendarLens>()
  const refLensKeyByGame = new Map<string, string>()
  for (const g of games as any[]) {
    if (!refGameIdSet.has(g.id)) continue
    const leagueId = g.season?.league?.id ?? "independent"
    const key = `ref:${leagueId}`
    if (!refLensByLeague.has(leagueId)) {
      refLensByLeague.set(leagueId, {
        key,
        kind: "referee",
        label: `Refereeing · ${g.season?.league?.name ?? "Assigned games"}`,
        leagueId,
      })
    }
    refLensKeyByGame.set(g.id, key)
  }
  const lenses: MyCalendarLens[] = [
    ...familyLenses.sort((a, b) => a.label.localeCompare(b.label)),
    ...staffLenses.sort((a, b) => a.label.localeCompare(b.label)),
    ...[...refLensByLeague.values()].sort((a, b) => a.label.localeCompare(b.label)),
  ]

  const lensKeysForTeams = (teamIds: string[]) => [
    ...teamIds.flatMap((tid) => famLensesByTeam.get(tid) ?? []),
    ...teamIds.filter((tid) => staffTeamIds.has(tid)).map((tid) => `staff:${tid}`),
  ]

  const items: MyCalendarItem[] = [
    ...practices.map((p: any) => ({
      kind: "practice" as const,
      id: p.id,
      teamIds: [p.teamId],
      lensKeys: lensKeysForTeams([p.teamId]),
      at: p.scheduledAt,
      durationMinutes: p.duration,
      status: p.status,
      title: "Practice",
      location: p.venue?.name ?? p.location ?? null,
      detail: p.notes ?? null,
    })),
    ...games.map((g: any) => {
      const memberTeamIds = [g.homeTeamId, g.awayTeamId].filter((id) =>
        allTeamIds.includes(id)
      )
      const refKey = refLensKeyByGame.get(g.id)
      return {
        kind: "game" as const,
        id: g.id,
        teamIds: memberTeamIds,
        lensKeys: [...lensKeysForTeams(memberTeamIds), ...(refKey ? [refKey] : [])],
        at: g.scheduledAt,
        durationMinutes: g.duration,
        status: g.status,
        title: `${g.homeTeam.name} vs ${g.awayTeam.name}`,
        location: g.venue?.name ?? null,
        detail:
          g.status === "COMPLETED" && g.homeScore != null && g.awayScore != null
            ? `Final ${g.homeScore}–${g.awayScore}`
            : g.status === "LIVE"
              ? "Live now"
              : null,
      }
    }),
    ...teamEvents.map((e: any) => {
      const memberTeamIds = e.teams
        .map((t: { teamId: string }) => t.teamId)
        .filter((id: string) => allTeamIds.includes(id))
      return {
        kind: "event" as const,
        id: e.id,
        teamIds: memberTeamIds,
        lensKeys: lensKeysForTeams(memberTeamIds),
        at: e.startAt,
        durationMinutes: e.durationMinutes,
        status: e.status,
        title: e.title,
        location: e.location ?? null,
        detail: e.description ?? null,
      }
    }),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  const playersByTeam: MyCalendarPayload["rsvp"]["playersByTeam"] = {}
  for (const entry of familyEntries) {
    ;(playersByTeam[entry.teamId] ??= []).push({
      id: entry.playerId,
      name: fullName(entry.player),
    })
  }
  const rosterByTeam: MyCalendarPayload["rsvp"]["rosterByTeam"] = {}
  for (const entry of staffRoster as any[]) {
    ;(rosterByTeam[entry.teamId] ??= []).push({
      id: entry.playerId,
      name: fullName(entry.player),
    })
  }

  const relevantPlayerIds = [
    ...new Set([
      ...familyEntries.map((e: any) => e.playerId),
      ...(staffRoster as any[]).map((e) => e.playerId),
    ]),
  ]
  const byItem = await getRsvpsForItems(
    items.map((i) => ({
      itemType: i.kind === "practice" ? "PRACTICE" : i.kind === "game" ? "GAME" : "TEAM_EVENT",
      itemId: i.id,
    })),
    relevantPlayerIds
  )

  return {
    teams: teams.map((t: any) => ({
      teamId: t.id,
      teamName: t.name,
      clubName: t.tenant.name,
      family: familyTeamIds.has(t.id),
      staff: staffTeamIds.has(t.id),
    })),
    lenses,
    items,
    rsvp: { playersByTeam, rosterByTeam, byItem },
  }
}
