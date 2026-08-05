import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { ensureWeekendSession } from "@/lib/seasons/venue-propagation"
import { POST } from "./route"
import { GET as GET_GRID } from "../planner/venues/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * Turning on a weekend the season does not have yet (planner step 2, owner
 * 2026-08-02: "make it open for every month, all weekends, and people can
 * choose because we currently don't have visibility"). One tap has to create
 * the weekend AND attach the gym, exactly once, behind the same gate as every
 * other structural edit.
 */

let world: BuiltWorld
let seasonId: string
let lockedSeasonId: string
let lockedSessionId: string
let venueId: string
let otherVenueId: string
let courtIds: string[]
let ownerId: string
let strangerId: string

/** A Saturday `weeks` from now, UTC — session days are UTC dates everywhere. */
function saturdayIn(weeks: number): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7))
  return d.toISOString().slice(0, 10)
}

const ctx = (id = seasonId) => ({ params: { id } })

const daysOf = (sessionId: string) =>
  (prisma as any).seasonSessionDay.findMany({
    where: { sessionId },
    orderBy: { date: "asc" },
    select: { date: true },
  })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1143,
    // League one exists only for its owner: a signed-in user with no business
    // touching league two's weekends.
    leagues: [
      { seasons: [] },
      {
        seasons: [
          {
            status: "REGISTRATION",
            divisions: [{ teams: 2, rosterSize: 1, submissionStatus: "APPROVED" }],
            venue: { courts: 2, open: "09:00", close: "21:00" },
            sessions: [{ days: 2, startInDays: 7 }],
          },
          {
            status: "FINALIZED",
            divisions: [{ teams: 2, rosterSize: 1, submissionStatus: "APPROVED" }],
            venue: { courts: 2 },
            sessions: [{ days: 2, startInDays: 21 }],
          },
        ],
      },
    ],
  })
  const league = world.leagues[1]
  ownerId = league.owner.id
  strangerId = world.leagues[0].owner.id
  seasonId = league.seasons[0].id
  lockedSeasonId = league.seasons[1].id
  lockedSessionId = league.seasons[1].sessions[0].id
  venueId = league.seasons[0].venue!.id
  otherVenueId = league.seasons[1].venue!.id
  courtIds = league.seasons[0].venue!.courtIds

  // The season's own window at the gym, so an inherited weekend can be told
  // apart from the venue's posted 09:00-21:00.
  const seasonVenue = await prisma.seasonVenue.findFirstOrThrow({ where: { seasonId, venueId } })
  for (const dayOfWeek of [0, 6]) {
    await (prisma as any).seasonVenueHours.upsert({
      where: { seasonVenueId_dayOfWeek: { seasonVenueId: seasonVenue.id, dayOfWeek } },
      create: { seasonVenueId: seasonVenue.id, dayOfWeek, openTime: "08:00", closeTime: "20:00" },
      update: { openTime: "08:00", closeTime: "20:00" },
    })
  }
})

afterAll(async () => {
  await destroyWorld(world.ctx)
})

