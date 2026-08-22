import { prisma } from "@youthbasketballhub/db"
import { audit } from "@/lib/audit"
import { dateInTz, wallTimeToUtc } from "@/lib/calendar/timezone"
import { isStreamWindowOpen } from "@/lib/queries/game-stream"

/**
 * Live streaming — placement and the assigner
 * (docs/roadmap/live-streaming-plan.md, "Assignment mechanics").
 *
 * Three layers, and this file owns the middle two:
 *
 *   Channel   a physical camera rig + its permanent URLs      — never changes
 *   Placement which court/venue that rig sits at RIGHT NOW    — a human sets it
 *   Mapping   which game the stream shows on the site         — derived, here
 *
 * The whole design exists because there are FEWER CAMERAS THAN COURTS: rigs
 * move between courts and buildings across a day, so a permanent court binding
 * (the v1 mistake) is wrong. A human moves the rig and confirms by looking at
 * the picture; everything after that is this module's job.
 *
 * Two rules are absolute:
 *   • MANUAL rows are never touched. They are the escape hatch, and an
 *     assigner that "corrects" them would silently undo a human decision.
 *   • COMPLETED (and otherwise finished) games are never touched. Their row is
 *     the historical record of which channel showed that game — the phase-3
 *     VOD index. Re-pointing it would rewrite history.
 *
 * ── ONE FLOOR, ONE CAMERA (owner defect, 2026-08-22) ──────────────────────
 * Placement used to ACCUMULATE: placing a rig at a court set that rig's
 * columns and said nothing to whoever was already standing there, so two
 * channels could both hold currentCourtId = Court 1 (found in the staging
 * database: "Camera Zia 2" and "Camera-Zia" both claiming it). That is a state
 * that cannot exist in the world. A camera is one physical object standing on
 * one floor, and if the scorekeeper says THIS camera is showing their court,
 * the rig that was there has been carried away or was never there at all.
 *
 * So a placement now MOVES: it un-places every other channel at that spot in
 * the same transaction and releases their AUTO mappings. It is not a warning
 * and not a conflict — the human at the table is looking at the floor and we
 * are not, so their answer wins. The displaced rigs come back in the result
 * and go on the audit trail, because a camera that quietly stopped covering
 * its games needs a name against it.
 */

/** Games whose mapping is settled — the assigner reads past them, never over them. */
const FINISHED_STATUSES = ["COMPLETED", "CANCELLED", "POSTPONED", "DEFAULTED"] as const

/** Repo idiom (lib/clubs/merge-clubs.ts): the interactive transaction client. */
type Tx = any

export class StreamPlacementError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
    /** Machine-readable context — the take-over guard's other game. */
    public details?: unknown
  ) {
    super(message)
    this.name = "StreamPlacementError"
  }
}

/**
 * The other court's live game, handed to the UI so it can name what it is
 * about to interrupt: "Camera B is showing Court 2's live game at Central
 * Gym — take it anyway?"
 */
export interface StreamTakeoverConflict {
  channelId: string
  channelName: string
  gameId: string
  scheduledAt: Date
  courtId: string | null
  courtName: string | null
  venueId: string | null
  venueName: string | null
  matchup: string | null
}

export interface PlaceChannelInput {
  channelId: string
  /** Exactly one of courtId / venueId. A rig sits at one spot at a time. */
  courtId?: string | null
  venueId?: string | null
  /** The real signed-in account doing this (scorekeeper or admin). */
  actorId: string
  actorRole?: string
  /** Confirmed take-over: proceed even though this rig is mid-game elsewhere. */
  force?: boolean
  /** Source request, for IP/user-agent capture on the audit rows. */
  request?: Request
  /** Injectable clock — tests and the nightly assigner pass their own. */
  now?: Date
}

/**
 * A rig that was standing where this one has just been placed, and is now
 * standing nowhere. One floor holds one camera, so this is the ordinary
 * outcome of a correction, not an error — but it is named so the UI can say it
 * out loud and the trail can record it.
 */
export interface StreamDisplacedChannel {
  channelId: string
  channelName: string
  /** Today's unfinished games it stopped covering when it was un-placed. */
  unmapped: string[]
}

export interface PlaceChannelResult {
  channelId: string
  courtId: string | null
  venueId: string | null
  /** Games this channel now shows (today, not yet finished). */
  mapped: string[]
  /** Games it let go of when it moved. */
  unmapped: string[]
  /** Present when `force` overrode a live game on another court. */
  tookOver: StreamTakeoverConflict | null
  /** Rigs pushed off this floor, because a floor holds one camera. */
  displaced: StreamDisplacedChannel[]
}

