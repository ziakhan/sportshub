import { prisma } from "@youthbasketballhub/db"
import { notify, notifyMany } from "@/lib/notifications"
import { getTeamStaffUserIds } from "@/lib/teams/chat-access"
import { formatPracticeDate } from "@/lib/teams/practices"
import { rsvpKey, type RsvpItemType, type RsvpStatus } from "@/lib/rsvp-shared"

/**
 * RSVP + attendance for calendar items (docs/feature-backlog.md spec).
 * EventRsvp rows are keyed on the PLAYER and reference Practice/Game/
 * TeamEvent by (itemType, itemId) — three tables, no shared parent, so
 * resolution + roster checks happen here instead of a FK.
 */

export interface ResolvedRsvpItem {
  itemType: RsvpItemType
  itemId: string
  /** Teams whose rosters may RSVP (game = both sides; event = all linked). */
  teamIds: string[]
  startAt: Date
  cancelled: boolean
  /** Human label for notifications — "Practice", "Game X vs Y", event title. */
  label: string
}

export async function resolveRsvpItem(
  itemType: RsvpItemType,
  itemId: string
): Promise<ResolvedRsvpItem | null> {
  if (itemType === "PRACTICE") {
    const p = await (prisma as any).practice.findUnique({
      where: { id: itemId },
      select: { id: true, teamId: true, scheduledAt: true, status: true },
    })
    if (!p) return null
    return {
      itemType,
      itemId,
      teamIds: [p.teamId],
      startAt: p.scheduledAt,
      cancelled: p.status === "CANCELLED",
      label: "Practice",
    }
  }
  if (itemType === "GAME") {
    const g = await (prisma as any).game.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        scheduledAt: true,
        status: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    })
    if (!g) return null
    return {
      itemType,
      itemId,
      teamIds: [g.homeTeamId, g.awayTeamId],
      startAt: g.scheduledAt,
      cancelled: g.status === "CANCELLED" || g.status === "POSTPONED",
      label: `Game — ${g.homeTeam.name} vs ${g.awayTeam.name}`,
    }
  }
  const e = await (prisma as any).teamEvent.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      title: true,
      startAt: true,
      status: true,
      teams: { select: { teamId: true } },
    },
  })
  if (!e) return null
  return {
    itemType,
    itemId,
    teamIds: e.teams.map((t: { teamId: string }) => t.teamId),
    startAt: e.startAt,
    cancelled: e.status === "CANCELLED",
    label: e.title,
  }
}

export interface RsvpEntry {
  playerId: string
  status: RsvpStatus
  note: string | null
}

/**
 * RSVPs for a batch of calendar items, restricted to the given players
 * (a team's roster for staff roll-ups; the viewer's own kids for families).
 * Returns { "PRACTICE:<id>": { "<playerId>": { status, note } } }.
 */
export async function getRsvpsForItems(
  items: Array<{ itemType: RsvpItemType; itemId: string }>,
  playerIds: string[]
): Promise<Record<string, Record<string, { status: RsvpStatus; note: string | null }>>> {
  if (items.length === 0 || playerIds.length === 0) return {}
  const byType = new Map<RsvpItemType, string[]>()
  for (const item of items) {
    byType.set(item.itemType, [...(byType.get(item.itemType) ?? []), item.itemId])
  }
  const rows = await (prisma as any).eventRsvp.findMany({
    where: {
      playerId: { in: playerIds },
      OR: [...byType.entries()].map(([itemType, ids]) => ({
        itemType,
        itemId: { in: ids },
      })),
    },
    select: { playerId: true, itemType: true, itemId: true, status: true, note: true },
  })
  const out: Record<string, Record<string, { status: RsvpStatus; note: string | null }>> = {}
  for (const r of rows) {
    const key = rsvpKey(r.itemType, r.itemId)
    ;(out[key] ??= {})[r.playerId] = { status: r.status, note: r.note ?? null }
  }
  return out
}

/** Player ids on this game's two rosters who RSVP'd Not going — the
 * scoring console pre-marks them absent in the roll call (coach can undo). */
export async function getGameRsvpAbsentees(gameId: string): Promise<Set<string>> {
  const rows = await (prisma as any).eventRsvp.findMany({
    where: { itemType: "GAME", itemId: gameId, status: "NOT_GOING" },
    select: { playerId: true },
  })
  return new Set(rows.map((r: { playerId: string }) => r.playerId))
}

/** Staff get a heads-up when a family flips to Not going this close to start. */
const LATE_CHANGE_WINDOW_MS = 48 * 3_600_000

