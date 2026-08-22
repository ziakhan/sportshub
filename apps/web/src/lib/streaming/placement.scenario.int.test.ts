import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { dateInTz, wallTimeToUtc } from "@/lib/calendar/timezone"
import {
  getGameStreamForViewer,
  STREAM_VIEWER_POLICY,
  type GameStreamState,
} from "@/lib/queries/game-stream"
import {
  placeChannel,
  runAssigner,
  mapGameManually,
  StreamPlacementError,
  type StreamTakeoverConflict,
} from "./placement"
import { probeChannels } from "./health"
import { GET as streamGet } from "@/app/api/games/[id]/stream/route"
import { GET as candidatesGet } from "@/app/api/games/[id]/stream/candidates/route"
import { GET as channelsGet, POST as channelsPost } from "@/app/api/admin/streams/channels/route"
import { POST as placementPost } from "@/app/api/admin/streams/placement/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — live streaming placement, end to end (world seed 1153).
 * docs/roadmap/live-streaming-plan.md, phase 1.
 *
 * The premise the whole design rests on: THERE ARE FEWER CAMERAS THAN COURTS.
 * Two rigs, two courts, four games in one evening, and a human who moves a
 * tripod between them. What this pins down is that the mapping follows the
 * camera without anybody managing it, and that four things are untouchable
 * while it does:
 *
 *   • a MANUAL row (a human said so)
 *   • a COMPLETED game's row (that is the VOD index, i.e. history)
 *   • a league that has not opted in (children on camera)
 *   • ingestUrl + streamKey (whoever holds them can push their own picture)
 */

let world: BuiltWorld
let leagueId: string
let seasonId: string
let venueId: string
let court1: string
let court2: string
let adminId: string
let scorekeeperId: string
let outsiderId: string
let cameraA: string
let cameraB: string
let g1a: string
let g1b: string
let g2a: string
let g2b: string

const INGEST_A = "rtmp://ingest.stream-test.local/live"
const KEY_A = "sk-camera-a-do-not-leak"
const PLAY_A = "https://cdn.stream-test.local/a/index.m3u8"
const KEY_B = "sk-camera-b-do-not-leak"
const PLAY_B = "https://cdn.stream-test.local/b/index.m3u8"
/** The rig in the OTHER building. Nothing here may ever hand these out. */
const KEY_FAR = "sk-camera-far-do-not-leak"
const PLAY_FAR = "https://cdn.stream-test.local/far/index.m3u8"

/** Made by the candidates test, torn down whether or not it gets that far. */
let farVenueId: string | null = null
let farChannelIds: string[] = []

/** Same, for the scope test, which needs its own second building. */
let scopeVenueId: string | null = null
let scopeChannelIds: string[] = []

/** Today in the app timezone — every clock in this suite hangs off this. */
const TODAY = dateInTz(new Date())
const at = (hour: number, minute = 0) =>
  wallTimeToUtc(TODAY.year, TODAY.month, TODAY.day, hour, minute)
const minutesFrom = (base: Date, minutes: number) => new Date(base.getTime() + minutes * 60_000)

/** A quiet hour: no game is in any window, so placement never trips the guard. */
const QUIET = () => at(12, 0)

const streamRow = (gameId: string) =>
  prisma.gameStream.findUnique({
    where: { gameId },
    select: { channelId: true, source: true, startedAt: true, endedAt: true },
  })

const watch = (gameId: string, now: Date, viewerId: string | null = scorekeeperId) =>
  getGameStreamForViewer(gameId, { userId: viewerId }, now)

async function makeGame(opts: {
  courtId: string
  hour: number
  minute?: number
  home: string
  away: string
}): Promise<string> {
  const game = await prisma.game.create({
    data: {
      seasonId,
      venueId,
      courtId: opts.courtId,
      homeTeamId: opts.home,
      awayTeamId: opts.away,
      scheduledAt: at(opts.hour, opts.minute ?? 0),
      duration: 60,
      status: "SCHEDULED",
      publishedAt: new Date(),
    },
    select: { id: true },
  })
  return game.id
}

