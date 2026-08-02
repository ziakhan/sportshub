import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { DELETE, POST } from "./[sessionId]/venues/[venueId]/route"
import { PATCH } from "./[sessionId]/venues/[venueId]/hours/route"
import { GET as GET_GRID } from "../planner/venues/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * The three step-2 endpoints (owner 2026-08-02). Everything the grid cell
 * can do, plus the gates: league owner only, season not finalized, and no
 * reaching into another season's weekends or another gym's courts.
 */

let world: BuiltWorld
let seasonId: string
let lockedSeasonId: string
let venueId: string
let otherVenueId: string
let sessionId: string
let ownerId: string
let strangerId: string

const ctx = (overrides: Partial<{ id: string; sessionId: string; venueId: string }> = {}) => ({
  params: { id: seasonId, sessionId, venueId, ...overrides },
})

const dayVenues = () =>
  (prisma as any).seasonSessionDayVenue.count({ where: { venueId, day: { sessionId } } })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1139,
    // A second league exists only for its owner: a signed-in user with no
    // business touching league one's weekends.
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
  venueId = league.seasons[0].venue!.id
  otherVenueId = league.seasons[1].venue!.id
  sessionId = league.seasons[0].sessions[0].id
})

afterAll(async () => {
  await destroyWorld(world.ctx)
})

describe("POST / DELETE one gym on one weekend", () => {
  it("turns a stranger away", async () => {
    actAs(strangerId)
    const res = await DELETE(jsonRequest("/x", undefined, "DELETE"), ctx())
    expect(res.status).toBe(403)
    expect(await dayVenues()).toBe(2)
  })

  it("releases the weekend for the league owner", async () => {
    actAs(ownerId)
    const res = await DELETE(jsonRequest("/x", undefined, "DELETE"), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, daysReleased: 2, courtsReleased: 4 })
    expect(await dayVenues()).toBe(0)
  })

  it("shows the cell as released on the grid", async () => {
    actAs(ownerId)
    const res = await GET_GRID(jsonRequest("/x", undefined, "GET"), { params: { id: seasonId } })
    expect(res.status).toBe(200)
    const { grid } = await res.json()
    const row = grid.venues.find((v: any) => v.venueId === venueId)
    expect(row.cells[0].state).toBe("off")
  })

  it("puts it back with the season's default courts", async () => {
    actAs(ownerId)
    const res = await POST(jsonRequest("/x", {}), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, daysAttached: 2 })
    expect(await dayVenues()).toBe(2)
  })

  it("rejects a gym that is not on this season", async () => {
    actAs(ownerId)
    const res = await POST(jsonRequest("/x", {}), ctx({ venueId: otherVenueId }))
    expect(res.status).toBe(404)
  })

  it("rejects a weekend from another season", async () => {
    actAs(ownerId)
    const otherSession = world.leagues[1].seasons[1].sessions[0].id
    const res = await POST(jsonRequest("/x", {}), ctx({ sessionId: otherSession }))
    expect(res.status).toBe(404)
  })

  it("rejects courts that live at a different gym", async () => {
    actAs(ownerId)
    const foreign = world.leagues[1].seasons[1].venue!.courtIds
    const res = await POST(jsonRequest("/x", { courtIds: foreign }), ctx())
    expect(res.status).toBe(400)
  })

  it("refuses once the season is finalized", async () => {
    actAs(ownerId)
    const locked = world.leagues[1].seasons[1]
    const res = await DELETE(jsonRequest("/x", undefined, "DELETE"), {
      params: {
        id: lockedSeasonId,
        sessionId: locked.sessions[0].id,
        venueId: otherVenueId,
      },
    })
    expect(res.status).toBe(409)
  })
})

describe("PATCH one weekend's hours", () => {
  it("sets a custom window without touching the season default", async () => {
    actAs(ownerId)
    const before = await (prisma as any).seasonVenueHours.count({
      where: { seasonVenue: { seasonId, venueId } },
    })

    const res = await PATCH(
      jsonRequest("/x", { startTime: "08:00", endTime: "22:00" }, "PATCH"),
      ctx()
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, updated: 2 })

    const rows = await (prisma as any).seasonSessionDayVenue.findMany({
      where: { venueId, day: { sessionId } },
      select: { startTime: true, endTime: true },
    })
    for (const r of rows) expect(r.endTime).toBe("22:00")

    const after = await (prisma as any).seasonVenueHours.count({
      where: { seasonVenue: { seasonId, venueId } },
    })
    expect(after).toBe(before)
  })

  it("rejects a backwards window", async () => {
    actAs(ownerId)
    const res = await PATCH(
      jsonRequest("/x", { startTime: "20:00", endTime: "09:00" }, "PATCH"),
      ctx()
    )
    expect(res.status).toBe(400)
  })

  it("rejects a malformed time", async () => {
    actAs(ownerId)
    const res = await PATCH(jsonRequest("/x", { startTime: "8am" }, "PATCH"), ctx())
    expect(res.status).toBe(400)
  })

  it("resets the weekend back to the season default", async () => {
    actAs(ownerId)
    const res = await PATCH(jsonRequest("/x", { reset: true }, "PATCH"), ctx())
    expect(res.status).toBe(200)

    const rows = await (prisma as any).seasonSessionDayVenue.findMany({
      where: { venueId, day: { sessionId } },
      select: { endTime: true },
    })
    // Back onto the gym's posted 09:00-21:00, since this season set no hours.
    for (const r of rows) expect(r.endTime).toBe("21:00")
  })

  it("404s when the gym is not on that weekend", async () => {
    actAs(ownerId)
    await DELETE(jsonRequest("/x", undefined, "DELETE"), ctx())
    const res = await PATCH(
      jsonRequest("/x", { startTime: "08:00", endTime: "20:00" }, "PATCH"),
      ctx()
    )
    expect(res.status).toBe(404)
    await POST(jsonRequest("/x", {}), ctx())
  })
})
