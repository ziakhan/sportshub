import { prisma } from "@youthbasketballhub/db"

/**
 * Live streaming — the playback state a VIEWER is allowed to see
 * (docs/roadmap/live-streaming-plan.md, "Playback window").
 *
 * PARITY LAW: one source per surface. The public game page, the schedule row
 * LIVE badge, the native app and GET /api/games/[id]/stream all read this
 * module. Nothing else computes "is this game watchable right now".
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  HARD RULE — ingestUrl and streamKey NEVER cross this boundary.
 *
 *  A StreamChannel row carries three URLs. Two of them are operator secrets:
 *  `ingestUrl` + `streamKey` are what a camera pushes WITH, so anyone holding
 *  them can push their own picture onto a youth game's page. Only
 *  `playbackUrl` is for viewers.
 *
 *  This is enforced structurally, not by convention: VIEWER_CHANNEL_SELECT is
 *  the only channel selection in this file, it names its three fields
 *  explicitly (never `include`, never a bare `channel: true`), and no member
 *  of GameStreamState has anywhere to put a secret. Operator surfaces that
 *  legitimately need the ingest pair read the channel themselves under a
 *  PlatformAdmin check (see api/admin/streams/channels).
 * ══════════════════════════════════════════════════════════════════════════
 */

/** Fallback window: the button lights this long before the scheduled tip. */
export const STREAM_LEAD_MINUTES = 15
/** …and stays lit this long past the scheduled end, which absorbs OT. */
export const STREAM_TRAIL_MINUTES = 30

/**
 * Game statuses that end playback. The plan's fallback window is a clock, and
 * a clock alone would keep a finished 7:00 game "live" until 7:50 — by which
 * time the camera has already been re-pointed at the 7:30 game on the same
 * court, so the earlier game's page would be showing the LATER game's picture.
 * A game that is over is over; phase 3 turns these rows into VOD.
 */
const PLAYBACK_ENDING_STATUSES = new Set(["COMPLETED", "CANCELLED", "POSTPONED", "DEFAULTED"])

/**
 * Who is asking. `userId` null = anonymous (signed-out web, native browse).
 * Deliberately not a full session object: this module must be callable from a
 * server component, a route handler and the native API with the same argument.
 */
export interface StreamViewer {
  userId: string | null
  isPlatformAdmin?: boolean
}

/**
 * ── THE VIEWER-GATING DECISION SLOTS IN HERE ──────────────────────────────
 *
 * The plan's open decision #2 (public vs signed-in vs members) is UNRULED as
 * of 2026-08-21. Until the owner picks, the default is the safer one for
 * minors on camera: SIGNED_IN — you need an account to watch a child play.
 *
 * Flipping to open access is a one-line change here… plus one line in
 * lib/public-paths.ts, because /api/games is not an anonymous-read namespace
 * (see the note on the stream route). Both, or neither.
 *
 * A third tier the owner may pick — MEMBERS (only the two clubs' families and
 * the league's people) — is deliberately NOT in this union: it needs a roster
 * and family lookup against the viewer, which is a function, not a constant.
 * It belongs in viewerMayWatch() below, next to the two cheap cases.
 */
export type StreamViewerPolicy = "PUBLIC" | "SIGNED_IN"

export const STREAM_VIEWER_POLICY: StreamViewerPolicy = "SIGNED_IN"

function viewerMayWatch(viewer: StreamViewer | null): boolean {
  if (STREAM_VIEWER_POLICY === "PUBLIC") return true
  // SIGNED_IN — the current default.
  return !!viewer?.userId
}

/**
 * What a viewer gets. Four states, one shape each, nothing optional to
 * misread: a page renders the player only in "live", the countdown only in
 * "upcoming", and shows no streaming chrome at all in "none".
 */
export type GameStreamState =
  | { state: "none" }
  | { state: "upcoming"; startsAt: Date }
  | { state: "live"; playbackUrl: string }
  | { state: "ended" }

