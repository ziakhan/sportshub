import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { buildVenueWeekendGrid } from "./venue-grid"
import {
  applyVenueCourtsToAllSeasons,
  applyVenueCourtsToSessionDays,
  defaultCourtIdsForVenue,
} from "./venue-propagation"

/**
 * Court edits reach the weekends (owner hit this live 2026-08-02: the season's
 * gyms were set to 6 and 3 courts, the calendar still planned on the court set
 * wired when the gyms were attached, and step 3 painted red).
 *
 * The contract:
 *   - fewer courts: every existing weekend loses them, in one call
 *   - more courts: every existing weekend gains them, in fill order
 *   - a court a GAME is on is never pulled out from under it — that day keeps
 *     it and is reported, the other days still rewire
 *   - never across seasons, never down to zero courts
 */

let world: BuiltWorld
let seasonId: string
let venueId: string
let courtIds: string[]
let sessionA: string
let sessionB: string

const dayVenues = () =>
  (prisma as any).seasonSessionDayVenue.findMany({
    where: { venueId, day: { session: { seasonId } } },
    select: {
      id: true,
      dayId: true,
      courts: { orderBy: { order: "asc" }, select: { courtId: true, order: true } },
    },
  })

/** Court ids per weekend day, in fill order — what the scheduler reads. */
const wiring = async (): Promise<string[][]> =>
  (await dayVenues()).map((dv: any) => dv.courts.map((c: any) => c.courtId))

beforeAll(async () => {
  world = await buildWorld({
    seed: 1144,
    leagues: [
      {
        seasons: [
          {
            status: "REGISTRATION",
            divisions: [{ teams: 2, rosterSize: 1, submissionStatus: "APPROVED" }],
            venue: { courts: 4, open: "09:00", close: "21:00" },
            sessions: [
              { days: 2, startInDays: 7 },
              { days: 2, startInDays: 14 },
            ],
          },
        ],
      },
    ],
  })
  const season = world.leagues[0].seasons[0]
  seasonId = season.id
  venueId = season.venue!.id
  courtIds = season.venue!.courtIds
  sessionA = season.sessions[0].id
  sessionB = season.sessions[1].id
})

afterAll(async () => {
  await destroyWorld(world.ctx)
})

describe("applyVenueCourtsToSessionDays", () => {
  it("starts from the world's wiring: every weekend day on all four courts", async () => {
    const rows = await wiring()
    expect(rows).toHaveLength(4) // 2 sessions x 2 days
    for (const r of rows) expect(new Set(r)).toEqual(new Set(courtIds))
  })

  it("drops courts from EVERY existing weekend, not just new ones", async () => {
    const two = courtIds.slice(0, 2)
    const result = await applyVenueCourtsToSessionDays(seasonId, venueId, two)

    expect(result.daysRewired).toBe(4)
    expect(result.daysBlocked).toBe(0)
    expect(result.courtsRemoved).toBe(8) // 2 courts x 4 days
    expect(result.courtsAdded).toBe(0)
    for (const r of await wiring()) expect(r).toEqual(two)

    // The number the planner counts moves with it.
    const grid = await buildVenueWeekendGrid(seasonId)
    const row = grid.venues.find((v) => v.venueId === venueId)!
    for (const cell of row.cells.filter((c) => c.state !== "off")) expect(cell.courts).toBe(2)
  })

  it("adds courts back to every weekend, in the season's fill order", async () => {
    const result = await applyVenueCourtsToSessionDays(seasonId, venueId, courtIds)

    expect(result.daysRewired).toBe(4)
    expect(result.courtsAdded).toBe(8)
    expect(result.courtsRemoved).toBe(0)
    for (const r of await wiring()) expect(r).toEqual(courtIds)

    const grid = await buildVenueWeekendGrid(seasonId)
    const row = grid.venues.find((v) => v.venueId === venueId)!
    for (const cell of row.cells.filter((c) => c.state !== "off")) expect(cell.courts).toBe(4)
  })

  it("re-orders an existing court set without adding or removing anything", async () => {
    const reversed = [...courtIds].reverse()
    const result = await applyVenueCourtsToSessionDays(seasonId, venueId, reversed)
    expect(result.courtsAdded).toBe(0)
    expect(result.courtsRemoved).toBe(0)
    expect(result.daysRewired).toBe(4)
    for (const r of await wiring()) expect(r).toEqual(reversed)

    await applyVenueCourtsToSessionDays(seasonId, venueId, courtIds)
  })

  it("is a no-op when the wiring already matches", async () => {
    const result = await applyVenueCourtsToSessionDays(seasonId, venueId, courtIds)
    expect(result).toEqual({
      daysRewired: 0,
      daysBlocked: 0,
      courtsAdded: 0,
      courtsRemoved: 0,
      blockedCourtIds: [],
    })
  })

  it("leaves a court a game is already on, and rewires the other days anyway", async () => {
    const rows = await dayVenues()
    const held = rows.find((dv: any) => dv.dayId)!
    const heldCourt = courtIds[3]
    const subs = world.leagues[0].seasons[0].divisions[0].submissions
    const game = await (prisma as any).game.create({
      data: {
        seasonId,
        sessionId: sessionA,
        dayId: held.dayId,
        dayVenueId: held.id,
        venueId,
        courtId: heldCourt,
        homeTeamId: subs[0].teamId,
        awayTeamId: subs[1].teamId,
        scheduledAt: new Date(),
        duration: 60,
        status: "SCHEDULED",
      },
    })

    const two = courtIds.slice(0, 2)
    const result = await applyVenueCourtsToSessionDays(seasonId, venueId, two)

    expect(result.daysBlocked).toBe(1)
    expect(result.blockedCourtIds).toEqual([heldCourt])
    expect(result.daysRewired).toBe(4)

    for (const dv of await dayVenues()) {
      const ids = dv.courts.map((c: any) => c.courtId)
      if (dv.id === held.id) {
        // The two the season wants, then the one the game is holding.
        expect(ids).toEqual([...two, heldCourt])
      } else {
        expect(ids).toEqual(two)
      }
    }

    await (prisma as any).game.delete({ where: { id: game.id } })
    await applyVenueCourtsToSessionDays(seasonId, venueId, courtIds)
  })

  it("blocks on a legacy game that has a day and a venue but no dayVenueId", async () => {
    const rows = await dayVenues()
    const held = rows[0]
    const heldCourt = courtIds[2]
    const subs = world.leagues[0].seasons[0].divisions[0].submissions
    const game = await (prisma as any).game.create({
      data: {
        seasonId,
        sessionId: sessionA,
        dayId: held.dayId,
        venueId,
        courtId: heldCourt,
        homeTeamId: subs[0].teamId,
        awayTeamId: subs[1].teamId,
        scheduledAt: new Date(),
        duration: 60,
        status: "SCHEDULED",
      },
    })

    const one = courtIds.slice(0, 1)
    const result = await applyVenueCourtsToSessionDays(seasonId, venueId, one)
    expect(result.daysBlocked).toBe(1)
    expect(result.blockedCourtIds).toEqual([heldCourt])

    for (const dv of await dayVenues()) {
      const ids = dv.courts.map((c: any) => c.courtId)
      expect(ids).toEqual(dv.id === held.id ? [...one, heldCourt] : one)
    }

    await (prisma as any).game.delete({ where: { id: game.id } })
    await applyVenueCourtsToSessionDays(seasonId, venueId, courtIds)
    for (const r of await wiring()) expect(r).toEqual(courtIds)
  })

  it("never wires a weekend down to no courts, and never crosses seasons", async () => {
    expect(await applyVenueCourtsToSessionDays(seasonId, venueId, [])).toEqual({
      daysRewired: 0,
      daysBlocked: 0,
      courtsAdded: 0,
      courtsRemoved: 0,
      blockedCourtIds: [],
    })

    const other = await applyVenueCourtsToSessionDays("not-this-season", venueId, courtIds.slice(0, 1))
    expect(other.daysRewired).toBe(0)
    for (const r of await wiring()) expect(r).toEqual(courtIds)
  })
})

