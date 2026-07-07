import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, createUser, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { GET as poolGET, POST as poolPOST } from "../referees/route"
import { GET as offersGET, POST as offerPOST } from "./route"
import { PATCH as respondPATCH } from "../../../referee-requests/[id]/route"
import { POST as availabilityPOST } from "../../../referee/availability/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — Uber-style referee booking: league pool, declared availability,
 * broadcast offers where the first accept wins the day and its games.
 */

let world: BuiltWorld
let leagueOwnerId: string
let leagueId: string
let dayId: string
let dayDate: Date
let ref1: string // declares availability
let ref2: string // accepts the broadcast
let ref3: string // NOT in the pool
let gameIds: string[] = []
let broadcastId: string

const addToPool = (userId: string) =>
  poolPOST(jsonRequest(`/api/leagues/${leagueId}/referees`, { userId }), {
    params: { id: leagueId },
  })

const listPool = async (query = "") =>
  (
    await poolGET(jsonRequest(`/api/leagues/${leagueId}/referees${query}`, undefined, "GET"), {
      params: { id: leagueId },
    })
  ).json()

const sendOffer = (body: unknown) =>
  offerPOST(jsonRequest(`/api/leagues/${leagueId}/referee-requests`, body), {
    params: { id: leagueId },
  })

const respond = (id: string, action: string) =>
  respondPATCH(jsonRequest(`/api/referee-requests/${id}`, { action }, "PATCH"), {
    params: { id },
  })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1121,
    leagues: [
      {
        seasons: [
          {
            status: "IN_PROGRESS",
            divisions: [{ teams: 2, rosterSize: 3, submissionStatus: "APPROVED" }],
            sessions: [{ days: 1, startInDays: 3 }],
          },
        ],
      },
    ],
  })
  const league = world.leagues[0]
  leagueOwnerId = league.owner.id
  leagueId = league.id
  const season = league.seasons[0]
  const day = season.sessions[0].days[0]
  dayId = day.id
  dayDate = new Date(day.date)

  const [r1, r2, r3] = await Promise.all([
    createUser(world.ctx, { localPart: "ref1", roles: [{ role: "Referee" }] }),
    createUser(world.ctx, { localPart: "ref2", roles: [{ role: "Referee" }] }),
    createUser(world.ctx, { localPart: "ref3", roles: [{ role: "Referee" }] }),
  ])
  ref1 = r1.id
  ref2 = r2.id
  ref3 = r3.id

  // Two games on the session day, 10:00 and 12:00 — accept should grab both
  const [subA, subB] = season.divisions[0].submissions
  for (const hour of [10, 12]) {
    const at = new Date(dayDate)
    at.setHours(hour, 0, 0, 0)
    const game = await prisma.game.create({
      data: {
        seasonId: season.id,
        homeTeamId: hour === 10 ? subA.teamId : subB.teamId,
        awayTeamId: hour === 10 ? subB.teamId : subA.teamId,
        dayId,
        scheduledAt: at,
        duration: 90,
        status: "SCHEDULED",
      },
      select: { id: true },
    })
    gameIds.push(game.id)
  }
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("referee booking (integration)", () => {
  it("the league builds its own referee pool", async () => {
    actAs(leagueOwnerId)
    expect((await addToPool(ref1)).status).toBe(201)
    expect((await addToPool(ref2)).status).toBe(201)
    const pool = await listPool()
    expect(pool.referees.map((r: any) => r.userId).sort()).toEqual([ref1, ref2].sort())
  })

  it("declared availability shows when the league picks a day and shift", async () => {
    actAs(ref1)
    const dateStr = dayDate.toISOString().slice(0, 10)
    const res = await availabilityPOST(
      jsonRequest("/api/referee/availability", { date: dateStr, startTime: "09:00", endTime: "18:00" })
    )
    expect(res.status).toBe(201)

    actAs(leagueOwnerId)
    const pool = await listPool(`?date=${dateStr}&start=10:00&end=15:00`)
    const byId = new Map(pool.referees.map((r: any) => [r.userId, r.availability]))
    expect(byId.get(ref1)).toBe("available")
    expect(byId.get(ref2)).toBe("unknown")
  })

  it("broadcast offer notifies the whole pool", async () => {
    actAs(leagueOwnerId)
    const res = await sendOffer({ sessionDayId: dayId, startTime: "09:00", endTime: "18:00" })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.notified).toBe(2)
    broadcastId = body.requestId

    const bells = await prisma.notification.count({
      where: { type: "referee_request", referenceId: broadcastId },
    })
    expect(bells).toBe(2)

    // Only one live offer per day
    expect((await sendOffer({ sessionDayId: dayId, startTime: "09:00", endTime: "18:00" })).status).toBe(409)
  })

  it("a referee outside the pool cannot take a broadcast", async () => {
    actAs(ref3)
    expect((await respond(broadcastId, "accept")).status).toBe(403)
  })

  it("first accept wins the day and is auto-assigned to its games", async () => {
    actAs(ref2)
    const res = await respond(broadcastId, "accept")
    expect(res.status).toBe(200)
    expect((await res.json()).gamesAssigned).toBe(2)

    for (const gameId of gameIds) {
      const role = await prisma.userRole.findFirst({
        where: { userId: ref2, role: "Referee", gameId },
        select: { id: true },
      })
      expect(role).not.toBeNull()
    }

    // The league hears about it; the runner-up gets a clean 409
    const bell = await prisma.notification.findFirst({
      where: { userId: leagueOwnerId, type: "referee_request_accepted" },
      select: { id: true },
    })
    expect(bell).not.toBeNull()

    actAs(ref1)
    expect((await respond(broadcastId, "accept")).status).toBe(409)
  })

  it("targeted offers can be declined (league notified) or cancelled by the league", async () => {
    actAs(leagueOwnerId)
    const offer1 = await (
      await sendOffer({ sessionDayId: dayId, startTime: "09:00", endTime: "12:00", targetUserId: ref1 })
    ).json()

    actAs(ref1)
    expect((await respond(offer1.requestId, "decline")).status).toBe(200)
    const declineBell = await prisma.notification.findFirst({
      where: { userId: leagueOwnerId, type: "referee_request_declined" },
      select: { id: true },
    })
    expect(declineBell).not.toBeNull()

    actAs(leagueOwnerId)
    const offer2 = await (
      await sendOffer({ sessionDayId: dayId, startTime: "13:00", endTime: "18:00", targetUserId: ref1 })
    ).json()
    expect((await respond(offer2.requestId, "cancel")).status).toBe(200)

    const listed = await (
      await offersGET(jsonRequest(`/api/leagues/${leagueId}/referee-requests`, undefined, "GET"), {
        params: { id: leagueId },
      })
    ).json()
    const statuses = listed.requests.map((r: any) => r.status).sort()
    expect(statuses).toEqual(["ACCEPTED", "CANCELLED", "DECLINED"])
  })
})
