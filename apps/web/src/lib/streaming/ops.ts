import { prisma } from "@youthbasketballhub/db"
import { dateInTz, wallTimeToUtc } from "@/lib/calendar/timezone"
import { computeStreamState } from "@/lib/queries/game-stream"

/**
 * Live streaming — everything the Streams ops dashboard reads
 * (docs/roadmap/live-streaming-plan.md, "Surfaces" item 5).
 *
 * PARITY LAW: one module per surface. The dashboard's schedule context (what
 * each rig is showing now and next), its placement targets, and its audit
 * trail all come from here, so a second consumer — the scorekeeper's remote
 * view, a native ops screen — reads the same shapes rather than re-deriving
 * them. Channel rows themselves come from GET /api/admin/streams/channels,
 * which is the only place the ingest secrets are served.
 *
 * "Live right now" is NOT re-implemented here: it is computeStreamState from
 * lib/queries/game-stream, the same function the public game page and the
 * take-over guard ask. Two definitions of live would drift, and the drift
 * would show up as a dashboard that says green while families see nothing.
 */

/** How far ahead "up next" is allowed to look when today is already done. */
const LOOKAHEAD_DAYS = 7

export interface StreamOpsGame {
  id: string
  scheduledAt: string
  duration: number
  status: string
  matchup: string
  courtName: string | null
  venueName: string | null
  /** AUTO = the assigner put it here. MANUAL = a human pinned it. */
  source: string
  state: "live" | "upcoming" | "ended" | "none"
}

export interface StreamOpsSchedule {
  channelId: string
  nowPlaying: StreamOpsGame | null
  upNext: StreamOpsGame | null
  /** Games this rig is mapped to for today, finished ones included. */
  todayCount: number
}

export interface StreamOpsCourt {
  id: string
  name: string
  gamesToday: number
  /** The rig sitting here, if any — so the picker can say it out loud. */
  channelName: string | null
}

export interface StreamOpsVenue {
  id: string
  name: string
  city: string | null
  /** Games today at the building itself, on no numbered court. */
  gamesToday: number
  channelName: string | null
  courts: StreamOpsCourt[]
}

export interface StreamOpsAuditEntry {
  id: string
  action: string
  createdAt: string
  actorName: string
  /** One line a person can read without opening anything. */
  summary: string
}

export interface StreamOpsOverview {
  /** Server clock, so the client can age timestamps against the same now. */
  now: string
  schedules: StreamOpsSchedule[]
  venues: StreamOpsVenue[]
  audit: StreamOpsAuditEntry[]
  /** Channel id → the name of whoever last confirmed that rig's placement. */
  placedBy: Record<string, string>
}

/** "Today" in the app timezone, as a UTC half-open range. */
function dayRange(now: Date): { dayStart: Date; dayEnd: Date; lookaheadEnd: Date } {
  const { year, month, day } = dateInTz(now)
  return {
    dayStart: wallTimeToUtc(year, month, day, 0, 0),
    dayEnd: wallTimeToUtc(year, month, day + 1, 0, 0),
    lookaheadEnd: wallTimeToUtc(year, month, day + 1 + LOOKAHEAD_DAYS, 0, 0),
  }
}

function matchupOf(game: {
  homeTeam: { name: string } | null
  awayTeam: { name: string } | null
}): string {
  if (game.homeTeam?.name && game.awayTeam?.name) {
    return `${game.awayTeam.name} at ${game.homeTeam.name}`
  }
  return game.homeTeam?.name ?? game.awayTeam?.name ?? "Game"
}

/**
 * What each rig is showing now and next.
 *
 * Reads today plus a week, because a rig with nothing left today should still
 * say when it is next wanted rather than going blank — the dashboard's job is
 * to tell an operator whether anything needs a human, and "nothing until
 * Saturday" is that answer.
 */