describe("applyVenueCourtsToAllSeasons", () => {
  it("follows each season's own court count", async () => {
    await prisma.seasonVenue.updateMany({
      where: { seasonId, venueId },
      data: { courtsAvailable: 3 },
    })
    expect(await defaultCourtIdsForVenue(venueId, 3)).toEqual(courtIds.slice(0, 3))

    const result = await applyVenueCourtsToAllSeasons(venueId)
    expect(result.seasonsRewired).toBe(1)
    expect(result.daysRewired).toBe(4)
    for (const r of await wiring()) expect(r).toEqual(courtIds.slice(0, 3))
  })

  it("leaves a finalized season exactly as it was finalized", async () => {
    await prisma.season.update({ where: { id: seasonId }, data: { status: "FINALIZED" } })
    await prisma.seasonVenue.updateMany({
      where: { seasonId, venueId },
      data: { courtsAvailable: 4 },
    })

    const result = await applyVenueCourtsToAllSeasons(venueId)
    expect(result.seasonsRewired).toBe(0)
    expect(result.daysRewired).toBe(0)
    for (const r of await wiring()) expect(r).toEqual(courtIds.slice(0, 3))

    await prisma.season.update({ where: { id: seasonId }, data: { status: "REGISTRATION" } })
    const back = await applyVenueCourtsToAllSeasons(venueId)
    expect(back.seasonsRewired).toBe(1)
    for (const r of await wiring()) expect(r).toEqual(courtIds)
  })
})

describe("sessionB stays in step with sessionA", () => {
  it("both weekends carry the same court set after every rewire", async () => {
    const perSession = async (sessionId: string) =>
      (
        await (prisma as any).seasonSessionDayVenue.findMany({
          where: { venueId, day: { sessionId } },
          select: { courts: { orderBy: { order: "asc" }, select: { courtId: true } } },
        })
      ).map((dv: any) => dv.courts.map((c: any) => c.courtId))

    await applyVenueCourtsToSessionDays(seasonId, venueId, courtIds.slice(0, 2))
    expect(await perSession(sessionA)).toEqual(await perSession(sessionB))
    await applyVenueCourtsToSessionDays(seasonId, venueId, courtIds)
    expect(await perSession(sessionA)).toEqual(await perSession(sessionB))
  })
})