/** "Today" in the app timezone, as a UTC half-open range. */
function dayRange(when: Date): { dayStart: Date; dayEnd: Date } {
  const { year, month, day } = dateInTz(when)
  return {
    dayStart: wallTimeToUtc(year, month, day, 0, 0),
    // Date.UTC rolls day+1 over month/year ends for us.
    dayEnd: wallTimeToUtc(year, month, day + 1, 0, 0),
  }
}

/** Where a game is played, in the same terms a placement is expressed in. */
function gameMatchesTarget(
  game: { courtId: string | null; venueId: string | null },
  target: { courtId: string | null; venueId: string | null }
): boolean {
  if (target.courtId) return game.courtId === target.courtId
  // A building placement covers the games that name no court — single-court
  // gyms and court-less schedules. Games on a numbered court belong to
  // whichever rig is placed at THAT court.
  return !!target.venueId && game.venueId === target.venueId && game.courtId === null
}

const HELD_GAME_SELECT = {
  id: true,
  scheduledAt: true,
  duration: true,
  status: true,
  courtId: true,
  venueId: true,
  court: { select: { id: true, name: true, venue: { select: { id: true, name: true } } } },
  venue: { select: { id: true, name: true } },
  homeTeam: { select: { name: true } },
  awayTeam: { select: { name: true } },
}

/**
 * Re-derive this channel's mappings for the day: today's not-yet-finished
 * games at its placement become AUTO rows on it, and today's not-yet-finished
 * games it has left behind lose theirs.
 *
 * Both target ids null means the rig is standing NOWHERE (it was just pushed
 * off a floor by another camera). That is a real target, not a missing one: it
 * covers no games, so every AUTO row it holds for today is released.
 *
 * Runs inside the caller's transaction so a half-moved camera is impossible.
 */
async function remapChannel(
  tx: Tx,
  opts: { channelId: string; courtId: string | null; venueId: string | null; now: Date }
): Promise<{ mapped: string[]; unmapped: string[]; created: number; updated: number }> {
  const { dayStart, dayEnd } = dayRange(opts.now)
  const target = { courtId: opts.courtId ?? null, venueId: opts.venueId ?? null }

  const nowhere = !target.courtId && !target.venueId

  const targetGames: Array<{
    id: string
    stream: { id: string; channelId: string; source: string } | null
  }> = nowhere
    ? []
    : await tx.game.findMany({
        where: {
          scheduledAt: { gte: dayStart, lt: dayEnd },
          // Finished games keep whatever row they finished with (VOD integrity).
          status: { notIn: [...FINISHED_STATUSES] },
          ...(target.courtId
            ? { courtId: target.courtId }
            : { venueId: target.venueId, courtId: null }),
        },
        select: { id: true, stream: { select: { id: true, channelId: true, source: true } } },
      })
  const targetIds = new Set(targetGames.map((g) => g.id))

  // Un-map first: the rig has physically left those courts, so their games are
  // showing nothing. Only AUTO rows, only today, only unfinished games.
  const strays: Array<{ id: string; gameId: string }> = await tx.gameStream.findMany({
    where: {
      channelId: opts.channelId,
      source: "AUTO",
      game: {
        scheduledAt: { gte: dayStart, lt: dayEnd },
        status: { notIn: [...FINISHED_STATUSES] },
      },
    },
    select: { id: true, gameId: true },
  })
  const unmapped = strays.filter((s) => !targetIds.has(s.gameId))
  if (unmapped.length > 0) {
    await tx.gameStream.deleteMany({ where: { id: { in: unmapped.map((u) => u.id) } } })
  }

  const mapped: string[] = []
  let created = 0
  let updated = 0
  for (const game of targetGames) {
    if (game.stream) {
      // A human said this game shows that channel. Nothing automatic overrules it.
      if (game.stream.source === "MANUAL") continue
      if (game.stream.channelId !== opts.channelId) {
        await tx.gameStream.update({
          where: { id: game.stream.id },
          data: { channelId: opts.channelId, source: "AUTO" },
        })
        updated += 1
      }
    } else {
      await tx.gameStream.create({
        data: { gameId: game.id, channelId: opts.channelId, source: "AUTO" },
      })
      created += 1
    }
    mapped.push(game.id)
  }

  return { mapped, unmapped: unmapped.map((u) => u.gameId), created, updated }
}

