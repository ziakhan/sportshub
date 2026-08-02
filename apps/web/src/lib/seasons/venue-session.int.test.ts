import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { buildVenueWeekendGrid } from "./venue-grid"
import {
  attachVenueToSession,
  detachVenueFromSession,
  setSessionVenueWindow,
} from "./venue-propagation"

/**
 * One gym, one weekend (planner step 2, owner 2026-08-02). The contract the
 * gyms-and-weekends grid rests on:
 *   - releasing a gym touches ONE weekend, never the others
 *   - putting it back inherits the season's hours for that weekday
 *   - a one-weekend hours exception never writes SeasonVenueHours
 *   - the grid reads on / off / custom straight off that substrate
 */

let world: BuiltWorld
let seasonId: string
let venueId: string
let courtIds: string[]
let sessionA: string
let sessionB: string

const dayVenueCount = (sessionId: string) =>
  (prisma as any).seasonSessionDayVenue.count({
    where: { venueId, day: { sessionId } },
  })

const courtCount = (sessionId: string) =>
  (prisma as any).seasonSessionDayVenueCourt.count({
    where: { dayVenue: { venueId, day: { sessionId } } },
  })

const cellFor = async (sessionId: string) => {
  const grid = await buildVenueWeekendGrid(seasonId)
  const row = grid.venues.find((v) => v.venueId === venueId)!
  const idx = grid.weekends.findIndex((w) => w.sessionId === sessionId)
  return { grid, row, cell: row.cells[idx] }
}

