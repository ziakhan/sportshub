import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, createUser, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { GET as poolGET, POST as poolPOST } from "../referees/route"
import { GET as offersGET, POST as offerPOST } from "./route"
import { PATCH as respondPATCH } from "../../../referee-requests/[id]/route"
import { POST as availabilityPOST } from "../../../referee/availability/route"
import { POST as schedulePublishPOST } from "../../../seasons/[id]/schedule/publish/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — Uber-style referee booking: league pool, declared availability,
 * broadcast offers where the first accept wins the day and its games — and
 * the draft/publish reconcile (QA T-013): accept assigns PUBLISHED games
 * only, and publishing attaches an already-accepted shift's referee to the
 * newly published games inside the shift window.
 */

let world: BuiltWorld
let leagueOwnerId: string
let leagueId: string
let seasonId: string
let dayId: string
let dayDate: Date
/** Second session day, for the accept-over-drafts / publish-after-accept arc. */
let day2Id: string
let day2Date: Date
let ref1: string // declares availability
let ref2: string // accepts the broadcast
let ref3: string // NOT in the pool
let gameIds: string[] = []
let broadcastId: string
let day2Published: string
let day2Draft: string
let day2DraftLate: string

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
            sessions: [{ days: 2, startInDays: 3 }],
          },
        ],
      },
    ],
  })
  const league = world.leagues[0]
  leagueOwnerId = league.owner.id
  leagueId = league.id
  const season = league.seasons[0]
  seasonId = season.id
  const day = season.sessions[0].days[0]
  dayId = day.id
  dayDate = new Date(day.date)
  const day2 = season.sessions[0].days[1]
  day2Id = day2.id
  day2Date = new Date(day2.date)

  const [r1, r2, r3] = await Promise.all([
    createUser(world.ctx, { localPart: "ref1", roles: [{ role: "Referee" }] }),
    createUser(world.ctx, { localPart: "ref2", roles: [{ role: "Referee" }] }),
    createUser(world.ctx, { localPart: "ref3", roles: [{ role: "Referee" }] }),
  ])
  ref1 = r1.id
  ref2 = r2.id
  ref3 = r3.id

  const [subA, subB] = season.divisions[0].submissions
  const makeGame = async (
    onDayId: string,
    onDate: Date,
    hour: number,
    published: boolean
  ): Promise<string> => {
    const at = new Date(onDate)
    at.setHours(hour, 0, 0, 0)
    const game = await prisma.game.create({
      data: {
        seasonId: season.id,
        homeTeamId: hour % 4 < 2 ? subA.teamId : subB.teamId,
        awayTeamId: hour % 4 < 2 ? subB.teamId : subA.teamId,
        dayId: onDayId,
        scheduledAt: at,
        duration: 90,
        status: "SCHEDULED",
        ...(published ? { publishedAt: new Date() } : {}),
      } as any,
      select: { id: true },
    })
    return game.id
  }

  // Two PUBLISHED games on day 1, 10:00 and 12:00 — accept should grab both.
  // (Published, because accept assigns only published games since QA T-013a.)
  for (const hour of [10, 12]) gameIds.push(await makeGame(dayId, dayDate, hour, true))

  // Day 2 is the draft/publish arc: one published 10:00 game, one DRAFT
  // 12:00 game inside the shift window, one DRAFT 20:00 game outside it.
  day2Published = await makeGame(day2Id, day2Date, 10, true)
  day2Draft = await makeGame(day2Id, day2Date, 12, false)
  day2DraftLate = await makeGame(day2Id, day2Date, 20, false)
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

    // ...and so does the referee themselves (QA T-013a: the "assigned to N
    // games" message used to go to the league owner ONLY).
    const refBell = await prisma.notification.findFirst({
      where: { userId: ref2, type: "referee_shift_booked" },
      select: { message: true, link: true },
    })
    expect(refBell).not.toBeNull()
    expect(refBell!.message).toContain("2 games")
    // The referee's own schedule (QA T-012), not the generic calendar
    expect(refBell!.link).toBe("/referee")

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
  it("accept over a half-draft day assigns ONLY the published games and says what is pending", async () => {
    actAs(leagueOwnerId)
    const offer = await (
      await sendOffer({
        sessionDayId: day2Id,
        startTime: "09:00",
        endTime: "18:00",
        targetUserId: ref1,
      })
    ).json()

    actAs(ref1)
    const res = await respond(offer.requestId, "accept")
    expect(res.status).toBe(200)
    const body = await res.json()
    // The 10:00 published game only. The 12:00 draft is invisible to every
    // referee surface (PUBLISHED_GAME law), so accept must not book onto it.
    expect(body.gamesAssigned).toBe(1)
    // The 12:00 draft is inside the window and still coming; the 20:00 draft
    // is outside the shift and never counted.
    expect(body.draftGamesPending).toBe(1)

    const onPublished = await prisma.userRole.findFirst({
      where: { userId: ref1, role: "Referee", gameId: day2Published },
      select: { id: true },
    })
    expect(onPublished).not.toBeNull()
    for (const gameId of [day2Draft, day2DraftLate]) {
      const onDraft = await prisma.userRole.findFirst({
        where: { userId: ref1, role: "Referee", gameId },
        select: { id: true },
      })
      expect(onDraft).toBeNull()
    }
  })

  it("publishing the schedule attaches the accepted shift's referee to the newly published games in the window", async () => {
    actAs(leagueOwnerId)
    const res = await schedulePublishPOST(
      jsonRequest(`/api/seasons/${seasonId}/schedule/publish`, undefined),
      { params: { id: seasonId } }
    )
    expect(res.status).toBe(200)

    // The 12:00 game (inside ref1's 09:00-18:00 shift) is theirs now...
    const attached = await prisma.userRole.findFirst({
      where: { userId: ref1, role: "Referee", gameId: day2Draft },
      select: { id: true },
    })
    expect(attached).not.toBeNull()

    // ...the 20:00 game published too, but sits outside the shift window.
    const late = await (prisma as any).game.findUnique({
      where: { id: day2DraftLate },
      select: { publishedAt: true },
    })
    expect(late.publishedAt).not.toBeNull()
    const outside = await prisma.userRole.findFirst({
      where: { userId: ref1, role: "Referee", gameId: day2DraftLate },
      select: { id: true },
    })
    expect(outside).toBeNull()

    // And the referee heard their schedule grew.
    const bell = await prisma.notification.findFirst({
      where: { userId: ref1, type: "referee_shift_games_added" },
      select: { message: true },
    })
    expect(bell).not.toBeNull()
    expect(bell!.message).toContain("1 game")
  })

})