describe("ensureWeekendSession", () => {
  it("creates the weekend with both days, named the way the season names them", async () => {
    const sat = saturdayIn(10)
    const result = await ensureWeekendSession(seasonId, sat)

    expect(result).not.toBeNull()
    expect(result!.created).toBe(true)

    const session = await (prisma as any).seasonSession.findUniqueOrThrow({
      where: { id: result!.sessionId },
      select: { seasonId: true, phase: true, label: true, targetGamesPerTeam: true },
    })
    expect(session.seasonId).toBe(seasonId)
    expect(session.phase).toBe("REGULAR")
    expect(session.label).toMatch(/^Weekend \d+ · [A-Z][a-z]{2} \d+$/)
    // No sibling says otherwise and the season sets no target: the 10/5/2 norm.
    expect(session.targetGamesPerTeam).toBe(2)

    const days = await daysOf(result!.sessionId)
    expect(days).toHaveLength(2)
    expect(days[0].date.toISOString().slice(0, 10)).toBe(sat)
    expect(days[0].date.getUTCDay()).toBe(6)
    expect(days[1].date.getUTCDay()).toBe(0)
  })

  it("is idempotent: the same Saturday never makes a second weekend", async () => {
    const sat = saturdayIn(10)
    const first = await ensureWeekendSession(seasonId, sat)
    const second = await ensureWeekendSession(seasonId, sat)

    expect(second!.sessionId).toBe(first!.sessionId)
    expect(second!.created).toBe(false)
    expect(await daysOf(first!.sessionId)).toHaveLength(2)
  })

  it("finds the weekend from its Sunday too", async () => {
    const sat = saturdayIn(10)
    const existing = await ensureWeekendSession(seasonId, sat)
    const sunday = new Date(`${sat}T00:00:00.000Z`)
    sunday.setUTCDate(sunday.getUTCDate() + 1)

    // A Sunday is not a weekend key — the grid only ever sends Saturdays.
    expect(await ensureWeekendSession(seasonId, sunday.toISOString())).toBeNull()

    // But a session sitting on that Sunday still owns the Saturday.
    expect((await ensureWeekendSession(seasonId, sat))!.sessionId).toBe(existing!.sessionId)
  })

  it("copies what its siblings play", async () => {
    await (prisma as any).seasonSession.updateMany({
      where: { seasonId, phase: "REGULAR" },
      data: { targetGamesPerTeam: 3 },
    })
    const created = await ensureWeekendSession(seasonId, saturdayIn(12))
    expect(created!.created).toBe(true)
    const session = await (prisma as any).seasonSession.findUniqueOrThrow({
      where: { id: created!.sessionId },
      select: { targetGamesPerTeam: true },
    })
    expect(session.targetGamesPerTeam).toBe(3)
  })

  it("never touches a finals weekend that already exists", async () => {
    const sat = saturdayIn(14)
    const playoff = await (prisma as any).seasonSession.create({
      data: { seasonId, label: "Finals", phase: "PLAYOFF" },
      select: { id: true },
    })
    for (const offset of [0, 1]) {
      const date = new Date(`${sat}T00:00:00.000Z`)
      date.setUTCDate(date.getUTCDate() + offset)
      await (prisma as any).seasonSessionDay.create({ data: { sessionId: playoff.id, date } })
    }

    const result = await ensureWeekendSession(seasonId, sat)
    expect(result).toEqual({ sessionId: playoff.id, created: false })
    const stillPlayoff = await (prisma as any).seasonSession.findUniqueOrThrow({
      where: { id: playoff.id },
      select: { phase: true },
    })
    expect(stillPlayoff.phase).toBe("PLAYOFF")
  })

  it("refuses a date that is not a Saturday, and a season that is not real", async () => {
    const sat = new Date(`${saturdayIn(16)}T00:00:00.000Z`)
    const tuesday = new Date(sat)
    tuesday.setUTCDate(tuesday.getUTCDate() + 3)

    expect(await ensureWeekendSession(seasonId, tuesday.toISOString())).toBeNull()
    expect(await ensureWeekendSession(seasonId, "not-a-date")).toBeNull()
    expect(await ensureWeekendSession("no-such-season", sat.toISOString())).toBeNull()

    const strays = await (prisma as any).seasonSession.count({
      where: { seasonId, days: { some: { date: tuesday } } },
    })
    expect(strays).toBe(0)
  })
})