beforeAll(async () => {
  world = await buildWorld({
    seed: 1153,
    leagues: [
      {
        seasons: [
          {
            status: "IN_PROGRESS",
            divisions: [{ teams: 4, rosterSize: 0 }],
            venue: { courts: 2 },
            sessions: [],
          },
        ],
      },
    ],
  })

  // Channels are global rows with no runId FK, so a crashed earlier run of
  // this seed would leave them behind. Name-prefix them and sweep first.
  await prisma.gameStream.deleteMany({
    where: { channel: { name: { startsWith: `[${world.ctx.runId}]` } } },
  })
  await prisma.streamChannel.deleteMany({
    where: { name: { startsWith: `[${world.ctx.runId}]` } },
  })

  const league = world.leagues[0]
  const season = league.seasons[0]
  leagueId = league.id
  seasonId = season.id
  venueId = season.venue!.id
  ;[court1, court2] = season.venue!.courtIds

  // The consent gate. Default is OFF (that is the point of it) — this league
  // has opted in, and one test below turns it back off to prove what happens.
  await prisma.league.update({ where: { id: leagueId }, data: { streamingEnabled: true } })

  const teams = season.divisions[0].submissions.map((s) => s.teamId)
  g1a = await makeGame({ courtId: court1, hour: 18, home: teams[0], away: teams[1] })
  g2a = await makeGame({ courtId: court2, hour: 18, home: teams[2], away: teams[3] })
  g1b = await makeGame({ courtId: court1, hour: 19, minute: 30, home: teams[1], away: teams[2] })
  g2b = await makeGame({ courtId: court2, hour: 19, minute: 30, home: teams[0], away: teams[3] })

  // The platform admin who sets the rigs up in the office.
  const admin = await prisma.user.create({
    data: {
      email: world.ctx.email("streams-admin"),
      passwordHash: "x",
      firstName: "Ops",
      lastName: "Admin",
      status: "ACTIVE",
      onboardedAt: new Date(),
    },
  })
  adminId = admin.id
  await prisma.userRole.create({ data: { userId: adminId, role: "PlatformAdmin" } })

  // The person at the table for Court 1's 6pm game — the league assigned them.
  const scorekeeper = await prisma.user.create({
    data: {
      email: world.ctx.email("scorekeeper"),
      passwordHash: "x",
      firstName: "Table",
      lastName: "Keeper",
      status: "ACTIVE",
      onboardedAt: new Date(),
    },
  })
  scorekeeperId = scorekeeper.id
  await prisma.userRole.create({
    data: { userId: scorekeeperId, role: "Scorekeeper", gameId: g1a },
  })

  // Signed in, but nothing to do with this game.
  const outsider = await prisma.user.create({
    data: {
      email: world.ctx.email("outsider"),
      passwordHash: "x",
      firstName: "Passing",
      lastName: "Stranger",
      status: "ACTIVE",
      onboardedAt: new Date(),
    },
  })
  outsiderId = outsider.id

  const a = await prisma.streamChannel.create({
    data: {
      name: world.ctx.name("Camera A"),
      ingestUrl: INGEST_A,
      streamKey: KEY_A,
      playbackUrl: PLAY_A,
    },
    select: { id: true },
  })
  cameraA = a.id
  const b = await prisma.streamChannel.create({
    data: {
      name: world.ctx.name("Camera B"),
      ingestUrl: "rtmp://ingest.stream-test.local/live",
      streamKey: KEY_B,
      playbackUrl: PLAY_B,
    },
    select: { id: true },
  })
  cameraB = b.id
})

afterAll(async () => {
  if (!world) return
  // GameStream.channelId is a required FK, so the rows go before the rigs;
  // destroyWorld's game delete would cascade them anyway, but the channels
  // themselves are outside its namespace.
  const rigs = [cameraA, cameraB, ...farChannelIds, ...scopeChannelIds]
  await prisma.gameStream.deleteMany({ where: { channelId: { in: rigs } } })
  await prisma.streamChannel.deleteMany({ where: { id: { in: rigs } } })
  // The second building is outside the world's namespace, so it is ours to
  // remove. Its courts go with it (onDelete: Cascade).
  if (farVenueId) await prisma.venue.delete({ where: { id: farVenueId } }).catch(() => {})
  if (scopeVenueId) await prisma.venue.delete({ where: { id: scopeVenueId } }).catch(() => {})
  await destroyWorld(world.ctx)
})