export async function notifyStaffOfLateNotGoing(opts: {
  item: ResolvedRsvpItem
  playerTeamId: string
  playerName: string
  respondedById: string
  note: string | null
}): Promise<void> {
  const { item } = opts
  if (item.startAt.getTime() - Date.now() > LATE_CHANGE_WINDOW_MS) return
  const team = await prisma.team.findUnique({
    where: { id: opts.playerTeamId },
    select: { tenantId: true },
  })
  if (!team) return
  const staffIds = await getTeamStaffUserIds(opts.playerTeamId, team.tenantId)
  staffIds.delete(opts.respondedById)
  const when = formatPracticeDate(item.startAt)
  await notifyMany(prisma, [...staffIds], {
    type: "rsvp_change",
    title: `${opts.playerName} is out — ${item.label}`,
    message: `${when}${opts.note ? ` · "${opts.note}"` : ""}`,
    link: `/teams/${opts.playerTeamId}/calendar`,
    referenceId: rsvpKey(item.itemType, item.itemId),
    referenceType: "EventRsvp",
  })
}

/** How far ahead the daily reminder cron looks for unanswered items. */
const REMINDER_HORIZON_MS = 72 * 3_600_000

/**
 * RSVP reminders (daily cron): for every upcoming practice/game/team event
 * in the next 3 days, bell+push each family that still has an unanswered
 * rostered player. One reminder per parent per item — an existing
 * rsvp_reminder notification for the same (user, item) is the dedupe,
 * mirroring payment-reminders.
 */
export async function sendRsvpReminders(now = new Date()): Promise<{ reminded: number }> {
  const horizon = new Date(now.getTime() + REMINDER_HORIZON_MS)
  const window = { gte: now, lte: horizon }

  const [practices, games, teamEvents] = await Promise.all([
    (prisma as any).practice.findMany({
      where: { scheduledAt: window, status: "SCHEDULED" },
      select: { id: true, teamId: true, scheduledAt: true },
      take: 500,
    }),
    (prisma as any).game.findMany({
      where: { scheduledAt: window, status: "SCHEDULED" },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        scheduledAt: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
      take: 500,
    }),
    (prisma as any).teamEvent.findMany({
      where: { startAt: window, status: "SCHEDULED" },
      select: { id: true, title: true, startAt: true, teams: { select: { teamId: true } } },
      take: 500,
    }),
  ])

  type Target = {
    itemType: RsvpItemType
    itemId: string
    teamId: string
    startAt: Date
    label: string
  }
  const targets: Target[] = [
    ...practices.map((p: any) => ({
      itemType: "PRACTICE" as const,
      itemId: p.id,
      teamId: p.teamId,
      startAt: p.scheduledAt,
      label: "Practice",
    })),
    ...games.flatMap((g: any) =>
      [g.homeTeamId, g.awayTeamId].map((teamId) => ({
        itemType: "GAME" as const,
        itemId: g.id,
        teamId,
        startAt: g.scheduledAt,
        label: `Game — ${g.homeTeam.name} vs ${g.awayTeam.name}`,
      }))
    ),
    ...teamEvents.flatMap((e: any) =>
      e.teams.map((t: { teamId: string }) => ({
        itemType: "TEAM_EVENT" as const,
        itemId: e.id,
        teamId: t.teamId,
        startAt: e.startAt,
        label: e.title,
      }))
    ),
  ]

  let reminded = 0
  for (const target of targets) {
    const roster = await prisma.teamPlayer.findMany({
      where: { teamId: target.teamId, status: "ACTIVE", player: { deletedAt: null } },
      select: {
        playerId: true,
        player: { select: { firstName: true, parentId: true } },
      },
    })
    if (roster.length === 0) continue

    const answered = await (prisma as any).eventRsvp.findMany({
      where: {
        itemType: target.itemType,
        itemId: target.itemId,
        playerId: { in: roster.map((r: any) => r.playerId) },
      },
      select: { playerId: true },
    })
    const answeredIds = new Set(answered.map((a: { playerId: string }) => a.playerId))

    // Parent -> first names of their still-unanswered kids on this roster
    const pendingByParent = new Map<string, string[]>()
    for (const entry of roster) {
      if (answeredIds.has(entry.playerId)) continue
      const names = pendingByParent.get(entry.player.parentId) ?? []
      names.push(entry.player.firstName)
      pendingByParent.set(entry.player.parentId, names)
    }
    if (pendingByParent.size === 0) continue

    const referenceId = rsvpKey(target.itemType, target.itemId)
    const when = formatPracticeDate(target.startAt)
    for (const [parentId, names] of pendingByParent) {
      const already = await prisma.notification.findFirst({
        where: { userId: parentId, type: "rsvp_reminder", referenceId },
        select: { id: true },
      })
      if (already) continue
      await notify(prisma, {
        userId: parentId,
        type: "rsvp_reminder",
        title: `RSVP — ${target.label}`,
        message: `${when} · Going or not? Answer for ${names.join(" & ")} on the team calendar.`,
        link: `/teams/${target.teamId}/calendar`,
        referenceId,
        referenceType: "EventRsvp",
      })
      reminded++
    }
  }
  return { reminded }
}