describe("POST /api/seasons/[id]/weekends", () => {
  it("turns a stranger away without creating anything", async () => {
    actAs(strangerId)
    const sat = saturdayIn(18)
    const res = await POST(jsonRequest("/x", { satDate: sat, venueId }), ctx())
    expect(res.status).toBe(403)
    expect(
      await (prisma as any).seasonSession.count({
        where: { seasonId, days: { some: { date: new Date(`${sat}T00:00:00.000Z`) } } },
      })
    ).toBe(0)
  })

  it("turns away a signed-out visitor", async () => {
    actAs(null)
    const res = await POST(jsonRequest("/x", { satDate: saturdayIn(18), venueId }), ctx())
    expect(res.status).toBe(401)
  })

  it("creates the weekend and puts the gym on it with the season's hours", async () => {
    actAs(ownerId)
    const sat = saturdayIn(18)
    const res = await POST(jsonRequest("/x", { satDate: sat, venueId }), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, createdSession: true, daysAttached: 2 })

    const dayVenues = await (prisma as any).seasonSessionDayVenue.findMany({
      where: { venueId, day: { sessionId: body.sessionId } },
      select: { startTime: true, endTime: true, _count: { select: { courts: true } } },
    })
    expect(dayVenues).toHaveLength(2)
    for (const dv of dayVenues) {
      // SeasonVenueHours (08:00-20:00) wins over the gym's posted 09:00-21:00.
      expect(dv.startTime).toBe("08:00")
      expect(dv.endTime).toBe("20:00")
      expect(dv._count.courts).toBe(courtIds.length)
    }
  })

  it("shows that weekend as on in the grid, in date order", async () => {
    actAs(ownerId)
    const res = await GET_GRID(jsonRequest("/x", undefined, "GET"), ctx())
    expect(res.status).toBe(200)
    const { grid } = await res.json()

    const sat = `${saturdayIn(18)}T00:00:00.000Z`
    const idx = grid.weekends.findIndex((w: any) => w.satDateISO === sat)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(grid.weekends[idx].sessionId).toBeTruthy()
    const row = grid.venues.find((v: any) => v.venueId === venueId)
    expect(row.cells[idx].state).toBe("on")
    expect(row.cells[idx].courts).toBe(courtIds.length)
    // Weekends nobody has turned on are here too, and read off.
    expect(grid.weekends.some((w: any) => !w.sessionId)).toBe(true)
  })

  it("is idempotent: tapping the same weekend again changes nothing", async () => {
    actAs(ownerId)
    const sat = saturdayIn(18)
    const res = await POST(jsonRequest("/x", { satDate: sat, venueId }), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      success: true,
      createdSession: false,
      daysAttached: 0,
      alreadyAttached: 2,
    })
    expect(
      await (prisma as any).seasonSession.count({
        where: { seasonId, days: { some: { date: new Date(`${sat}T00:00:00.000Z`) } } },
      })
    ).toBe(1)
  })

  it("rejects a gym that is not on this season", async () => {
    actAs(ownerId)
    const res = await POST(
      jsonRequest("/x", { satDate: saturdayIn(20), venueId: otherVenueId }),
      ctx()
    )
    expect(res.status).toBe(404)
  })

  it("rejects courts that live at a different gym", async () => {
    actAs(ownerId)
    const foreign = world.leagues[1].seasons[1].venue!.courtIds
    const res = await POST(
      jsonRequest("/x", { satDate: saturdayIn(20), venueId, courtIds: foreign }),
      ctx()
    )
    expect(res.status).toBe(400)
  })

  it("rejects a date that is not a Saturday", async () => {
    actAs(ownerId)
    const sat = new Date(`${saturdayIn(20)}T00:00:00.000Z`)
    sat.setUTCDate(sat.getUTCDate() + 2)
    const notSaturday = await POST(
      jsonRequest("/x", { satDate: sat.toISOString(), venueId }),
      ctx()
    )
    expect(notSaturday.status).toBe(400)
  })

  /**
   * A WEEKEND WITH NO GYM NAMED (owner ruling 2026-08-05, plan worlds). Which
   * Saturdays exist is a fact about the SEASON's dates; which gym is on one is a
   * fact about the plan you are working in. So a plan that wants to run a
   * Saturday the season never created asks for the weekend alone and attaches
   * its gym inside its own document — and nothing is claimed on any gym's behalf.
   */
  it("creates the weekend alone when no gym is named, attaching nothing", async () => {
    actAs(ownerId)
    const sat = saturdayIn(26)
    const res = await POST(jsonRequest("/x", { satDate: sat }), ctx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.createdSession).toBe(true)
    expect(body.daysAttached).toBe(0)

    const session = await (prisma as any).seasonSession.findUnique({
      where: { id: body.sessionId },
      select: { days: { select: { date: true, dayVenues: { select: { id: true } } } } },
    })
    // Two days, and not one gym on either of them.
    expect(session.days).toHaveLength(2)
    expect(session.days.flatMap((d: any) => d.dayVenues)).toEqual([])

    // Idempotent: asking again gets the same weekend rather than a second one.
    const again = await (await POST(jsonRequest("/x", { satDate: sat }), ctx())).json()
    expect(again.sessionId).toBe(body.sessionId)
    expect(again.createdSession).toBe(false)

    await (prisma as any).seasonSession.delete({ where: { id: body.sessionId } })
  })

  it("refuses once the season is finalized", async () => {
    actAs(ownerId)
    const sat = saturdayIn(22)
    const res = await POST(
      jsonRequest("/x", { satDate: sat, venueId: otherVenueId }),
      ctx(lockedSeasonId)
    )
    expect(res.status).toBe(409)
    // The finalized season still has exactly the weekend it was built with.
    expect(await (prisma as any).seasonSession.count({ where: { seasonId: lockedSeasonId } })).toBe(1)
    expect(await daysOf(lockedSessionId)).toHaveLength(2)
  })

  it("404s on a season that does not exist", async () => {
    actAs(ownerId)
    const res = await POST(
      jsonRequest("/x", { satDate: saturdayIn(22), venueId }),
      ctx("no-such-season")
    )
    expect(res.status).toBe(404)
  })
})