/**
 * Put a rig at a court (or a building) and re-derive what it shows.
 *
 * Two guards, and they answer opposite questions:
 *
 *   TAKE-OVER  what this rig is leaving behind. A channel places at ONE spot
 *              at a time, so claiming one that is mid-way through another
 *              court's live game is refused unless the caller confirms. The
 *              refusal carries the other game so the UI can name it rather
 *              than saying "conflict".
 *   DISPLACE   what this rig is arriving on top of. A floor holds ONE camera,
 *              so every other channel standing here is un-placed in the same
 *              transaction and loses its AUTO rows. This one is never refused:
 *              the person placing the camera is looking at the floor.
 *
 * Both are audit-logged. A take-over means someone's families just lost their
 * picture; a displacement means a rig quietly stopped covering its games.
 */
export async function placeChannel(input: PlaceChannelInput): Promise<PlaceChannelResult> {
  const now = input.now ?? new Date()
  const courtId = input.courtId ?? null
  const venueId = input.venueId ?? null

  if ((courtId === null) === (venueId === null)) {
    throw new StreamPlacementError(
      "BAD_TARGET",
      "Place a camera at exactly one court or one venue",
      400
    )
  }

  const channel = await prisma.streamChannel.findUnique({
    where: { id: input.channelId },
    select: { id: true, name: true, status: true, currentCourtId: true, currentVenueId: true },
  })
  if (!channel) throw new StreamPlacementError("CHANNEL_NOT_FOUND", "Camera not found", 404)
  if (channel.status !== "ACTIVE") {
    throw new StreamPlacementError("CHANNEL_DISABLED", `${channel.name} is disabled`, 409)
  }

  if (courtId) {
    const court = await prisma.court.findUnique({ where: { id: courtId }, select: { id: true } })
    if (!court) throw new StreamPlacementError("COURT_NOT_FOUND", "Court not found", 404)
  } else {
    const venue = await prisma.venue.findUnique({
      where: { id: venueId! },
      select: { id: true },
    })
    if (!venue) throw new StreamPlacementError("VENUE_NOT_FOUND", "Venue not found", 404)
  }

  // What this rig is showing right now, somewhere else.
  const held = (await prisma.gameStream.findMany({
    where: {
      channelId: channel.id,
      game: { status: { notIn: [...FINISHED_STATUSES] } },
    },
    select: { startedAt: true, endedAt: true, game: { select: HELD_GAME_SELECT } },
  })) as Array<{ startedAt: Date | null; endedAt: Date | null; game: any }>

  const busy = held.find(
    (h) =>
      !gameMatchesTarget(h.game, { courtId, venueId }) &&
      isStreamWindowOpen(
        {
          startedAt: h.startedAt,
          endedAt: h.endedAt,
          scheduledAt: h.game.scheduledAt,
          duration: h.game.duration,
          gameStatus: h.game.status,
          // Placement already refused a disabled channel above, so the window
          // question here is purely about the game's clock.
          channelStatus: "ACTIVE",
          playbackUrl: "",
        },
        now
      )
  )

  const conflict: StreamTakeoverConflict | null = busy
    ? {
        channelId: channel.id,
        channelName: channel.name,
        gameId: busy.game.id,
        scheduledAt: busy.game.scheduledAt,
        courtId: busy.game.court?.id ?? null,
        courtName: busy.game.court?.name ?? null,
        venueId: busy.game.venue?.id ?? busy.game.court?.venue?.id ?? null,
        venueName: busy.game.venue?.name ?? busy.game.court?.venue?.name ?? null,
        matchup:
          busy.game.homeTeam?.name && busy.game.awayTeam?.name
            ? `${busy.game.homeTeam.name} vs ${busy.game.awayTeam.name}`
            : null,
      }
    : null

  if (conflict && !input.force) {
    const where = conflict.courtName
      ? `${conflict.courtName}'s live game`
      : "a live game"
    const at = conflict.venueName ? ` at ${conflict.venueName}` : ""
    throw new StreamPlacementError(
      "TAKEOVER_REQUIRED",
      `${channel.name} is showing ${where}${at}`,
      409,
      conflict
    )
  }

  /**
   * Whoever is already standing here. Read outside the transaction only to
   * know their names; the un-placing itself happens inside it.
   */
  const sittingHere: Array<{ id: string; name: string }> =
    await prisma.streamChannel.findMany({
      where: {
        id: { not: channel.id },
        ...(courtId ? { currentCourtId: courtId } : { currentVenueId: venueId }),
      },
      select: { id: true, name: true },
    })

  const result = await prisma.$transaction(async (tx: Tx) => {
    /**
     * ONE FLOOR, ONE CAMERA. Clear the rigs that were here BEFORE the new one
     * is written, so the moment in between is "nobody is at this court",
     * never "two cameras are". Their AUTO rows for today go with them: a rig
     * standing nowhere covers nothing.
     */
    const displaced: StreamDisplacedChannel[] = []
    for (const other of sittingHere) {
      await tx.streamChannel.update({
        where: { id: other.id },
        data: {
          currentCourtId: null,
          currentVenueId: null,
          placedAt: null,
          placedById: null,
        },
      })
      const released = await remapChannel(tx, {
        channelId: other.id,
        courtId: null,
        venueId: null,
        now,
      })
      displaced.push({
        channelId: other.id,
        channelName: other.name,
        unmapped: released.unmapped,
      })
      await audit(tx, {
        actorId: input.actorId,
        actorRole: input.actorRole ?? "Scorekeeper",
        action: "STREAM_CHANNEL_DISPLACE",
        resource: "StreamChannel",
        resourceId: other.id,
        changes: {
          courtId: { from: courtId, to: null },
          venueId: { from: venueId, to: null },
        },
        metadata: {
          channelName: other.name,
          replacedBy: channel.name,
          replacedById: channel.id,
          unmapped: released.unmapped,
        },
        request: input.request,
      })
    }

    await tx.streamChannel.update({
      where: { id: channel.id },
      data: {
        currentCourtId: courtId,
        currentVenueId: venueId,
        placedAt: now,
        placedById: input.actorId,
      },
    })

    const remap = await remapChannel(tx, { channelId: channel.id, courtId, venueId, now })

    await audit(tx, {
      actorId: input.actorId,
      actorRole: input.actorRole ?? "Scorekeeper",
      action: "STREAM_CHANNEL_PLACE",
      resource: "StreamChannel",
      resourceId: channel.id,
      changes: {
        courtId: { from: channel.currentCourtId, to: courtId },
        venueId: { from: channel.currentVenueId, to: venueId },
      },
      metadata: {
        channelName: channel.name,
        mapped: remap.mapped,
        unmapped: remap.unmapped,
        ...(displaced.length
          ? { displaced: displaced.map((d) => d.channelName) }
          : {}),
      },
      request: input.request,
    })

    if (conflict) {
      // Someone's families just lost their picture. Say who did it.
      await audit(tx, {
        actorId: input.actorId,
        actorRole: input.actorRole ?? "Scorekeeper",
        action: "STREAM_TAKEOVER",
        resource: "StreamChannel",
        resourceId: channel.id,
        metadata: { ...conflict, scheduledAt: conflict.scheduledAt.toISOString() },
        request: input.request,
      })
    }

    return { ...remap, displaced }
  })

  return {
    channelId: channel.id,
    courtId,
    venueId,
    mapped: result.mapped,
    unmapped: result.unmapped,
    tookOver: conflict,
    displaced: result.displaced,
  }
}