beforeAll(async () => {
  world = await buildWorld({
    seed: 1138,
    leagues: [
      {
        seasons: [
          {
            status: "REGISTRATION",
            divisions: [{ teams: 2, rosterSize: 1, submissionStatus: "APPROVED" }],
            venue: { courts: 3, open: "09:00", close: "21:00" },
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

  // The season's own scheduling window at the gym, all seven weekdays — the
  // default a re-attached weekend inherits and a custom cell differs from.
  const seasonVenue = await prisma.seasonVenue.findFirstOrThrow({
    where: { seasonId, venueId },
  })
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    await (prisma as any).seasonVenueHours.upsert({
      where: { seasonVenueId_dayOfWeek: { seasonVenueId: seasonVenue.id, dayOfWeek } },
      create: { seasonVenueId: seasonVenue.id, dayOfWeek, openTime: "08:00", closeTime: "20:00" },
      update: { openTime: "08:00", closeTime: "20:00" },
    })
  }
  // Align the seeded day-venues with that default so "custom" means custom.
  await (prisma as any).seasonSessionDayVenue.updateMany({
    where: { venueId, day: { session: { seasonId } } },
    data: { startTime: "08:00", endTime: "20:00" },
  })
})

afterAll(async () => {
  await destroyWorld(world.ctx)
})

describe("detachVenueFromSession", () => {
  it("releases the gym from ONE weekend and leaves the others alone", async () => {
    expect(await dayVenueCount(sessionA)).toBe(2)
    expect(await dayVenueCount(sessionB)).toBe(2)

    const result = await detachVenueFromSession(seasonId, sessionA, venueId)

    expect(result.daysReleased).toBe(2)
    expect(result.courtsReleased).toBe(6) // 3 courts × 2 days
    expect(result.gamesBlocking).toBe(0)
    expect(await dayVenueCount(sessionA)).toBe(0)
    expect(await courtCount(sessionA)).toBe(0)
    // The other weekend is untouched — this is the whole point of the cell.
    expect(await dayVenueCount(sessionB)).toBe(2)
    expect(await courtCount(sessionB)).toBe(6)
  })

  it("reads as released on the grid, and the other weekend still reads on", async () => {
    const a = await cellFor(sessionA)
    expect(a.cell.state).toBe("off")
    expect(a.cell.daysOn).toBe(0)
    expect(a.cell.courts).toBe(0)

    const b = await cellFor(sessionB)
    expect(b.cell.state).toBe("on")
    expect(b.cell.daysOn).toBe(2)
    expect(b.cell.courts).toBe(3)
  })

  it("is a no-op when the gym is already off that weekend", async () => {
    const result = await detachVenueFromSession(seasonId, sessionA, venueId)
    expect(result.daysReleased).toBe(0)
    expect(await dayVenueCount(sessionB)).toBe(2)
  })

  it("refuses to release a weekend that already has games there", async () => {
    const dayVenue = await (prisma as any).seasonSessionDayVenue.findFirstOrThrow({
      where: { venueId, day: { sessionId: sessionB } },
      select: { id: true, dayId: true },
    })
    const season = world.leagues[0].seasons[0]
    const subs = season.divisions[0].submissions
    const game = await (prisma as any).game.create({
      data: {
        seasonId,
        sessionId: sessionB,
        dayId: dayVenue.dayId,
        dayVenueId: dayVenue.id,
        venueId,
        homeTeamId: subs[0].teamId,
        awayTeamId: subs[1].teamId,
        scheduledAt: new Date(),
        duration: 60,
        status: "SCHEDULED",
      },
    })

    const result = await detachVenueFromSession(seasonId, sessionB, venueId)
    expect(result.gamesBlocking).toBe(1)
    expect(result.daysReleased).toBe(0)
    expect(await dayVenueCount(sessionB)).toBe(2)

    await (prisma as any).game.delete({ where: { id: game.id } })
  })

  it("will not reach across seasons", async () => {
    const result = await detachVenueFromSession("not-this-season", sessionB, venueId)
    expect(result.daysReleased).toBe(0)
    expect(await dayVenueCount(sessionB)).toBe(2)
  })
})

describe("attachVenueToSession", () => {
  it("puts the gym back on one weekend with its courts and the season's hours", async () => {
    const result = await attachVenueToSession(seasonId, sessionA, venueId, courtIds)

    expect(result.daysAttached).toBe(2)
    expect(result.alreadyAttached).toBe(0)
    expect(await dayVenueCount(sessionA)).toBe(2)
    expect(await courtCount(sessionA)).toBe(6)

    const rows = await (prisma as any).seasonSessionDayVenue.findMany({
      where: { venueId, day: { sessionId: sessionA } },
      select: { startTime: true, endTime: true },
    })
    // SeasonVenueHours (08:00-20:00) wins over the venue's posted 09:00-21:00.
    for (const r of rows) {
      expect(r.startTime).toBe("08:00")
      expect(r.endTime).toBe("20:00")
    }

    const { cell } = await cellFor(sessionA)
    expect(cell.state).toBe("on")
    expect(cell.courts).toBe(3)
  })

  it("preserves court fill order on each day", async () => {
    const dayVenues = await (prisma as any).seasonSessionDayVenue.findMany({
      where: { venueId, day: { sessionId: sessionA } },
      select: { id: true },
    })
    expect(dayVenues).toHaveLength(2)
    for (const dv of dayVenues) {
      const rows = await (prisma as any).seasonSessionDayVenueCourt.findMany({
        where: { dayVenueId: dv.id },
        select: { courtId: true },
        orderBy: { order: "asc" },
      })
      expect(rows.map((r: any) => r.courtId)).toEqual(courtIds)
    }
  })

  it("leaves days that already use the gym exactly as they were", async () => {
    const result = await attachVenueToSession(seasonId, sessionA, venueId, courtIds)
    expect(result.daysAttached).toBe(0)
    expect(result.alreadyAttached).toBe(2)
    expect(await courtCount(sessionA)).toBe(6) // no duplicate court rows
  })

  it("does nothing without courts, and never crosses seasons", async () => {
    await detachVenueFromSession(seasonId, sessionA, venueId)
    expect(await attachVenueToSession(seasonId, sessionA, venueId, [])).toEqual({
      daysAttached: 0,
      alreadyAttached: 0,
    })
    expect(await dayVenueCount(sessionA)).toBe(0)

    expect(await attachVenueToSession("not-this-season", sessionA, venueId, courtIds)).toEqual({
      daysAttached: 0,
      alreadyAttached: 0,
    })
    expect(await dayVenueCount(sessionA)).toBe(0)

    await attachVenueToSession(seasonId, sessionA, venueId, courtIds)
    expect(await dayVenueCount(sessionA)).toBe(2)
  })
})

describe("setSessionVenueWindow", () => {
  it("overrides one weekend only, and never writes SeasonVenueHours", async () => {
    const before = await (prisma as any).seasonVenueHours.findMany({
      where: { seasonVenue: { seasonId, venueId } },
      orderBy: { dayOfWeek: "asc" },
      select: { dayOfWeek: true, openTime: true, closeTime: true },
    })

    const result = await setSessionVenueWindow(seasonId, sessionA, venueId, {
      startTime: "08:00",
      endTime: "21:00",
    })
    expect(result.updated).toBe(2)

    const after = await (prisma as any).seasonVenueHours.findMany({
      where: { seasonVenue: { seasonId, venueId } },
      orderBy: { dayOfWeek: "asc" },
      select: { dayOfWeek: true, openTime: true, closeTime: true },
    })
    expect(after).toEqual(before) // the season-wide default is untouched

    const other = await (prisma as any).seasonSessionDayVenue.findMany({
      where: { venueId, day: { sessionId: sessionB } },
      select: { startTime: true, endTime: true },
    })
    for (const r of other) expect(r.endTime).toBe("20:00")
  })

  it("shows as a custom cell, labelled by what actually changed", async () => {
    const a = await cellFor(sessionA)
    expect(a.cell.state).toBe("custom")
    expect(a.cell.startTime).toBe("08:00")
    expect(a.cell.endTime).toBe("21:00")
    expect(a.cell.hoursLabel).toBe("to 21:00")

    const b = await cellFor(sessionB)
    expect(b.cell.state).toBe("on")
    expect(b.cell.hoursLabel).toBeNull()
  })

  it("resets the weekend back to the season default", async () => {
    const result = await setSessionVenueWindow(seasonId, sessionA, venueId, null)
    expect(result.updated).toBe(2)

    const { cell } = await cellFor(sessionA)
    expect(cell.state).toBe("on")
    expect(cell.startTime).toBe("08:00")
    expect(cell.endTime).toBe("20:00")
  })

  it("touches nothing when the gym is not on that weekend", async () => {
    await detachVenueFromSession(seasonId, sessionA, venueId)
    const result = await setSessionVenueWindow(seasonId, sessionA, venueId, {
      startTime: "10:00",
      endTime: "12:00",
    })
    expect(result.updated).toBe(0)
    await attachVenueToSession(seasonId, sessionA, venueId, courtIds)
  })
})

describe("buildVenueWeekendGrid", () => {
  it("returns every weekend in date order with a cell per gym", async () => {
    const grid = await buildVenueWeekendGrid(seasonId)

    expect(grid.weekends).toHaveLength(2)
    expect(new Date(grid.weekends[0].dateISO).getTime()).toBeLessThan(
      new Date(grid.weekends[1].dateISO).getTime()
    )
    expect(grid.weekends[0].dayCount).toBe(2)
    expect(grid.weekends[0].label).toMatch(/^[A-Z][a-z]{2} \d+/)

    expect(grid.venues).toHaveLength(1)
    const row = grid.venues[0]
    expect(row.cells).toHaveLength(grid.weekends.length)
    expect(row.courtCount).toBe(3)
    expect(row.courts).toHaveLength(3)
    // "Sat–Sun 08:00 – 20:00" style, built from the weekdays actually played.
    expect(row.defaultWindowLabel).toContain("08:00 – 20:00")
    expect(row.isPrimary).toBe(true)
    expect(grid.seasonLabel).toBeTruthy()
  })

  it("counts a half-attached weekend as on, and says how many days", async () => {
    const one = await (prisma as any).seasonSessionDayVenue.findFirstOrThrow({
      where: { venueId, day: { sessionId: sessionA } },
      select: { id: true },
    })
    await (prisma as any).seasonSessionDayVenue.delete({ where: { id: one.id } })

    const { cell } = await cellFor(sessionA)
    expect(cell.state).toBe("on")
    expect(cell.daysOn).toBe(1)
    expect(cell.dayCount).toBe(2)

    await attachVenueToSession(seasonId, sessionA, venueId, courtIds)
  })
})
