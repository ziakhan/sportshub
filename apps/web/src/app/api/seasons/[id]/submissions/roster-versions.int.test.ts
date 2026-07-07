import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  createParentWithChildren,
  destroyWorld,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST as submitPOST } from "../submit/route"
import { PATCH as rosterPATCH, POST as requestPOST } from "./[submissionId]/roster/route"
import { PATCH as resolvePATCH } from "../../../roster-requests/[id]/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — league roster VERSIONS: a club submits a selected subset of its
 * roster per league, cross-club conflicts are blocked, and the lock policy
 * drives edit vs request-approve (commissioner counterpart included).
 */

let world: BuiltWorld
let clubOwnerId: string
let leagueOwnerId: string
let teamId: string
let seasonId: string
let divisionId: string
let playerIds: string[] // 15 ACTIVE players on the club team
let conflictedPlayerId: string // also on another club's submitted roster
let submissionId: string
let rosterId: string

const submit = (body: unknown) =>
  submitPOST(jsonRequest(`/api/seasons/${seasonId}/submit`, body), { params: { id: seasonId } })

const patchRoster = (ids: string[]) =>
  rosterPATCH(
    jsonRequest(`/api/seasons/${seasonId}/submissions/${submissionId}/roster`, { playerIds: ids }, "PATCH"),
    { params: { id: seasonId, submissionId } }
  )

const requestChange = (message: string) =>
  requestPOST(
    jsonRequest(`/api/seasons/${seasonId}/submissions/${submissionId}/roster`, { message }),
    { params: { id: seasonId, submissionId } }
  )

const resolveRequest = (requestId: string, action: string, note?: string) =>
  resolvePATCH(jsonRequest(`/api/roster-requests/${requestId}`, { action, note }, "PATCH"), {
    params: { id: requestId },
  })

const rosterState = async () => {
  const roster = await prisma.seasonRoster.findUniqueOrThrow({
    where: { id: rosterId },
    select: { isLocked: true, _count: { select: { players: true } } },
  })
  return { isLocked: roster.isLocked, players: roster._count.players }
}