describe("live streaming: two rigs, two courts, one evening (integration)", () => {
  it("placing a rig at a court maps that court's whole day to it", async () => {
    const placedA = await placeChannel({
      channelId: cameraA,
      courtId: court1,
      actorId: adminId,
      actorRole: "PlatformAdmin",
      now: QUIET(),
    })
    expect(placedA.mapped.sort()).toEqual([g1a, g1b].sort())
    expect(placedA.unmapped).toEqual([])
    expect(placedA.tookOver).toBeNull()

    const placedB = await placeChannel({
      channelId: cameraB,
      courtId: court2,
      actorId: adminId,
      actorRole: "PlatformAdmin",
      now: QUIET(),
    })
    expect(placedB.mapped.sort()).toEqual([g2a, g2b].sort())

    // Nobody managed these rows: they came from placement + the schedule.
    for (const gameId of [g1a, g1b]) {
      expect(await streamRow(gameId)).toMatchObject({ channelId: cameraA, source: "AUTO" })
    }
    for (const gameId of [g2a, g2b]) {
      expect(await streamRow(gameId)).toMatchObject({ channelId: cameraB, source: "AUTO" })
    }

    const channel = await prisma.streamChannel.findUnique({ where: { id: cameraA } })
    expect(channel?.currentCourtId).toBe(court1)
    expect(channel?.currentVenueId).toBeNull()
    expect(channel?.placedById).toBe(adminId)
    expect(channel?.placedAt).not.toBeNull()
  })

  it("carrying a rig to the other court takes its games with it, and the court it left goes dark", async () => {
    const moved = await placeChannel({
      channelId: cameraA,
      courtId: court2,
      actorId: adminId,
      actorRole: "PlatformAdmin",
      now: QUIET(),
    })
    expect(moved.mapped.sort()).toEqual([g2a, g2b].sort())
    expect(moved.unmapped.sort()).toEqual([g1a, g1b].sort())

    // Court 1 has no camera on it, so its games show nothing at all.
    expect(await streamRow(g1a)).toBeNull()
    expect(await streamRow(g1b)).toBeNull()
    // Court 2's games followed the rig that is actually pointing at them.
    expect(await streamRow(g2a)).toMatchObject({ channelId: cameraA, source: "AUTO" })
    expect(await streamRow(g2b)).toMatchObject({ channelId: cameraA, source: "AUTO" })

    // Carry it back and re-confirm B, which is still standing at Court 2.
    await placeChannel({ channelId: cameraA, courtId: court1, actorId: adminId, now: QUIET() })
    await placeChannel({ channelId: cameraB, courtId: court2, actorId: adminId, now: QUIET() })
    expect(await streamRow(g1a)).toMatchObject({ channelId: cameraA })
    expect(await streamRow(g2a)).toMatchObject({ channelId: cameraB })
  })

  it("lets ONE camera stand at a court: placing a second one moves the first off it", async () => {
    // The owner's defect, 2026-08-22. Placement used to accumulate — the
    // staging database held two rigs both claiming Court 1 — and a camera is
    // one physical object on one floor, so that is a state that cannot exist
    // in the world. The person at the table is looking at the floor and we are
    // not, so their answer wins and the other rig is simply moved off.
    await placeChannel({ channelId: cameraA, courtId: court1, actorId: adminId, now: QUIET() })
    expect(await streamRow(g1a)).toMatchObject({ channelId: cameraA, source: "AUTO" })

    const takenOver = await placeChannel({
      channelId: cameraB,
      courtId: court1,
      actorId: scorekeeperId,
      actorRole: "Scorekeeper",
      now: QUIET(),
    })

    // The rig that was standing here is standing nowhere now, with every
    // trace of its placement cleared — not just the court id.
    const displacedA = await prisma.streamChannel.findUnique({ where: { id: cameraA } })
    expect(displacedA?.currentCourtId).toBeNull()
    expect(displacedA?.currentVenueId).toBeNull()
    expect(displacedA?.placedAt).toBeNull()
    expect(displacedA?.placedById).toBeNull()

    // THE INVARIANT, asked of the database directly.
    const atCourt1 = await prisma.streamChannel.findMany({
      where: { currentCourtId: court1 },
      select: { id: true },
    })
    expect(atCourt1).toEqual([{ id: cameraB }])

    // Its games went with the camera that is actually pointing at them, and
    // the ones it let go of are named in the result so a UI can say it.
    expect(takenOver.mapped.sort()).toEqual([g1a, g1b].sort())
    expect(takenOver.displaced).toHaveLength(1)
    expect(takenOver.displaced[0].channelId).toBe(cameraA)
    expect(takenOver.displaced[0].unmapped.sort()).toEqual([g1a, g1b].sort())
    expect(await streamRow(g1a)).toMatchObject({ channelId: cameraB, source: "AUTO" })
    expect(await streamRow(g1b)).toMatchObject({ channelId: cameraB, source: "AUTO" })

    // A rig that quietly stopped covering its games gets a name against it.
    const trail = await prisma.auditLog.findFirst({
      where: { action: "STREAM_CHANNEL_DISPLACE", resourceId: cameraA },
      orderBy: { createdAt: "desc" },
      select: { userId: true, metadata: true },
    })
    expect(trail?.userId).toBe(scorekeeperId)
    expect((trail!.metadata as any).replacedById).toBe(cameraB)

    // The same rule for a BUILDING placement, which is the other half of
    // court-XOR-venue and would otherwise accumulate exactly the same way.
    await placeChannel({ channelId: cameraA, venueId, actorId: adminId, now: QUIET() })
    const movedIn = await placeChannel({
      channelId: cameraB,
      venueId,
      actorId: adminId,
      now: QUIET(),
    })
    expect(movedIn.displaced.map((d) => d.channelId)).toEqual([cameraA])
    const atVenue = await prisma.streamChannel.findMany({
      where: { currentVenueId: venueId },
      select: { id: true },
    })
    expect(atVenue).toEqual([{ id: cameraB }])

    // The assigner agrees: with one rig per spot there is nothing to warn about.
    const converged = await runAssigner({ date: QUIET() })
    expect(converged.warnings.filter((w) => w.code === "SHARED_PLACEMENT")).toEqual([])

    // Put the evening back: A on Court 1, B on Court 2.
    await placeChannel({ channelId: cameraA, courtId: court1, actorId: adminId, now: QUIET() })
    await placeChannel({ channelId: cameraB, courtId: court2, actorId: adminId, now: QUIET() })
    expect(await streamRow(g1a)).toMatchObject({ channelId: cameraA, source: "AUTO" })
    expect(await streamRow(g2a)).toMatchObject({ channelId: cameraB, source: "AUTO" })
  })

  it("refuses to steal a rig that is mid-game on another court, then obeys a confirmed take-over", async () => {
    await prisma.game.update({ where: { id: g1a }, data: { status: "LIVE" } })
    const during = minutesFrom(at(18, 0), 20)

    let refusal: StreamPlacementError | null = null
    try {
      await placeChannel({
        channelId: cameraA,
        courtId: court2,
        actorId: adminId,
        now: during,
      })
    } catch (error) {
      refusal = error as StreamPlacementError
    }
    expect(refusal).toBeInstanceOf(StreamPlacementError)
    expect(refusal!.code).toBe("TAKEOVER_REQUIRED")
    expect(refusal!.status).toBe(409)

    // The refusal names what it would interrupt, so the dialog can say
    // "Camera A is showing Court 1's live game at <gym> — take it anyway?"
    const conflict = refusal!.details as StreamTakeoverConflict
    expect(conflict.gameId).toBe(g1a)
    expect(conflict.courtId).toBe(court1)
    expect(conflict.courtName).toBe("Court 1")
    expect(conflict.venueId).toBe(venueId)
    expect(conflict.venueName).toBeTruthy()
    expect(conflict.matchup).toContain(" vs ")

    // Nothing moved on the refusal.
    expect((await prisma.streamChannel.findUnique({ where: { id: cameraA } }))?.currentCourtId).toBe(
      court1
    )
    expect(await streamRow(g1a)).toMatchObject({ channelId: cameraA })

    const forced = await placeChannel({
      channelId: cameraA,
      courtId: court2,
      actorId: adminId,
      actorRole: "PlatformAdmin",
      force: true,
      now: during,
    })
    expect(forced.tookOver?.gameId).toBe(g1a)
    // The families watching Court 1 just lost their picture. That is the
    // whole reason the take-over is a deliberate, recorded act.
    expect(await streamRow(g1a)).toBeNull()
    expect(await watch(g1a, during)).toEqual({ state: "none" })

    const trail = await prisma.auditLog.findMany({
      where: { userId: adminId, resourceId: cameraA, action: { in: ["STREAM_TAKEOVER", "STREAM_CHANNEL_PLACE"] } },
      select: { action: true, metadata: true },
    })
    const takeover = trail.find((row) => row.action === "STREAM_TAKEOVER")
    expect(takeover).toBeTruthy()
    expect((takeover!.metadata as any).gameId).toBe(g1a)
    expect(trail.some((row) => row.action === "STREAM_CHANNEL_PLACE")).toBe(true)

    // Put the evening back the way it was.
    await prisma.game.update({ where: { id: g1a }, data: { status: "SCHEDULED" } })
    await placeChannel({ channelId: cameraA, courtId: court1, actorId: adminId, now: QUIET() })
    await placeChannel({ channelId: cameraB, courtId: court2, actorId: adminId, now: QUIET() })
    expect(await streamRow(g1a)).toMatchObject({ channelId: cameraA, source: "AUTO" })
    expect(await streamRow(g2a)).toMatchObject({ channelId: cameraB, source: "AUTO" })
  })

  it("walks a game page through upcoming, live and ended on the clock alone", async () => {
    const tip = at(18, 0)

    expect(await watch(g2a, minutesFrom(tip, -120))).toEqual({
      state: "upcoming",
      startsAt: tip,
    })
    // The button lights 15 minutes before tip-off.
    expect(await watch(g2a, minutesFrom(tip, -16))).toEqual({ state: "upcoming", startsAt: tip })
    expect(await watch(g2a, minutesFrom(tip, -14))).toEqual({
      state: "live",
      playbackUrl: PLAY_B,
    })
    // 60-minute game + a 30-minute tail that absorbs overtime.
    expect(await watch(g2a, minutesFrom(tip, 89))).toEqual({ state: "live", playbackUrl: PLAY_B })
    expect(await watch(g2a, minutesFrom(tip, 91))).toEqual({ state: "ended" })
  })

  it("lets the scorekeeper's LIVE flag beat the clock, and manual start/end beat both", async () => {
    const tip = at(18, 0)
    const wayLate = minutesFrom(tip, 300)

    // The strongest signal there is: someone at the table says it is on.
    await prisma.game.update({ where: { id: g2a }, data: { status: "LIVE" } })
    expect(await watch(g2a, wayLate)).toEqual({ state: "live", playbackUrl: PLAY_B })
    await prisma.game.update({ where: { id: g2a }, data: { status: "SCHEDULED" } })

    // Manual go-live: the rig went up late, so nothing before it is watchable
    // even though the clock says the window is open.
    const goLive = minutesFrom(tip, 20)
    await prisma.gameStream.update({ where: { gameId: g2a }, data: { startedAt: goLive } })
    expect(await watch(g2a, tip)).toEqual({ state: "upcoming", startsAt: goLive })
    expect(await watch(g2a, minutesFrom(goLive, 1))).toEqual({
      state: "live",
      playbackUrl: PLAY_B,
    })

    // Manual cut wins over everything, including a LIVE game.
    const cut = minutesFrom(tip, 40)
    await prisma.gameStream.update({ where: { gameId: g2a }, data: { endedAt: cut } })
    await prisma.game.update({ where: { id: g2a }, data: { status: "LIVE" } })
    expect(await watch(g2a, minutesFrom(cut, 5))).toEqual({ state: "ended" })

    await prisma.game.update({ where: { id: g2a }, data: { status: "SCHEDULED" } })
    await prisma.gameStream.update({
      where: { gameId: g2a },
      data: { startedAt: null, endedAt: null },
    })
  })

  it("shows nothing for a game with no camera, a disabled rig, or a signed-out visitor", async () => {
    const during = minutesFrom(at(18, 0), 10)

    // A game nobody placed a camera on.
    const orphan = await makeGame({
      courtId: court1,
      hour: 6,
      home: (await prisma.game.findUniqueOrThrow({ where: { id: g1a } })).homeTeamId,
      away: (await prisma.game.findUniqueOrThrow({ where: { id: g1a } })).awayTeamId,
    })
    expect(await watch(orphan, at(6, 0))).toEqual({ state: "none" })

    // A rig taken out of service goes dark everywhere at once.
    await prisma.streamChannel.update({ where: { id: cameraB }, data: { status: "DISABLED" } })
    expect(await watch(g2a, during)).toEqual({ state: "none" })
    await prisma.streamChannel.update({ where: { id: cameraB }, data: { status: "ACTIVE" } })

    // Default policy is SIGNED_IN — the safer reading while minors are on
    // camera and the owner has not ruled (plan open decision #2).
    expect(STREAM_VIEWER_POLICY).toBe("SIGNED_IN")
    expect(await watch(g2a, during, null)).toEqual({ state: "none" })
    expect(await watch(g2a, during, outsiderId)).toEqual({
      state: "live",
      playbackUrl: PLAY_B,
    })

    await prisma.game.delete({ where: { id: orphan } })
  })

  it("hides every stream the moment the league's consent toggle goes off", async () => {
    const during = minutesFrom(at(18, 0), 10)
    expect(await watch(g1a, during)).toEqual({ state: "live", playbackUrl: PLAY_A })

    await prisma.league.update({ where: { id: leagueId }, data: { streamingEnabled: false } })
    for (const gameId of [g1a, g1b, g2a, g2b]) {
      expect(await watch(gameId, during)).toEqual({ state: "none" })
      expect(await watch(gameId, during, adminId)).toEqual({ state: "none" })
    }
    // The mappings are untouched — consent hides playback, it does not tear
    // the camera plan down.
    expect(await streamRow(g1a)).toMatchObject({ channelId: cameraA })

    await prisma.league.update({ where: { id: leagueId }, data: { streamingEnabled: true } })
    expect(await watch(g1a, during)).toEqual({ state: "live", playbackUrl: PLAY_A })
  })

  it("leaves a hand-pinned game exactly where a human put it, however often the assigner runs", async () => {
    // Court 1's late game is pinned to the rig at Court 2 — wrong by every
    // automatic rule, and that is the point of an escape hatch.
    await mapGameManually({
      gameId: g1b,
      channelId: cameraB,
      actorId: adminId,
      actorRole: "PlatformAdmin",
    })
    expect(await streamRow(g1b)).toMatchObject({ channelId: cameraB, source: "MANUAL" })

    const first = await runAssigner({ date: QUIET() })
    expect(first.channels).toBe(2)
    expect(await streamRow(g1b)).toMatchObject({ channelId: cameraB, source: "MANUAL" })

    // Convergence: the second pass has nothing left to do.
    const second = await runAssigner({ date: QUIET() })
    expect(second.created).toBe(0)
    expect(second.updated).toBe(0)
    expect(second.removed).toBe(0)
    expect(await streamRow(g1b)).toMatchObject({ channelId: cameraB, source: "MANUAL" })
    expect(await streamRow(g1a)).toMatchObject({ channelId: cameraA, source: "AUTO" })

    const trail = await prisma.auditLog.findFirst({
      where: { action: "STREAM_MANUAL_MAP", resourceId: g1b },
      select: { metadata: true },
    })
    expect((trail?.metadata as any)?.channelId).toBe(cameraB)
  })

  it("keeps a finished game's row when the camera moves on, because that row is the history", async () => {
    await prisma.game.update({ where: { id: g2b }, data: { status: "COMPLETED" } })

    // Send Camera B to the building rather than a numbered court: every game
    // here names a court, so B ends up showing nothing new.
    const moved = await placeChannel({
      channelId: cameraB,
      venueId,
      actorId: adminId,
      actorRole: "PlatformAdmin",
      now: QUIET(),
    })
    expect(moved.mapped).toEqual([])
    expect(moved.unmapped).toEqual([g2a])

    // The finished game keeps the channel it was actually shown on.
    expect(await streamRow(g2b)).toMatchObject({ channelId: cameraB, source: "AUTO" })
    // The hand-pinned row is still hand-pinned.
    expect(await streamRow(g1b)).toMatchObject({ channelId: cameraB, source: "MANUAL" })
    // The unfinished game it walked away from shows nothing.
    expect(await streamRow(g2a)).toBeNull()

    const converged = await runAssigner({ date: QUIET() })
    expect(converged.warnings.filter((w) => w.code === "OVERLAPPING_GAMES")).toEqual([])
    expect(await streamRow(g2b)).toMatchObject({ channelId: cameraB, source: "AUTO" })

    // Back to Court 2 for the rest of the suite.
    await placeChannel({ channelId: cameraB, courtId: court2, actorId: adminId, now: QUIET() })
    expect(await streamRow(g2a)).toMatchObject({ channelId: cameraB, source: "AUTO" })
    expect(await streamRow(g2b)).toMatchObject({ channelId: cameraB, source: "AUTO" })
  })

  it("warns when one rig is asked to show two games at once, because that court is double-booked", async () => {
    const clash = await makeGame({
      courtId: court1,
      hour: 18,
      minute: 30,
      home: (await prisma.game.findUniqueOrThrow({ where: { id: g1b } })).homeTeamId,
      away: (await prisma.game.findUniqueOrThrow({ where: { id: g1b } })).awayTeamId,
    })

    const result = await runAssigner({ date: QUIET() })
    const overlap = result.warnings.find((w) => w.code === "OVERLAPPING_GAMES")
    expect(overlap).toBeTruthy()
    expect(overlap!.channelId).toBe(cameraA)
    expect(overlap!.gameIds.sort()).toEqual([g1a, clash].sort())
    expect(overlap!.message).toContain("double-booked")

    await prisma.game.delete({ where: { id: clash } })
  })

  it("never lets an ingest URL or stream key reach a viewer, on any surface", async () => {
    const during = minutesFrom(at(18, 0), 10)

    const state: GameStreamState = await watch(g1a, during)
    expect(state).toEqual({ state: "live", playbackUrl: PLAY_A })
    const asText = JSON.stringify(state)
    expect(asText).not.toContain(KEY_A)
    expect(asText).not.toContain(INGEST_A)
    expect(asText).not.toContain("ingestUrl")
    expect(asText).not.toContain("streamKey")

    // Same through the public-facing route. A route reads the real clock, so
    // the scorekeeper puts the game LIVE — the signal that beats the clock —
    // rather than this suite pretending to know what time it is.
    await prisma.game.update({ where: { id: g1a }, data: { status: "LIVE" } })
    actAs(scorekeeperId)
    const res = await streamGet(new NextRequest(`http://localhost:3000/api/games/${g1a}/stream`), {
      params: { id: g1a },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.state).toBe("live")
    expect(body.playbackUrl).toBe(PLAY_A)
    expect(JSON.stringify(body)).not.toContain(KEY_A)

    // A signed-out visitor learns nothing, not even that a stream exists.
    actAs(null)
    const anon = await streamGet(new NextRequest(`http://localhost:3000/api/games/${g1a}/stream`), {
      params: { id: g1a },
    })
    expect(await anon.json()).toEqual({ state: "none" })
    await prisma.game.update({ where: { id: g1a }, data: { status: "SCHEDULED" } })

    // The operator console is the ONE place the pair is served, and only to
    // a platform admin.
    actAs(scorekeeperId)
    const forbidden = await channelsGet(
      new NextRequest("http://localhost:3000/api/admin/streams/channels"),
      {}
    )
    expect(forbidden.status).toBe(403)

    actAs(adminId)
    const allowed = await channelsGet(
      new NextRequest("http://localhost:3000/api/admin/streams/channels"),
      {}
    )
    expect(allowed.status).toBe(200)
    const listed = (await allowed.json()).channels.find((c: any) => c.id === cameraA)
    expect(listed.ingestUrl).toBe(INGEST_A)
    expect(listed.streamKey).toBe(KEY_A)
  })

  it("lets the person scoring a game on that floor say which camera is pointing at it", async () => {
    // A third rig arrives mid-season, created from the office.
    actAs(adminId)
    const created = await channelsPost(
      jsonRequest("/api/admin/streams/channels", {
        name: world.ctx.name("Camera C"),
        ingestUrl: "rtmp://ingest.stream-test.local/live",
        streamKey: "sk-camera-c",
        playbackUrl: "https://cdn.stream-test.local/c/index.m3u8",
      }) as any,
      {}
    )
    expect(created.status).toBe(201)
    const cameraC = (await created.json()).channel.id

    // The scorekeeper of Court 1's 6pm game taps the tile showing their gym.
    // No new authorization rule: if the scoring console trusts them here,
    // so does this.
    actAs(scorekeeperId)
    const claim = await placementPost(
      jsonRequest("/api/admin/streams/placement", {
        channelId: cameraC,
        courtId: court1,
      }) as any,
      {}
    )
    expect(claim.status).toBe(200)
    const claimed = await claim.json()
    expect(claimed.mapped).toContain(g1a)
    expect(await streamRow(g1a)).toMatchObject({ channelId: cameraC, source: "AUTO" })

    // Through the route as well as the library: Camera A was standing on this
    // floor, so it has been moved off it. One floor, one camera.
    expect(claimed.displaced.map((d: any) => d.channelId)).toEqual([cameraA])
    expect(
      (await prisma.streamChannel.findUnique({ where: { id: cameraA } }))?.currentCourtId
    ).toBeNull()

    // Somebody with no game on that floor cannot move a camera onto it.
    actAs(outsiderId)
    const refused = await placementPost(
      jsonRequest("/api/admin/streams/placement", {
        channelId: cameraC,
        courtId: court2,
      }) as any,
      {}
    )
    expect(refused.status).toBe(403)

    await prisma.gameStream.deleteMany({ where: { channelId: cameraC } })
    await prisma.streamChannel.delete({ where: { id: cameraC } })

    // The third rig has gone home, so put Camera A back on its floor for the
    // rest of the suite.
    actAs(adminId)
    await placeChannel({ channelId: cameraA, courtId: court1, actorId: adminId, now: QUIET() })
    expect(await streamRow(g1a)).toMatchObject({ channelId: cameraA, source: "AUTO" })
  })

  it("offers the scorekeeper only cameras that could be in the room, never the whole fleet", async () => {
    // canScoreGame() admits team managers and assistant coaches of either
    // team, so this list reaches a few hundred people on a Saturday and every
    // entry carries a playbackUrl that needs no further sign-in. An unscoped
    // list would therefore be a permanent window into every gym we film,
    // including leagues that never turned streaming on. Scope is the fix: a
    // camera you cannot physically see is a camera you are never offered.
    const farVenue = await prisma.venue.create({
      data: {
        name: world.ctx.name("Far Gym"),
        address: "1 Elsewhere Road",
        city: "Ottawa",
        state: "ON",
      },
      select: { id: true },
    })
    farVenueId = farVenue.id
    const farCourt = await prisma.court.create({
      data: { venueId: farVenue.id, name: "Court 1" },
      select: { id: true },
    })

    const far = await prisma.streamChannel.create({
      data: {
        name: world.ctx.name("Camera Far"),
        ingestUrl: "rtmp://ingest.stream-test.local/live",
        streamKey: KEY_FAR,
        playbackUrl: PLAY_FAR,
        currentCourtId: farCourt.id,
      },
      select: { id: true },
    })
    // Out of its bag, pointed at nothing yet: this one is offerable anywhere,
    // because it might be the rig standing beside the scorer's table.
    const spare = await prisma.streamChannel.create({
      data: {
        name: world.ctx.name("Camera Spare"),
        playbackUrl: "https://cdn.stream-test.local/spare/index.m3u8",
      },
      select: { id: true },
    })
    farChannelIds = [far.id, spare.id]

    const ask = async () => {
      const res = await candidatesGet(
        new NextRequest(`http://localhost:3000/api/games/${g1a}/stream/candidates`),
        { params: { id: g1a } }
      )
      expect(res.status).toBe(200)
      return res.json()
    }

    actAs(scorekeeperId)
    const body = await ask()
    const ids: string[] = body.channels.map((c: any) => c.id)

    // In this building: the rig on this floor, and the rig on Court 2.
    expect(ids).toContain(cameraA)
    expect(ids).toContain(cameraB)
    // Unplaced, so it could be anywhere, including here.
    expect(ids).toContain(spare.id)
    // Another building. The scorekeeper cannot see it, so tapping it could
    // only ever be a mistake or a look at somebody else's gym.
    expect(ids).not.toContain(far.id)

    // The confirm-by-picture flag still says which one is on THIS floor.
    expect(body.channels.find((c: any) => c.id === cameraA).placedAtThisCourt).toBe(true)
    expect(body.channels.find((c: any) => c.id === cameraB).placedAtThisCourt).toBe(false)

    // Nothing here is a push credential, and the far rig leaks nothing at all.
    const asText = JSON.stringify(body)
    expect(asText).not.toContain("ingestUrl")
    expect(asText).not.toContain("streamKey")
    expect(asText).not.toContain(KEY_A)
    expect(asText).not.toContain(KEY_FAR)
    expect(asText).not.toContain(PLAY_FAR)

    // Placement is court XOR venue, so the building form has to be read too:
    // a rig placed at THIS building shows up, and one placed at the far
    // building stays hidden.
    await prisma.streamChannel.update({
      where: { id: spare.id },
      data: { currentVenueId: venueId },
    })
    await prisma.streamChannel.update({
      where: { id: far.id },
      data: { currentCourtId: null, currentVenueId: farVenue.id },
    })
    const again = await ask()
    const againIds: string[] = again.channels.map((c: any) => c.id)
    expect(againIds).toContain(spare.id)
    expect(againIds).not.toContain(far.id)
    expect(JSON.stringify(again)).not.toContain(PLAY_FAR)

    await prisma.streamChannel.deleteMany({ where: { id: { in: farChannelIds } } })
    farChannelIds = []
    await prisma.venue.delete({ where: { id: farVenue.id } })
    farVenueId = null
  })

  it("shows the whole fleet under ?scope=all, and hands out a picture only for the room you are in", async () => {
    // At 100-200 cameras a scorekeeper has to be able to find a rig that was
    // carried in from another gym and whose placement row still says where it
    // used to be. `scope=all` is that escape hatch. What it must NOT become is
    // finding S2 again: playbackUrl needs no further sign-in and never
    // rotates, so the fleet's addresses cannot go out to everyone
    // canScoreGame() admits.
    const otherVenue = await prisma.venue.create({
      data: {
        name: world.ctx.name("Other Gym"),
        address: "9 Elsewhere Road",
        city: "Kingston",
        state: "ON",
      },
      select: { id: true },
    })
    scopeVenueId = otherVenue.id
    const otherCourt = await prisma.court.create({
      data: { venueId: otherVenue.id, name: "Court 1" },
      select: { id: true },
    })

    const PLAY_AWAY = "https://cdn.stream-test.local/away/index.m3u8"
    const PLAY_TAGGED = "https://cdn.stream-test.local/tagged/index.m3u8"

    // Standing in the other building. Never gets a picture, either scope.
    const away = await prisma.streamChannel.create({
      data: {
        name: world.ctx.name("Camera Away"),
        playbackUrl: PLAY_AWAY,
        streamKey: KEY_FAR,
        currentCourtId: otherCourt.id,
      },
      select: { id: true },
    })
    // TAGGED to this building but standing in the other one. The tag is a
    // finding aid, so it is LISTED by default; the tag is not presence, so it
    // gets no address.
    const tagged = await prisma.streamChannel.create({
      data: {
        name: world.ctx.name("Camera Tagged Home"),
        playbackUrl: PLAY_TAGGED,
        homeVenueId: venueId,
        currentCourtId: otherCourt.id,
      },
      select: { id: true },
    })
    scopeChannelIds = [away.id, tagged.id]

    const ask = async (scope?: "all") => {
      const url = `http://localhost:3000/api/games/${g1a}/stream/candidates${
        scope ? `?scope=${scope}` : ""
      }`
      const res = await candidatesGet(new NextRequest(url), { params: { id: g1a } })
      expect(res.status).toBe(200)
      return res.json()
    }

    actAs(scorekeeperId)

    const here = await ask()
    expect(here.scope).toBe("here")
    const hereIds: string[] = here.channels.map((c: any) => c.id)
    // In the room, so offered.
    expect(hereIds).toContain(cameraA)
    expect(hereIds).toContain(cameraB)
    // Tagged to this building, so offered — that is what the tag is FOR.
    expect(hereIds).toContain(tagged.id)
    // Neither here nor tagged here.
    expect(hereIds).not.toContain(away.id)
    // And the tagged one is listed WITHOUT an address, because it is standing
    // in somebody else's gym.
    const taggedHere = here.channels.find((c: any) => c.id === tagged.id)
    expect(taggedHere.playbackUrl).toBeNull()
    expect(taggedHere.homeVenueId).toBe(venueId)
    expect(taggedHere.placedElsewhere).toBe(true)
    expect(taggedHere.placedCourtName).toBe("Court 1")
    // The rig actually on this floor keeps its picture and its flag.
    expect(here.channels.find((c: any) => c.id === cameraA).playbackUrl).toBe(PLAY_A)
    expect(here.channels.find((c: any) => c.id === cameraA).placedAtThisCourt).toBe(true)
    expect(JSON.stringify(here)).not.toContain(PLAY_TAGGED)
    expect(JSON.stringify(here)).not.toContain(PLAY_AWAY)
    // The count is what lets the button say "Show all N cameras". A count is
    // not a leak.
    expect(here.fleetCount).toBeGreaterThanOrEqual(4)
    expect(here.building.id).toBe(venueId)

    const all = await ask("all")
    expect(all.scope).toBe("all")
    const allIds: string[] = all.channels.map((c: any) => c.id)
    // The whole fleet is reachable by NAME, which is the point.
    expect(allIds).toContain(away.id)
    expect(allIds).toContain(tagged.id)
    expect(allIds).toContain(cameraA)

    // THE RULE: an address only for cameras that are unplaced or in this
    // building. Everything else is a name, a tag and a placement.
    for (const channel of all.channels) {
      const inThisBuilding =
        channel.placedVenueId === venueId ||
        (!channel.placedCourtId && !channel.placedVenueId)
      expect(channel.playbackUrl === null).toBe(!inThisBuilding)
    }
    const asText = JSON.stringify(all)
    expect(asText).not.toContain(PLAY_AWAY)
    expect(asText).not.toContain(PLAY_TAGGED)
    expect(asText).not.toContain(KEY_FAR)
    expect(asText).not.toContain("ingestUrl")
    expect(asText).not.toContain("streamKey")

    // The far rig is still named well enough to be taken back by hand.
    const awayRow = all.channels.find((c: any) => c.id === away.id)
    expect(awayRow.name).toContain("Camera Away")
    expect(awayRow.placedCourtName).toBe("Court 1")
    expect(awayRow.placedVenueName).toContain("Other Gym")
    expect(awayRow.placedElsewhere).toBe(true)

    // Nobody who cannot score this game gets either scope.
    actAs(outsiderId)
    const refused = await candidatesGet(
      new NextRequest(`http://localhost:3000/api/games/${g1a}/stream/candidates?scope=all`),
      { params: { id: g1a } }
    )
    expect(refused.status).toBe(403)

    actAs(scorekeeperId)
    await prisma.streamChannel.deleteMany({ where: { id: { in: scopeChannelIds } } })
    scopeChannelIds = []
    await prisma.court.delete({ where: { id: otherCourt.id } })
    await prisma.venue.delete({ where: { id: otherVenue.id } })
    scopeVenueId = null
  })

  it("stamps a live probe and lets an idle one leave that stamp exactly where it was", async () => {
    // The message-per-status mapping is unit-tested in health.test.ts. What
    // needs a database is the ONE-WAY STAMP: a camera that goes idle must not
    // lose the record of the last time it had a picture, because "no picture
    // for 4 seconds" and "no picture since this morning" are different
    // problems and only the stamp tells them apart.
    const manifest = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\nseg-1.ts\n"
    const answer = (status: number, body: string | null) =>
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: unknown, init?: { method?: string }) => {
          const head = (init?.method ?? "GET").toUpperCase() === "HEAD"
          return new Response(head || status === 204 ? null : body, { status })
        })
      )

    try {
      answer(200, manifest)
      const [seen] = await probeChannels({ channelIds: [cameraA] })
      expect(seen).toMatchObject({ id: cameraA, live: true, state: "live", detail: null })
      expect(seen.lastSeenLiveAt).not.toBeNull()

      // The camera stops. Cloudflare answers 204 for a live input nobody is
      // broadcasting to, which is a normal state and not a broken address.
      answer(204, null)
      const [idle] = await probeChannels({ channelIds: [cameraA] })
      expect(idle).toMatchObject({
        live: false,
        state: "idle",
        detail: "No broadcast arriving. Start the camera pointed at this stream key.",
      })
      expect(idle.lastSeenLiveAt).toBe(seen.lastSeenLiveAt)
      const row = await prisma.streamChannel.findUnique({
        where: { id: cameraA },
        select: { lastSeenLiveAt: true },
      })
      expect(row?.lastSeenLiveAt?.toISOString()).toBe(seen.lastSeenLiveAt)

      // And a genuinely wrong address is still called out as one.
      answer(404, "NotFound: failed to fetch")
      const [gone] = await probeChannels({ channelIds: [cameraA] })
      expect(gone).toMatchObject({ live: false, state: "fault" })
      expect(gone.detail).toContain("Nothing is published at that address")
      expect(gone.lastSeenLiveAt).toBe(seen.lastSeenLiveAt)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