export interface AssignerWarning {
  channelId: string
  channelName: string
  code: "OVERLAPPING_GAMES" | "SHARED_PLACEMENT"
  message: string
  gameIds: string[]
}

export interface AssignerResult {
  /** The calendar day converged, in the app timezone. */
  date: string
  channels: number
  created: number
  updated: number
  removed: number
  warnings: AssignerWarning[]
}

/**
 * Converge every placed channel's AUTO mappings for one day.
 *
 * Runs after a schedule change and nightly. It is a pure convergence pass: it
 * never touches MANUAL rows and never touches finished games, so running it
 * twice changes nothing the second time.
 *
 * Warnings are the schedule telling on itself. One camera whose games overlap
 * is not a streaming bug — it is a COURT DOUBLE-BOOKING, because a camera maps
 * to a court and a court cannot host two games at once.
 */
export async function runAssigner(opts: { date?: Date } = {}): Promise<AssignerResult> {
  const now = opts.date ?? new Date()
  const { year, month, day } = dateInTz(now)

  const channels = await prisma.streamChannel.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ currentCourtId: { not: null } }, { currentVenueId: { not: null } }],
    },
    select: { id: true, name: true, currentCourtId: true, currentVenueId: true },
  })

  let created = 0
  let updated = 0
  let removed = 0
  const warnings: AssignerWarning[] = []

  // Two rigs pointed at one court: whichever ran last would own the games, so
  // the mapping would flap. Report it rather than pick a winner.
  //
  // placeChannel() can no longer CREATE this state (one floor, one camera), so
  // reaching it means rows written before that fix or edited straight in the
  // database. Keeping the warning is how those get found.
  const byPlacement = new Map<string, typeof channels>()
  for (const channel of channels) {
    const key = channel.currentCourtId ?? `venue:${channel.currentVenueId}`
    byPlacement.set(key, [...(byPlacement.get(key) ?? []), channel])
  }
  for (const [, sharing] of byPlacement) {
    if (sharing.length < 2) continue
    warnings.push({
      channelId: sharing[0].id,
      channelName: sharing.map((c) => c.name).join(", "),
      code: "SHARED_PLACEMENT",
      message: `${sharing.map((c) => c.name).join(" and ")} are placed at the same spot`,
      gameIds: [],
    })
  }

  for (const channel of channels) {
    const remap = await prisma.$transaction(async (tx: Tx) =>
      remapChannel(tx, {
        channelId: channel.id,
        courtId: channel.currentCourtId,
        venueId: channel.currentVenueId,
        now,
      })
    )
    created += remap.created
    updated += remap.updated
    removed += remap.unmapped.length

    if (remap.mapped.length > 1) {
      const games: Array<{ id: string; scheduledAt: Date; duration: number | null }> =
        await prisma.game.findMany({
          where: { id: { in: remap.mapped } },
          select: { id: true, scheduledAt: true, duration: true },
          orderBy: { scheduledAt: "asc" },
        })
      for (let i = 1; i < games.length; i++) {
        const prev = games[i - 1]
        const prevEnd = prev.scheduledAt.getTime() + (prev.duration ?? 90) * 60_000
        if (games[i].scheduledAt.getTime() < prevEnd) {
          warnings.push({
            channelId: channel.id,
            channelName: channel.name,
            code: "OVERLAPPING_GAMES",
            message: `${channel.name} is mapped to two games at once, so that court is double-booked`,
            gameIds: [prev.id, games[i].id],
          })
        }
      }
    }
  }

  return {
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    channels: channels.length,
    created,
    updated,
    removed,
    warnings,
  }
}