/** The ONLY channel fields a viewer path may read. See the header rule. */
const VIEWER_CHANNEL_SELECT = {
  id: true,
  status: true,
  playbackUrl: true,
} as const

export interface StreamWindowInput {
  /** Manual go-live override (operator pressed "start"). */
  startedAt: Date | null
  /** Manual cut (operator pressed "end"). */
  endedAt: Date | null
  scheduledAt: Date
  /** Game.duration in minutes. */
  duration: number | null
  /** Game.status. */
  gameStatus: string
  /** StreamChannel.status. */
  channelStatus: string
  playbackUrl: string
}

/**
 * The window, in one place (plan: "Playback window — when the button shows").
 *
 * Watchable when a GameStream exists, the channel is ACTIVE, and either the
 * scorekeeper has put the game LIVE (strongest signal) or now falls inside
 * [scheduledAt − 15min, scheduledAt + duration + 30min]. `startedAt` and
 * `endedAt` override both, in that order — an operator who cut the feed has
 * said something the clock cannot argue with.
 *
 * Pure and exported so the placement/take-over guard asks the same question
 * the game page does; two definitions of "live right now" would drift.
 */
export function computeStreamState(input: StreamWindowInput, now: Date = new Date()): GameStreamState {
  if (input.channelStatus !== "ACTIVE") return { state: "none" }

  const live = (): GameStreamState => ({ state: "live", playbackUrl: input.playbackUrl })

  // 1. Operator overrides win.
  if (input.endedAt && now >= input.endedAt) return { state: "ended" }
  if (input.startedAt) {
    return now >= input.startedAt ? live() : { state: "upcoming", startsAt: input.startedAt }
  }

  // 2. The scorekeeper's own signal.
  if (input.gameStatus === "LIVE") return live()
  if (PLAYBACK_ENDING_STATUSES.has(input.gameStatus)) return { state: "ended" }

  // 3. The clock fallback.
  const start = input.scheduledAt.getTime()
  const opensAt = start - STREAM_LEAD_MINUTES * 60_000
  const closesAt = start + (input.duration ?? 90) * 60_000 + STREAM_TRAIL_MINUTES * 60_000
  if (now.getTime() < opensAt) return { state: "upcoming", startsAt: input.scheduledAt }
  if (now.getTime() <= closesAt) return live()
  return { state: "ended" }
}

/** True when this mapping is showing a picture right now. */
export function isStreamWindowOpen(input: StreamWindowInput, now: Date = new Date()): boolean {
  return computeStreamState(input, now).state === "live"
}

/**
 * The one read every viewer surface makes.
 *
 * Returns "none" — indistinguishable from "this game has no camera" — for
 * every reason a viewer must not be told about: no league opt-in, a disabled
 * channel, a viewer the policy excludes. "none" is a wall, not an error.
 */
export async function getGameStreamForViewer(
  gameId: string,
  viewer: StreamViewer | null,
  now: Date = new Date()
): Promise<GameStreamState> {
  const row = await prisma.gameStream.findUnique({
    where: { gameId },
    select: {
      startedAt: true,
      endedAt: true,
      channel: { select: VIEWER_CHANNEL_SELECT },
      game: {
        select: {
          scheduledAt: true,
          duration: true,
          status: true,
          // The consent gate lives on the LEAGUE (plan: "Privacy flag").
          season: { select: { league: { select: { streamingEnabled: true } } } },
        },
      },
    },
  })
  if (!row) return { state: "none" }

  // No league opt-in, no playback state, ever. A game with no season has no
  // league to give consent — one-off/manual games cannot stream at all until
  // the owner rules on a second home for the flag.
  if (!row.game.season?.league?.streamingEnabled) return { state: "none" }

  if (!viewerMayWatch(viewer)) return { state: "none" }

  return computeStreamState(
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
  )
}