export async function getChannelSchedules(now: Date = new Date()): Promise<StreamOpsSchedule[]> {
  const { dayStart, dayEnd, lookaheadEnd } = dayRange(now)

  const rows = await prisma.gameStream.findMany({
    where: { game: { scheduledAt: { gte: dayStart, lt: lookaheadEnd } } },
    select: {
      channelId: true,
      source: true,
      startedAt: true,
      endedAt: true,
      channel: { select: { status: true, playbackUrl: true } },
      game: {
        select: {
          id: true,
          scheduledAt: true,
          duration: true,
          status: true,
          court: { select: { name: true, venue: { select: { name: true } } } },
          venue: { select: { name: true } },
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
      },
    },
    orderBy: { game: { scheduledAt: "asc" } },
  })

  const byChannel = new Map<string, StreamOpsSchedule>()

  for (const row of rows) {
    const state = computeStreamState(
      {
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        scheduledAt: row.game.scheduledAt,
        duration: row.game.duration,
        gameStatus: row.game.status,
        channelStatus: row.channel.status,
        playbackUrl: row.channel.playbackUrl,
      },
      now
    ).state

    const game: StreamOpsGame = {
      id: row.game.id,
      scheduledAt: row.game.scheduledAt.toISOString(),
      duration: row.game.duration,
      status: row.game.status,
      matchup: matchupOf(row.game),
      courtName: row.game.court?.name ?? null,
      venueName: row.game.venue?.name ?? row.game.court?.venue?.name ?? null,
      source: row.source,
      state,
    }

    const entry = byChannel.get(row.channelId) ?? {
      channelId: row.channelId,
      nowPlaying: null,
      upNext: null,
      todayCount: 0,
    }

    if (row.game.scheduledAt >= dayStart && row.game.scheduledAt < dayEnd) {
      entry.todayCount += 1
    }
    // Rows arrive in kick-off order, so the first of each kind is the right one.
    if (state === "live" && !entry.nowPlaying) entry.nowPlaying = game
    if (state === "upcoming" && !entry.upNext) entry.upNext = game

    byChannel.set(row.channelId, entry)
  }

  return [...byChannel.values()]
}

/**
 * Where a rig can be sent.
 *
 * Buildings with games in the next week, plus wherever a rig is standing right
 * now (so a placement is never un-selectable in its own picker). Everything a
 * human needs to choose correctly rides along: how many games each court has
 * today, and whether another camera is already there.
 */
export async function getPlacementTargets(now: Date = new Date()): Promise<StreamOpsVenue[]> {
  const { dayStart, dayEnd, lookaheadEnd } = dayRange(now)

  const [upcoming, placements] = await Promise.all([
    prisma.game.findMany({
      where: {
        scheduledAt: { gte: dayStart, lt: lookaheadEnd },
        status: { notIn: ["CANCELLED", "POSTPONED"] },
      },
      select: {
        id: true,
        scheduledAt: true,
        courtId: true,
        venueId: true,
        court: { select: { venueId: true } },
      },
    }),
    prisma.streamChannel.findMany({
      where: { status: "ACTIVE" },
      select: { name: true, currentCourtId: true, currentVenueId: true },
    }),
  ])

  const venueIds = new Set<string>()
  for (const game of upcoming) {
    const venueId = game.venueId ?? game.court?.venueId ?? null
    if (venueId) venueIds.add(venueId)
  }
  for (const placement of placements) {
    if (placement.currentVenueId) venueIds.add(placement.currentVenueId)
  }
  const placedCourtIds = placements.map((p) => p.currentCourtId).filter(Boolean) as string[]
  if (placedCourtIds.length > 0) {
    const courts = await prisma.court.findMany({
      where: { id: { in: placedCourtIds } },
      select: { venueId: true },
    })
    for (const court of courts) venueIds.add(court.venueId)
  }

  if (venueIds.size === 0) return []

  const venues = await prisma.venue.findMany({
    where: { id: { in: [...venueIds] } },
    select: {
      id: true,
      name: true,
      city: true,
      courtList: { select: { id: true, name: true, displayOrder: true } },
    },
    orderBy: { name: "asc" },
  })

  const todayByCourt = new Map<string, number>()
  const todayByVenue = new Map<string, number>()
  for (const game of upcoming) {
    if (game.scheduledAt < dayStart || game.scheduledAt >= dayEnd) continue
    if (game.courtId) {
      todayByCourt.set(game.courtId, (todayByCourt.get(game.courtId) ?? 0) + 1)
    } else if (game.venueId) {
      todayByVenue.set(game.venueId, (todayByVenue.get(game.venueId) ?? 0) + 1)
    }
  }

  const channelByCourt = new Map<string, string>()
  const channelByVenue = new Map<string, string>()
  for (const placement of placements) {
    if (placement.currentCourtId) channelByCourt.set(placement.currentCourtId, placement.name)
    if (placement.currentVenueId) channelByVenue.set(placement.currentVenueId, placement.name)
  }

  return venues.map((venue) => ({
    id: venue.id,
    name: venue.name,
    city: venue.city ?? null,
    gamesToday: todayByVenue.get(venue.id) ?? 0,
    channelName: channelByVenue.get(venue.id) ?? null,
    courts: [...venue.courtList]
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
      .map((court) => ({
        id: court.id,
        name: court.name,
        gamesToday: todayByCourt.get(court.id) ?? 0,
        channelName: channelByCourt.get(court.id) ?? null,
      })),
  }))
}

/** The streaming actions the trail records, newest first on the dashboard. */
const STREAM_ACTIONS = [
  "STREAM_CHANNEL_PLACE",
  "STREAM_CHANNEL_DISPLACE",
  "STREAM_TAKEOVER",
  "STREAM_MANUAL_MAP",
  "STREAM_CHANNEL_CREATE",
  "STREAM_CHANNEL_UPDATE",
]

function actorNameOf(user: { firstName: string | null; lastName: string | null; email: string } | null): string {
  if (!user) return "Someone"
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
  return name || user.email
}

/**
 * Recent placements and take-overs, already turned into sentences.
 *
 * The generic audit page (dashboard/admin/audit) prints raw change keys, which
 * is fine when you are looking for anything. Here the reader is asking one
 * question — who moved which camera off what — so the ids are resolved to court
 * and venue names before they leave the server.
 */
export async function getStreamAudit(limit = 20): Promise<StreamOpsAuditEntry[]> {
  const entries = (await prisma.auditLog.findMany({
    where: { action: { in: STREAM_ACTIONS as any } },
    select: {
      id: true,
      action: true,
      resource: true,
      resourceId: true,
      createdAt: true,
      changes: true,
      metadata: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })) as Array<{
    id: string
    action: string
    resource: string
    resourceId: string
    createdAt: Date
    changes: any
    metadata: any
    user: { firstName: string | null; lastName: string | null; email: string } | null
  }>

  // The trail stores ids, because names change and ids do not. Resolve them
  // here so the dashboard reads "Court 2, Central Gym" and not a uuid.
  const courtIds = new Set<string>()
  const venueIds = new Set<string>()
  for (const entry of entries) {
    const to = entry.changes?.courtId?.to
    const from = entry.changes?.courtId?.from
    if (typeof to === "string") courtIds.add(to)
    if (typeof from === "string") courtIds.add(from)
    const vTo = entry.changes?.venueId?.to
    const vFrom = entry.changes?.venueId?.from
    if (typeof vTo === "string") venueIds.add(vTo)
    if (typeof vFrom === "string") venueIds.add(vFrom)
  }

  // STREAM_CHANNEL_UPDATE stores which FIELDS moved and never their values
  // (two of them are secrets), so the camera's name has to come from the row
  // the entry points at.
  const channelIds = [
    ...new Set(entries.filter((e) => e.resource === "StreamChannel").map((e) => e.resourceId)),
  ]
  const namedChannels = channelIds.length
    ? await prisma.streamChannel.findMany({
        where: { id: { in: channelIds } },
        select: { id: true, name: true },
      })
    : []
  const channelName = new Map(namedChannels.map((c) => [c.id, c.name]))

  const [courts, venues] = await Promise.all([
    courtIds.size
      ? prisma.court.findMany({
          where: { id: { in: [...courtIds] } },
          select: { id: true, name: true, venue: { select: { name: true } } },
        })
      : Promise.resolve([]),
    venueIds.size
      ? prisma.venue.findMany({
          where: { id: { in: [...venueIds] } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ])
  const courtLabel = new Map(courts.map((c) => [c.id, `${c.name}, ${c.venue.name}`]))
  const venueLabel = new Map(venues.map((v) => [v.id, v.name]))

  function place(entry: (typeof entries)[number]): string {
    const channel = entry.metadata?.channelName ?? channelName.get(entry.resourceId) ?? "A camera"
    const toCourt = entry.changes?.courtId?.to
    const toVenue = entry.changes?.venueId?.to
    const where =
      (typeof toCourt === "string" ? courtLabel.get(toCourt) : null) ??
      (typeof toVenue === "string" ? venueLabel.get(toVenue) : null) ??
      "a new spot"
    const mapped = Array.isArray(entry.metadata?.mapped) ? entry.metadata.mapped.length : 0
    const unmapped = Array.isArray(entry.metadata?.unmapped) ? entry.metadata.unmapped.length : 0
    const tail =
      mapped || unmapped
        ? ` Now showing ${mapped} ${mapped === 1 ? "game" : "games"}${unmapped ? `, dropped ${unmapped}` : ""}.`
        : ""
    return `${channel} placed at ${where}.${tail}`
  }

  function takeover(entry: (typeof entries)[number]): string {
    const channel = entry.metadata?.channelName ?? channelName.get(entry.resourceId) ?? "A camera"
    const where = entry.metadata?.courtName
      ? `${entry.metadata.courtName}${entry.metadata.venueName ? `, ${entry.metadata.venueName}` : ""}`
      : (entry.metadata?.venueName ?? "another court")
    const matchup = entry.metadata?.matchup ? ` (${entry.metadata.matchup})` : ""
    return `${channel} was taken off the live game at ${where}${matchup}.`
  }

  /**
   * The other half of a placement: a floor holds one camera, so the rig that
   * was standing there was pushed off it. Says who replaced it, because that
   * is the only question a reader has when a camera stops covering its games.
   */
  function displace(entry: (typeof entries)[number]): string {
    const channel = entry.metadata?.channelName ?? channelName.get(entry.resourceId) ?? "A camera"
    const from = entry.changes?.courtId?.from
    const fromVenue = entry.changes?.venueId?.from
    const where =
      (typeof from === "string" ? courtLabel.get(from) : null) ??
      (typeof fromVenue === "string" ? venueLabel.get(fromVenue) : null) ??
      "its court"
    const by = entry.metadata?.replacedBy ? ` ${entry.metadata.replacedBy} is there now.` : ""
    const dropped = Array.isArray(entry.metadata?.unmapped) ? entry.metadata.unmapped.length : 0
    const tail = dropped
      ? ` It stopped showing ${dropped} ${dropped === 1 ? "game" : "games"}.`
      : ""
    return `${channel} was moved off ${where}.${by}${tail}`
  }

  return entries.map((entry) => {
    let summary: string
    switch (entry.action) {
      case "STREAM_CHANNEL_PLACE":
        summary = place(entry)
        break
      case "STREAM_CHANNEL_DISPLACE":
        summary = displace(entry)
        break
      case "STREAM_TAKEOVER":
        summary = takeover(entry)
        break
      case "STREAM_MANUAL_MAP":
        summary = `${entry.metadata?.channelName ?? "A camera"} was pinned to one game by hand.`
        break
      case "STREAM_CHANNEL_CREATE":
        summary = `${entry.metadata?.name ?? channelName.get(entry.resourceId) ?? "A camera"} was added${entry.metadata?.provider ? ` on ${entry.metadata.provider}` : ""}.`
        break
      default: {
        const fields = Array.isArray(entry.changes?.fields) ? entry.changes.fields : []
        const status = entry.changes?.status
        const who = channelName.get(entry.resourceId) ?? "A camera"
        summary =
          status && status.from !== status.to
            ? `${who} was ${String(status.to).toLowerCase() === "active" ? "put back in service" : "switched off"}.`
            : `${who} was edited${fields.length ? ` (${fields.join(", ")})` : ""}.`
      }
    }
    return {
      id: entry.id,
      action: entry.action,
      createdAt: entry.createdAt.toISOString(),
      actorName: actorNameOf(entry.user),
      summary,
    }
  })
}

/**
 * Who confirmed each placement.
 *
 * The channel row stores `placedById` and nothing else, on purpose — a name
 * copied onto the row would go stale the day someone marries. Resolving it
 * here keeps the channels endpoint (the secrets door) as narrow as it is.
 */
export async function getPlacedByNames(): Promise<Record<string, string>> {
  const channels = await prisma.streamChannel.findMany({
    where: { placedById: { not: null } },
    select: { id: true, placedById: true },
  })
  const userIds = [...new Set(channels.map((c) => c.placedById).filter(Boolean) as string[])]
  if (userIds.length === 0) return {}

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true, email: true },
  })
  const nameById = new Map(users.map((u) => [u.id, actorNameOf(u)]))

  const out: Record<string, string> = {}
  for (const channel of channels) {
    const name = channel.placedById ? nameById.get(channel.placedById) : null
    if (name) out[channel.id] = name
  }
  return out
}

/** The whole dashboard read, in one round trip. */
export async function getStreamOpsOverview(now: Date = new Date()): Promise<StreamOpsOverview> {
  const [schedules, venues, audit, placedBy] = await Promise.all([
    getChannelSchedules(now),
    getPlacementTargets(now),
    getStreamAudit(),
    getPlacedByNames(),
  ])
  return { now: now.toISOString(), schedules, venues, audit, placedBy }
}