beforeAll(async () => {
  world = await buildWorld({
    seed: 1119,
    clubs: [{ teams: [{}] }],
    leagues: [
      {
        seasons: [
          {
            status: "REGISTRATION",
            divisions: [{ teams: 1, rosterSize: 3, submissionStatus: "APPROVED" }],
            venue: false,
            sessions: [],
          },
        ],
      },
    ],
  })
  const club = world.clubs[0]
  clubOwnerId = club.owner.id
  teamId = club.teams[0].id
  const season = world.leagues[0].seasons[0]
  leagueOwnerId = world.leagues[0].owner.id
  seasonId = season.id
  divisionId = season.divisions[0].id

  // 15-player club roster
  const family = await createParentWithChildren(world.ctx, {
    children: Array.from({ length: 15 }, () => ({ age: 12 })),
  })
  playerIds = family.players.map((p) => p.id)
  for (let i = 0; i < playerIds.length; i++) {
    await prisma.teamPlayer.create({
      data: { teamId, playerId: playerIds[i], status: "ACTIVE", jerseyNumber: i + 4 },
    })
  }

  // One extra player who ALREADY plays this season for the feeder club —
  // adding them to our club team creates the eligibility conflict.
  conflictedPlayerId = season.divisions[0].submissions[0].playerIds[0]
  await prisma.teamPlayer.create({
    data: { teamId, playerId: conflictedPlayerId, status: "ACTIVE", jerseyNumber: 99 },
  })
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("league roster versions (integration)", () => {
  it("blocks a submission containing a player already rostered with another club this season", async () => {
    actAs(clubOwnerId)
    const res = await submit({
      teamId,
      divisionId,
      playerIds: [playerIds[0], conflictedPlayerId],
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.conflicts).toHaveLength(1)
    expect(body.conflicts[0].playerId).toBe(conflictedPlayerId)
  })

  it("submits a 12-of-16 roster version — the league sees only the selection", async () => {
    actAs(clubOwnerId)
    const selection = playerIds.slice(0, 12)
    const res = await submit({ teamId, divisionId, playerIds: selection })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.playerCount).toBe(12)
    submissionId = body.leagueTeamId
    rosterId = body.rosterId

    expect(await rosterState()).toEqual({ isLocked: false, players: 12 })
  })

  it("club edits the version freely while the season is in registration", async () => {
    actAs(clubOwnerId)
    const res = await patchRoster(playerIds.slice(0, 10))
    expect(res.status).toBe(200)
    expect(await rosterState()).toEqual({ isLocked: false, players: 10 })
  })

  it("locked + REQUEST_ONLY: direct edit is refused but a request is offered", async () => {
    // Simulate season finalization: roster locks, season moves on
    await prisma.seasonRoster.update({
      where: { id: rosterId },
      data: { isLocked: true, lockedAt: new Date() },
    })
    await prisma.season.update({ where: { id: seasonId }, data: { status: "IN_PROGRESS" } })

    actAs(clubOwnerId)
    const res = await patchRoster(playerIds.slice(0, 11))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe("ROSTER_LOCKED")
    expect(body.canRequest).toBe(true)
  })

  it("club requests a change; the commissioner is notified; duplicates are blocked", async () => {
    actAs(clubOwnerId)
    const res = await requestChange("Injury call-up: need to add two Grade 8 players.")
    expect(res.status).toBe(201)

    const bell = await prisma.notification.findFirst({
      where: { userId: leagueOwnerId, type: "roster_change_requested" },
      select: { id: true },
    })
    expect(bell).not.toBeNull()

    const dup = await requestChange("Second thoughts, one more ask")
    expect(dup.status).toBe(409)
  })

  it("only the league side can resolve; approval unlocks for exactly one save", async () => {
    const request = await prisma.rosterChangeRequest.findFirstOrThrow({
      where: { rosterId, status: "PENDING" },
      select: { id: true },
    })

    // The club owner cannot resolve their own request
    actAs(clubOwnerId)
    expect((await resolveRequest(request.id, "approve")).status).toBe(403)

    // Commissioner approves → roster unlocks, club is notified
    actAs(leagueOwnerId)
    const approved = await resolveRequest(request.id, "approve", "Two additions max, please")
    expect(approved.status).toBe(200)
    expect((await rosterState()).isLocked).toBe(false)
    const clubBell = await prisma.notification.findFirst({
      where: { userId: clubOwnerId, type: "roster_change_approved" },
      select: { id: true },
    })
    expect(clubBell).not.toBeNull()

    // Resolving twice is refused
    expect((await resolveRequest(request.id, "deny")).status).toBe(409)

    // The club's next save applies AND re-locks (one-shot window)
    actAs(clubOwnerId)
    const save = await patchRoster(playerIds.slice(0, 12))
    expect(save.status).toBe(200)
    expect((await save.json()).relocked).toBe(true)
    expect(await rosterState()).toEqual({ isLocked: true, players: 12 })
    const updateBell = await prisma.notification.findFirst({
      where: { userId: leagueOwnerId, type: "roster_updated" },
      select: { id: true },
    })
    expect(updateBell).not.toBeNull()
  })

  it("CLOSED policy refuses even the request", async () => {
    await prisma.season.update({
      where: { id: seasonId },
      data: { rosterChangePolicy: "CLOSED" },
    })
    actAs(clubOwnerId)
    const res = await requestChange("Please?")
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("POLICY_CLOSED")
  })

  it("OPEN_UNTIL_DEADLINE lets clubs edit a locked roster until the deadline", async () => {
    await prisma.season.update({
      where: { id: seasonId },
      data: {
        rosterChangePolicy: "OPEN_UNTIL_DEADLINE",
        rosterChangeDeadline: new Date(Date.now() + 7 * 86400_000),
      },
    })
    actAs(clubOwnerId)
    const res = await patchRoster(playerIds.slice(0, 13))
    expect(res.status).toBe(200)
    expect((await rosterState()).players).toBe(13)

    // Past the deadline it falls back to request-only
    await prisma.season.update({
      where: { id: seasonId },
      data: { rosterChangeDeadline: new Date(Date.now() - 86400_000) },
    })
    const refused = await patchRoster(playerIds.slice(0, 14))
    expect(refused.status).toBe(409)
    expect((await refused.json()).canRequest).toBe(true)
  })

  it("an outsider cannot touch the roster or the request queue", async () => {
    const outsider = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
    actAs(outsider.parent.id)
    expect((await patchRoster(playerIds.slice(0, 5))).status).toBe(403)
    expect((await requestChange("Let me in")).status).toBe(403)
  })
})
