import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  destroyWorld,
  createClub,
  createParentWithChildren,
  submitTeamToSeason,
  daysFromNow,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { GET as scoringGet } from "./scoring/route"
import { POST as lockPost } from "./scoring/lock/route"
import { POST as eventsPost, PATCH as eventsPatch } from "./events/route"
import { POST as finalizePost } from "./finalize/route"
import { GET as liveGet } from "@/app/api/live/[gameId]/route"
import { isPublicPath } from "@/lib/public-paths"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — live scoring (docs/live-scoring-design.md): console bootstrap authz,
 * single-device lock with takeover, idempotent append-only event stream,
 * void-based corrections, and finalize → scores + PlayerStat + COMPLETED
 * (what standings consume). Seed registry: 1114.
 */

let world: BuiltWorld
let leagueOwnerId: string
let clubAOwnerId: string
let clubBOwnerId: string
let outsiderId: string
let gameId: string
let teamAId: string
let teamBId: string
let aPlayers: string[] = []
let bPlayers: string[] = []

const DEVICE_A = "device-aaaaaaaa"
const DEVICE_B = "device-bbbbbbbb"

let evSeq = 0
const cid = () => `sc-ev-${String(++evSeq).padStart(6, "0")}`

const claim = (sessionId: string, takeover = false) =>
  lockPost(jsonRequest(`/api/games/${gameId}/scoring/lock`, { sessionId, takeover }), {
    params: { id: gameId },
  })
const appendEvents = (sessionId: string, events: unknown[]) =>
  eventsPost(jsonRequest(`/api/games/${gameId}/events`, { sessionId, events }), {
    params: { id: gameId },
  })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1114,
    leagues: [
      {
        seasons: [
          { status: "FINALIZED", divisions: [{ teams: 1, rosterSize: 6 }], sessions: [] },
        ],
      },
    ],
  })
  const season = world.leagues[0].seasons[0]
  leagueOwnerId = world.leagues[0].owner.id
  clubAOwnerId = season.feederClub!.owner.id
  const submissionA = season.divisions[0].submissions[0]
  teamAId = submissionA.teamId

  const clubB = await createClub(world.ctx, {})
  clubBOwnerId = clubB.owner.id
  const submissionB = await submitTeamToSeason(world.ctx, {
    seasonId: season.id,
    divisionId: season.divisions[0].id,
    tenantId: clubB.tenantId,
    ageGroup: "U12",
    seasonLabel: season.label,
    rosterSize: 6,
    status: "APPROVED",
  })
  teamBId = submissionB.teamId

  const family = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  outsiderId = family.parent.id

  aPlayers = submissionA.playerIds
  bPlayers = submissionB.playerIds

  gameId = (
    await prisma.game.create({
      data: {
        seasonId: season.id,
        homeTeamId: teamAId,
        awayTeamId: teamBId,
        scheduledAt: daysFromNow(0),
        duration: 60,
        status: "SCHEDULED",
      },
    })
  ).id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("console bootstrap", () => {
  it("club staff of a competing team gets game, config defaults, and both rosters", async () => {
    actAs(clubAOwnerId)
    const res = await scoringGet(
      jsonRequest(`/api/games/${gameId}/scoring`, undefined, "GET"),
      { params: { id: gameId } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.config.statDepth).toBe("STANDARD")
    expect(body.config.gameClockMode).toBe("SIMPLE") // owner-confirmed default
    expect(body.rosters.home).toHaveLength(6)
    expect(body.rosters.away).toHaveLength(6)
    expect(body.events).toHaveLength(0)
  })

  it("an unrelated user is refused", async () => {
    actAs(outsiderId)
    const res = await scoringGet(
      jsonRequest(`/api/games/${gameId}/scoring`, undefined, "GET"),
      { params: { id: gameId } }
    )
    expect(res.status).toBe(403)
  })
})

describe("single-device lock", () => {
  it("first device claims; a second is refused until it explicitly takes over", async () => {
    actAs(clubAOwnerId)
    expect((await claim(DEVICE_A)).status).toBe(200)

    actAs(clubBOwnerId)
    const refused = await claim(DEVICE_B)
    expect(refused.status).toBe(409)
    expect((await refused.json()).code).toBe("LOCK_HELD")

    expect((await claim(DEVICE_B, true)).status).toBe(200)

    // hand it back to device A for the rest of the suite
    actAs(clubAOwnerId)
    expect((await claim(DEVICE_A, true)).status).toBe(200)
  })
})

describe("append-only event stream", () => {
  const batch: any[] = []

  it("appends a batch, assigns sequences, and flips the game LIVE on PERIOD_START", async () => {
    batch.push(
      {
        clientEventId: cid(),
        eventType: "LINEUP",
        teamId: () => teamAId,
        metadata: { playerIds: aPlayers.slice(0, 5) },
      },
      {
        clientEventId: cid(),
        eventType: "LINEUP",
        teamId: () => teamBId,
        metadata: { playerIds: bPlayers.slice(0, 5) },
      },
      { clientEventId: cid(), eventType: "PERIOD_START", period: 1 },
      {
        clientEventId: cid(),
        eventType: "SCORE_2PT",
        teamId: () => teamAId,
        playerId: () => aPlayers[0],
        made: true,
        period: 1,
      },
      {
        clientEventId: cid(),
        eventType: "SCORE_3PT",
        teamId: () => teamBId,
        playerId: () => bPlayers[0],
        made: false,
        period: 1,
      }
    )
    const materialized = batch.map((e) => ({
      ...e,
      teamId: typeof e.teamId === "function" ? e.teamId() : e.teamId,
      playerId: typeof e.playerId === "function" ? e.playerId() : e.playerId,
    }))
    actAs(clubAOwnerId)
    const res = await appendEvents(DEVICE_A, materialized)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.appended).toBe(5)
    expect(body.maxSequence).toBe(5)

    const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } })
    expect(game.status).toBe("LIVE")

    // retry the SAME batch (offline queue re-send) → fully skipped
    const retry = await appendEvents(DEVICE_A, materialized)
    expect((await retry.json()).appended).toBe(0)
  })

  it("rejects appends from a device that doesn't hold the lock", async () => {
    actAs(clubBOwnerId)
    const res = await appendEvents(DEVICE_B, [
      { clientEventId: cid(), eventType: "SCORE_2PT", teamId: teamBId, playerId: bPlayers[0], made: true },
    ])
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("LOCK_HELD")
  })

  it("voids an event by clientEventId (undo)", async () => {
    actAs(clubAOwnerId)
    const twoPointer = batch[3].clientEventId
    const res = await eventsPatch(
      jsonRequest(
        `/api/games/${gameId}/events`,
        { sessionId: DEVICE_A, clientEventIds: [twoPointer], voided: true },
        "PATCH"
      ),
      { params: { id: gameId } }
    )
    expect(res.status).toBe(200)
    expect((await res.json()).updated).toBe(1)
  })
})

