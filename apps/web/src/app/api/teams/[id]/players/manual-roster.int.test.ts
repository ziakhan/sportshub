import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  createParentWithChildren,
  createUser,
  destroyWorld,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { GET as candidatesGET, POST as addPOST } from "./route"
import { PATCH as playerPATCH } from "./[playerId]/route"
import { GET as refGET, POST as refPOST, DELETE as refDELETE } from "../../../games/[id]/referee/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — the manual escape hatches: coaches add/release players and fix
 * jersey numbers by hand (audited, clash-guarded); referees get assigned
 * at game time by whoever runs the scoring.
 */

let world: BuiltWorld
let coachId: string
let parentOutsiderId: string
let teamId: string
let tenantId: string
let playerA: string
let playerB: string
let gameId: string
let refereeUserId: string

const addPlayer = (body: unknown) =>
  addPOST(jsonRequest(`/api/teams/${teamId}/players`, body), { params: { id: teamId } })

const patchPlayer = (playerId: string, body: unknown) =>
  playerPATCH(jsonRequest(`/api/teams/${teamId}/players/${playerId}`, body, "PATCH"), {
    params: { id: teamId, playerId },
  })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1120,
    clubs: [{ teams: [{ headCoach: true }] }],
  })
  const club = world.clubs[0]
  teamId = club.teams[0].id
  tenantId = club.tenantId
  coachId = club.teams[0].headCoach!.id

  const familyA = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  const familyB = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  playerA = familyA.players[0].id
  playerB = familyB.players[0].id
  parentOutsiderId = familyB.parent.id
  // Link both players to the club so they show as candidates (a tryout signup)
  const tryout = await prisma.tryout.create({
    data: {
      tenantId,
      title: "Linkage tryout",
      ageGroup: "U12",
      location: "Gym",
      scheduledAt: new Date(),
      fee: 0,
      isPublished: false,
    },
    select: { id: true },
  })
  for (const [pid, family] of [
    [playerA, familyA],
    [playerB, familyB],
  ] as const) {
    await prisma.tryoutSignup.create({
      data: {
        tryoutId: tryout.id,
        userId: family.parent.id,
        playerId: pid,
        playerName: "Kid",
        playerAge: 12,
        playerGender: "MALE",
      },
    })
  }

  // A game + a referee for the game-day assignment flow
  const opponentClub = world.clubs[0] // same club scrimmage is fine for authz
  const teamB = await prisma.team.create({
    data: { tenantId: opponentClub.tenantId, name: `${world.ctx.name("Scrim B")}`, ageGroup: "U12", gender: "MALE" },
    select: { id: true },
  })
  const game = await prisma.game.create({
    data: {
      homeTeamId: teamId,
      awayTeamId: teamB.id,
      scheduledAt: new Date(Date.now() + 3600_000),
      duration: 90,
      status: "SCHEDULED",
    },
    select: { id: true },
  })
  gameId = game.id

  const ref = await createUser(world.ctx, { localPart: "ref", roles: [{ role: "Referee" }] })
  refereeUserId = ref.id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("manual roster controls (integration)", () => {
  it("the head coach can add a club-linked player with a jersey number", async () => {
    actAs(coachId)
    const candidates = await (
      await candidatesGET(jsonRequest(`/api/teams/${teamId}/players`, undefined, "GET"), {
        params: { id: teamId },
      })
    ).json()
    expect(candidates.candidates.map((c: any) => c.id)).toContain(playerA)

    const res = await addPlayer({ playerId: playerA, jerseyNumber: 23 })
    expect(res.status).toBe(201)

    const audit = await prisma.auditLog.findFirst({
      where: { action: "ROSTER_PLAYER_ADD", tenantId },
      select: { id: true },
    })
    expect(audit).not.toBeNull()
  })

  it("jersey clashes 409 instead of silently double-booking a number", async () => {
    actAs(coachId)
    const res = await addPlayer({ playerId: playerB, jerseyNumber: 23 })
    expect(res.status).toBe(409)

    const ok = await addPlayer({ playerId: playerB, jerseyNumber: 7 })
    expect(ok.status).toBe(201)
  })

  it("manual jersey change works and is audited; clash still guarded", async () => {
    actAs(coachId)
    expect((await patchPlayer(playerB, { jerseyNumber: 23 })).status).toBe(409)
    expect((await patchPlayer(playerB, { jerseyNumber: 11 })).status).toBe(200)

    const audit = await prisma.auditLog.findFirst({
      where: { action: "ROSTER_JERSEY_CHANGE", tenantId },
      select: { changes: true },
    })
    expect(audit).not.toBeNull()
  })

  it("release keeps history (INACTIVE + leftAt) and the player can return", async () => {
    actAs(coachId)
    expect((await patchPlayer(playerB, { action: "release" })).status).toBe(200)
    const row = await prisma.teamPlayer.findUniqueOrThrow({
      where: { teamId_playerId: { teamId, playerId: playerB } },
      select: { status: true, leftAt: true },
    })
    expect(row.status).toBe("INACTIVE")
    expect(row.leftAt).not.toBeNull()

    expect((await patchPlayer(playerB, { action: "reactivate" })).status).toBe(200)
  })

  it("an unrelated parent has no roster authority", async () => {
    actAs(parentOutsiderId)
    expect((await addPlayer({ playerId: playerA })).status).toBe(403)
    expect((await patchPlayer(playerA, { jerseyNumber: 5 })).status).toBe(403)
  })
})

describe("game-day referee assignment (integration)", () => {
  const assign = async (userId: string) =>
    (await refPOST(jsonRequest(`/api/games/${gameId}/referee`, { userId }), {
      params: { id: gameId },
    }))!

  it("club staff can search the pool and assign a referee at game time", async () => {
    actAs(coachId)
    const poolRes = (await refGET(jsonRequest(`/api/games/${gameId}/referee`, undefined, "GET"), {
      params: { id: gameId },
    }))!
    const pool = await poolRes.json()
    expect(pool.pool.map((r: any) => r.userId)).toContain(refereeUserId)

    expect((await assign(refereeUserId)).status).toBe(201)
    expect((await assign(refereeUserId)).status).toBe(409) // no double-assign

    const role = await prisma.userRole.findFirst({
      where: { userId: refereeUserId, role: "Referee", gameId },
      select: { id: true },
    })
    expect(role).not.toBeNull()

    const bell = await prisma.notification.findFirst({
      where: { userId: refereeUserId, referenceId: gameId },
      select: { id: true },
    })
    expect(bell).not.toBeNull()
  })

  it("unassign removes the game role", async () => {
    actAs(coachId)
    const res = (await refDELETE(
      jsonRequest(`/api/games/${gameId}/referee?userId=${refereeUserId}`, undefined, "DELETE"),
      { params: { id: gameId } }
    ))!
    expect(res.status).toBe(200)
    const role = await prisma.userRole.findFirst({
      where: { userId: refereeUserId, role: "Referee", gameId },
    })
    expect(role).toBeNull()
  })

  it("outsiders cannot assign referees", async () => {
    actAs(parentOutsiderId)
    expect((await assign(refereeUserId)).status).toBe(403)
  })
})
