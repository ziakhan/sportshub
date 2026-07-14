import { prisma } from "@youthbasketballhub/db"
import { getMyCalendar, type MyCalendarItem, type MyCalendarLens } from "@/lib/calendar/my-calendar"
import { getChatTeamSummaries } from "@/lib/teams/chat-access"

/**
 * The shared "my contexts" resolver (site-ia-plan §5.6.2): one place that
 * answers "who is this person, entity-graph-wise, and what needs them?".
 * Feeds the Home personal band, badge menu, bottom tabs and /messages so
 * those surfaces can never disagree. Roles grant capabilities; THIS drives
 * navigation.
 */

export interface MyContexts {
  /** Kids I parent (with their team names) — family lens. */
  kids: Array<{ playerId: string; name: string }>
  /** Teams I coach/manage, ordered by next upcoming event (soonest first). */
  coachTeams: Array<{ teamId: string; name: string; clubName: string | null; nextEventAt: Date | null }>
  /** Games I'm assigned to referee (upcoming count). */
  refereeGames: number
  operator: { isClubStaff: boolean; isLeagueOwner: boolean; isPlatformAdmin: boolean }
  /** Next 7 days across every lens, soonest first, with lens chips. */
  weekEvents: Array<{
    item: MyCalendarItem
    chips: string[] // lens labels (kid name / team name / "Refereeing")
    /** Family items only: my players still un-RSVP'd on this item. */
    awaitingRsvp: string[]
  }>
  lenses: MyCalendarLens[]
  actionsDue: {
    openOffers: Array<{ id: string; teamName: string; playerName: string }>
    paymentsDue: number
    rsvpsNeeded: number
    unreadChats: number
  }
  isParticipant: boolean
}

export async function getMyContexts(userId: string): Promise<MyContexts> {
  const [calendar, chatTeams, roles, openOffersRaw, paymentsDue] = await Promise.all([
    getMyCalendar(userId),
    getChatTeamSummaries(userId).catch(() => [] as Array<{ unread: number }>),
    prisma.userRole.findMany({
      where: { userId },
      select: { role: true, teamId: true, tenantId: true },
    }),
    prisma.offer.findMany({
      where: { status: "PENDING", player: { parentId: userId, deletedAt: null } },
      select: {
        id: true,
        player: { select: { firstName: true, lastName: true } },
        team: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    prisma.paymentObligation.count({
      where: { status: { in: ["PENDING", "PARTIALLY_PAID"] }, payerUserId: userId },
    }),
  ])

  const roleNames = new Set(roles.map((r: any) => r.role as string))
  const operator = {
    isClubStaff: roleNames.has("ClubOwner") || roleNames.has("ClubManager"),
    isLeagueOwner: roleNames.has("LeagueOwner"),
    isPlatformAdmin: roleNames.has("PlatformAdmin"),
  }

  // Kids from the family lenses (lens per kid×team — dedupe by player).
  const kidsById = new Map<string, string>()
  for (const lens of calendar.lenses) {
    if (lens.kind === "family" && lens.playerId) {
      // Lens label is "Kid — Team"; keep the kid part for chips/menus.
      kidsById.set(lens.playerId, lens.label.split(" · ")[0] ?? lens.label)
    }
  }

  const now = Date.now()
  const weekCutoff = now + 7 * 86_400_000
  const upcoming = calendar.items
    .filter((i) => i.at.getTime() >= now - 2 * 3_600_000 && i.at.getTime() <= weekCutoff)
    .sort((a, b) => a.at.getTime() - b.at.getTime())

  const lensByKey = new Map(calendar.lenses.map((l) => [l.key, l]))

  // Coach teams ordered by next event (the "which team did they open the
  // app for" heuristic — next-event-first, per site-ia-plan §5.6.7).
  const staffLenses = calendar.lenses.filter((l) => l.kind === "staff" && l.teamId)
  const nextEventByTeam = new Map<string, Date>()
  for (const item of calendar.items) {
    if (item.at.getTime() < now) continue
    for (const tid of item.teamIds) {
      const cur = nextEventByTeam.get(tid)
      if (!cur || item.at < cur) nextEventByTeam.set(tid, item.at)
    }
  }
  const teamNameById = new Map(calendar.teams.map((t: any) => [t.teamId, t]))
  const coachTeams = staffLenses
    .map((l) => {
      const t: any = teamNameById.get(l.teamId as string)
      return {
        teamId: l.teamId as string,
        name: t?.teamName ?? l.label.split(" · ")[1] ?? l.label,
        clubName: t?.clubName ?? null,
        nextEventAt: nextEventByTeam.get(l.teamId as string) ?? null,
      }
    })
    .sort((a, b) => (a.nextEventAt?.getTime() ?? Infinity) - (b.nextEventAt?.getTime() ?? Infinity))

  // Week events with chips + who still owes an RSVP (family side only).
  let rsvpsNeeded = 0
  const weekEvents = upcoming.slice(0, 12).map((item) => {
    const chips = item.lensKeys
      .map((k) => lensByKey.get(k))
      .filter(Boolean)
      .map((l) =>
        l!.kind === "referee"
          ? "Refereeing"
          : l!.kind === "staff"
            ? (l!.label.split(" · ")[1] ?? l!.label)
            : (l!.label.split(" · ")[0] ?? l!.label)
      )
    const uniqueChips = [...new Set(chips)]

    const awaitingRsvp: string[] = []
    for (const teamId of item.teamIds) {
      const myPlayers = calendar.rsvp.playersByTeam[teamId] ?? []
      for (const p of myPlayers) {
        const st = calendar.rsvp.byItem[item.id]?.[p.id]?.status
        if (!st) awaitingRsvp.push(p.name.split(" ")[0])
      }
    }
    rsvpsNeeded += awaitingRsvp.length > 0 ? 1 : 0
    return { item, chips: uniqueChips, awaitingRsvp: [...new Set(awaitingRsvp)] }
  })

  const unreadChats = (chatTeams as Array<{ unread: number }>).reduce(
    (sum, t) => sum + (t.unread || 0),
    0
  )

  const refereeGames = calendar.lenses.some((l) => l.kind === "referee")
    ? calendar.items.filter((i) => i.lensKeys.some((k) => k.startsWith("ref:")) && i.at.getTime() >= now).length
    : 0

  const kids = [...kidsById].map(([playerId, name]) => ({ playerId, name }))

  return {
    kids,
    coachTeams,
    refereeGames,
    operator,
    weekEvents,
    lenses: calendar.lenses,
    actionsDue: {
      openOffers: openOffersRaw.map((o: any) => ({
        id: o.id,
        teamName: o.team?.name ?? "team",
        playerName: `${o.player.firstName}`,
      })),
      paymentsDue: paymentsDue,
      rsvpsNeeded,
      unreadChats,
    },
    isParticipant:
      kidsById.size > 0 || staffLenses.length > 0 || calendar.lenses.some((l) => l.kind === "referee"),
  }
}