describe("finalize", () => {
  it("folds the stream into scores + PlayerStat rows and marks the game COMPLETED", async () => {
    actAs(clubAOwnerId)
    // the first 2PT was voided; add two fresh makes for the home side
    await appendEvents(DEVICE_A, [
      { clientEventId: cid(), eventType: "SCORE_2PT", teamId: teamAId, playerId: aPlayers[0], made: true, period: 1 },
      { clientEventId: cid(), eventType: "SCORE_2PT", teamId: teamAId, playerId: aPlayers[1], made: true, period: 1 },
      { clientEventId: cid(), eventType: "REBOUND", teamId: teamBId, playerId: bPlayers[1], metadata: { offensive: false }, period: 1 },
    ])

    const res = await finalizePost(
      jsonRequest(`/api/games/${gameId}/finalize`, undefined, "POST"),
      { params: { id: gameId } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.homeScore).toBe(4) // 2 makes; the voided one doesn't count
    expect(body.awayScore).toBe(0)

    const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } })
    expect(game.status).toBe("COMPLETED") // standings consume exactly this
    expect(game.homeScore).toBe(4)
    expect(game.finalizedAt).not.toBeNull()

    const stats = await prisma.playerStat.findMany({ where: { gameId } })
    const a0 = stats.find((s) => s.playerId === aPlayers[0])
    const b1 = stats.find((s) => s.playerId === bPlayers[1])
    expect(a0?.points).toBe(2)
    expect(b1?.rebounds).toBe(1)
  })

  it("re-finalizing is league-owner territory", async () => {
    actAs(clubAOwnerId)
    const refused = await finalizePost(
      jsonRequest(`/api/games/${gameId}/finalize`, undefined, "POST"),
      { params: { id: gameId } }
    )
    expect(refused.status).toBe(403)

    actAs(leagueOwnerId)
    const ok = await finalizePost(
      jsonRequest(`/api/games/${gameId}/finalize`, undefined, "POST"),
      { params: { id: gameId } }
    )
    expect(ok.status).toBe(200)
  })
})

describe("public live read", () => {
  it("is on the anonymous-read allowlist and serves events + rosters with no session", async () => {
    expect(isPublicPath(`/api/live/${gameId}`, "GET")).toBe(true)
    expect(isPublicPath(`/api/live/${gameId}`, "POST")).toBe(false)

    actAs(null)
    const res = await liveGet(
      jsonRequest(`/api/live/${gameId}`, undefined, "GET"),
      { params: { gameId } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.game.status).toBe("COMPLETED")
    expect(body.events.length).toBeGreaterThan(0)
    expect(body.players.length).toBe(12)
  })
})