/**
 * The escape hatch (plan: "Manual per-game override"). Pins one game to one
 * channel by hand, and the MANUAL source is what makes the pin survive every
 * later placement change and assigner run.
 *
 * Library-only in phase 1: the admin Streams dashboard that calls it is phase
 * 2, and the scorekeeper strip never needs it (moving the camera is the right
 * answer at the table).
 */
export async function mapGameManually(opts: {
  gameId: string
  channelId: string
  actorId: string
  actorRole?: string
  startedAt?: Date | null
  endedAt?: Date | null
  request?: Request
}): Promise<{ gameId: string; channelId: string }> {
  const game = await prisma.game.findUnique({
    where: { id: opts.gameId },
    select: { id: true, status: true },
  })
  if (!game) throw new StreamPlacementError("GAME_NOT_FOUND", "Game not found", 404)

  const channel = await prisma.streamChannel.findUnique({
    where: { id: opts.channelId },
    select: { id: true, name: true, status: true },
  })
  if (!channel) throw new StreamPlacementError("CHANNEL_NOT_FOUND", "Camera not found", 404)

  await prisma.$transaction(async (tx: Tx) => {
    await tx.gameStream.upsert({
      where: { gameId: opts.gameId },
      create: {
        gameId: opts.gameId,
        channelId: opts.channelId,
        source: "MANUAL",
        startedAt: opts.startedAt ?? null,
        endedAt: opts.endedAt ?? null,
      },
      update: {
        channelId: opts.channelId,
        source: "MANUAL",
        ...(opts.startedAt !== undefined ? { startedAt: opts.startedAt } : {}),
        ...(opts.endedAt !== undefined ? { endedAt: opts.endedAt } : {}),
      },
    })
    await audit(tx, {
      actorId: opts.actorId,
      actorRole: opts.actorRole ?? "PlatformAdmin",
      action: "STREAM_MANUAL_MAP",
      resource: "Game",
      resourceId: opts.gameId,
      metadata: {
        channelId: opts.channelId,
        channelName: channel.name,
        startedAt: opts.startedAt?.toISOString() ?? null,
        endedAt: opts.endedAt?.toISOString() ?? null,
      },
      request: opts.request,
    })
  })

  return { gameId: opts.gameId, channelId: opts.channelId }
}
