import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { applyAssignment, buildPlannerState } from "@/lib/scheduler/planner"
import { PATCH as PATCH_VENUE } from "../venues/[seasonVenueId]/route"
import { PATCH as PATCH_BOOKING } from "../sessions/[sessionId]/venues/[venueId]/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * Which BUILDING a grade plays in, end to end (owner ruling 2026-08-02: gyms
 * fill in an order the league sets, and a grade keeps its gym all season).
 *
 * Two contracts live here:
 *   - the step-2 card can order the gyms, and ordering them is NOT a capacity
 *     edit: a fillOrder-only save leaves courts and every wired weekend alone
 *   - a kept plan's gyms survive the round trip — grade keys expand to the
 *     division keys the engine reads, fold back to grades on the way out, and
 *     a plan re-applied with nothing to say about gyms clears the old claims
 */

let world: BuiltWorld
let seasonId: string
let lockedSeasonId: string
let lockedSeasonVenueId: string
let seasonVenueId: string
let venueId: string
let ownerId: string
let strangerId: string

const ctx = (id: string, seasonVenue: string) => ({
  params: { id, seasonVenueId: seasonVenue },
})

const seasonVenueRow = (id = seasonVenueId) =>
  (prisma as any).seasonVenue.findUnique({
    where: { id },
    select: { fillOrder: true, courtsAvailable: true },
  })

/** Court ids per weekend day at this gym — what a court edit rewires. */
const wiring = async (): Promise<string[][]> =>
  (
    await (prisma as any).seasonSessionDayVenue.findMany({
      where: { venueId, day: { session: { seasonId } } },
      orderBy: { id: "asc" },
      select: { courts: { orderBy: { order: "asc" }, select: { courtId: true } } },
    })
  ).map((dv: any) => dv.courts.map((c: any) => c.courtId))

const savedVenues = (sessionId: string) =>
  (prisma as any).seasonSession
    .findUnique({ where: { id: sessionId }, select: { unitVenues: true } })
    .then((s: any) => s?.unitVenues ?? null)

beforeAll(async () => {
  world = await buildWorld({
    seed: 1145,
    leagues: [
      // League one exists only for its owner: someone with no business
      // ordering league two's gyms.
      { seasons: [] },
      {
        seasons: [
          {
            label: "Gyms in order",
            status: "REGISTRATION",
            divisions: [
              { name: "Grade 7", ageGroup: "Grade 7", teams: 2, rosterSize: 1, submissionStatus: "APPROVED" },
              { name: "Grade 8", ageGroup: "Grade 8", teams: 2, rosterSize: 1, submissionStatus: "APPROVED" },
            ],
            venue: { courts: 2, open: "09:00", close: "21:00" },
            sessions: [{ days: 2, startInDays: 7 }, { days: 2, startInDays: 40 }],
          },
          {
            label: "Already finalized",
            status: "FINALIZED",
            divisions: [
              { name: "Grade 9", ageGroup: "Grade 9", teams: 2, rosterSize: 1, submissionStatus: "APPROVED" },
            ],
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
  seasonVenueId = (
    await (prisma as any).seasonVenue.findFirst({
      where: { seasonId, venueId },
      select: { id: true },
    })
  ).id
  lockedSeasonVenueId = (
    await (prisma as any).seasonVenue.findFirst({
      where: { seasonId: lockedSeasonId },
      select: { id: true },
    })
  ).id
})

afterAll(async () => {
  await destroyWorld(world.ctx)
})

describe("PATCH /seasons/[id]/venues/[seasonVenueId] — which gym fills first", () => {
  it("saves an order without touching courts or any wired weekend", async () => {
    actAs(ownerId)
    const before = await wiring()
    const beforeRow = await seasonVenueRow()
    const res = await PATCH_VENUE(
      jsonRequest("/x", { fillOrder: 2 }, "PATCH"),
      ctx(seasonId, seasonVenueId)
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.fillOrder).toBe(2)
    // No court count in the answer, because no court count changed.
    expect(body.courtsAvailable).toBeUndefined()

    const row = await seasonVenueRow()
    expect(row.fillOrder).toBe(2)
    // Ordering gyms invents no court count and moves no court.
    expect(row.courtsAvailable).toBe(beforeRow.courtsAvailable)
    expect(await wiring()).toEqual(before)
  })

  it("still rewires the weekends when the court count is what changed", async () => {
    actAs(ownerId)
    const res = await PATCH_VENUE(
      jsonRequest("/x", { courtsAvailable: 3 }, "PATCH"),
      ctx(seasonId, seasonVenueId)
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.courtsAvailable).toBe(3)
    expect(body.daysRewired).toBeGreaterThan(0)
    for (const day of await wiring()) expect(day).toHaveLength(3)
    // The order the last call set is still the order.
    expect((await seasonVenueRow()).fillOrder).toBe(2)
  })

  it("refuses a save that changes nothing, and an order out of range", async () => {
    actAs(ownerId)
    expect(
      (await PATCH_VENUE(jsonRequest("/x", {}, "PATCH"), ctx(seasonId, seasonVenueId))).status
    ).toBe(400)
    expect(
      (
        await PATCH_VENUE(
          jsonRequest("/x", { fillOrder: 100 }, "PATCH"),
          ctx(seasonId, seasonVenueId)
        )
      ).status
    ).toBe(400)
  })

  it("keeps the gate it always had: not a stranger's, not a finalized season's", async () => {
    actAs(strangerId)
    expect(
      (
        await PATCH_VENUE(
          jsonRequest("/x", { fillOrder: 0 }, "PATCH"),
          ctx(seasonId, seasonVenueId)
        )
      ).status
    ).toBe(403)

    actAs(ownerId)
    expect(
      (
        await PATCH_VENUE(
          jsonRequest("/x", { fillOrder: 0 }, "PATCH"),
          ctx(lockedSeasonId, lockedSeasonVenueId)
        )
      ).status
    ).toBe(409)

    // A season venue belonging to another season is not this season's to edit.
    expect(
      (
        await PATCH_VENUE(
          jsonRequest("/x", { fillOrder: 0 }, "PATCH"),
          ctx(seasonId, lockedSeasonVenueId)
        )
      ).status
    ).toBe(404)
  })
})

/**
 * WHAT A GYM IS TO THE LEAGUE (owner ruling 2026-08-03, venue model v2). Home
 * is exclusive: naming one building home makes every other gym of the season
 * pool, in one transaction, because two free buildings would make every rental
 * number a guess.
 */
describe("PATCH /seasons/[id]/venues/[seasonVenueId] — home and pool", () => {
  let poolVenueId: string
  let poolSeasonVenueId: string

  const roleOf = async (id: string): Promise<string> =>
    (
      await (prisma as any).seasonVenue.findUnique({ where: { id }, select: { role: true } })
    ).role

  beforeAll(async () => {
    const venue = await (prisma as any).venue.create({
      data: {
        name: "Rented Hall 1145",
        address: "1 Rental Way",
        city: "Burlington",
        state: "ON",
      },
      select: { id: true },
    })
    poolVenueId = venue.id
    const link = await (prisma as any).seasonVenue.create({
      data: { seasonId, venueId: poolVenueId },
      select: { id: true, role: true },
    })
    poolSeasonVenueId = link.id
    // A gym nobody has said anything about is rented. That is the default, and
    // it is the safe one: it costs money until somebody says otherwise.
    expect(link.role).toBe("pool")
  })

  it("names one building home and pushes every other gym into the pool", async () => {
    actAs(ownerId)
    const res = await PATCH_VENUE(
      jsonRequest("/x", { role: "home" }, "PATCH"),
      ctx(seasonId, seasonVenueId)
    )
    expect(res.status).toBe(200)
    expect((await res.json()).role).toBe("home")
    expect(await roleOf(seasonVenueId)).toBe("home")
    expect(await roleOf(poolSeasonVenueId)).toBe("pool")

    // Naming the OTHER one home moves the home gym: still exactly one.
    expect(
      (
        await PATCH_VENUE(
          jsonRequest("/x", { role: "home" }, "PATCH"),
          ctx(seasonId, poolSeasonVenueId)
        )
      ).status
    ).toBe(200)
    expect(await roleOf(poolSeasonVenueId)).toBe("home")
    expect(await roleOf(seasonVenueId)).toBe("pool")
  })

  it("lets a league give the home gym up, and rent everything", async () => {
    actAs(ownerId)
    expect(
      (
        await PATCH_VENUE(
          jsonRequest("/x", { role: "pool" }, "PATCH"),
          ctx(seasonId, poolSeasonVenueId)
        )
      ).status
    ).toBe(200)
    expect(await roleOf(poolSeasonVenueId)).toBe("pool")
    expect(await roleOf(seasonVenueId)).toBe("pool")
  })

  it("refuses a role nobody defined, and keeps the season's gate", async () => {
    actAs(ownerId)
    expect(
      (
        await PATCH_VENUE(
          jsonRequest("/x", { role: "rented" }, "PATCH"),
          ctx(seasonId, seasonVenueId)
        )
      ).status
    ).toBe(400)
    actAs(strangerId)
    expect(
      (
        await PATCH_VENUE(
          jsonRequest("/x", { role: "home" }, "PATCH"),
          ctx(seasonId, seasonVenueId)
        )
      ).status
    ).toBe(403)
  })

  it("reaches the board: the home gym is the one the packer fills first", async () => {
    actAs(ownerId)
    await PATCH_VENUE(
      jsonRequest("/x", { role: "home" }, "PATCH"),
      ctx(seasonId, seasonVenueId)
    )
    const state = await buildPlannerState(seasonId)
    const venues = state.windows.flatMap((w) => w.weekends).flatMap((w) => w.venues)
    expect(venues.length).toBeGreaterThan(0)
    for (const v of venues) {
      expect(v.venueId).toBe(venueId)
      expect(v.role).toBe("home")
      // The courts and days behind the capacity, which is what a rental is
      // quoted in — and the hours behind a court-day.
      expect(v.courts).toBeGreaterThan(0)
      expect(v.days).toBeGreaterThan(0)
      expect(v.courtDays).toBe((v.courts ?? 0) * (v.days ?? 0))
      expect(v.hoursPerCourtDay).toBeGreaterThan(0)
    }
    // The rented hall is on the season but on no weekend, so the planner never
    // sees it: availability is the attachment, exactly as before.
    expect(venues.some((v) => v.venueId === poolVenueId)).toBe(false)
  })
})

describe("the planner state carries gyms and grades that alternate", () => {
  it("hands the board each gym's dead fill order, untouched", async () => {
    const state = await buildPlannerState(seasonId)
    const venues = state.windows.flatMap((w) => w.weekends).flatMap((w) => w.venues)
    expect(venues.length).toBeGreaterThan(0)
    for (const v of venues) {
      expect(v.venueId).toBe(venueId)
      expect(v.fillOrder).toBe(2)
    }
  })

  it("marks a grade that asked to alternate buildings", async () => {
    const before = await buildPlannerState(seasonId)
    expect(before.units.every((u) => u.alternate === false)).toBe(true)

    await (prisma as any).division.updateMany({
      where: { seasonId, ageGroup: "Grade 8" },
      data: { alternateVenues: true },
    })
    const after = await buildPlannerState(seasonId)
    expect(after.units.find((u) => u.label === "Grade 8")?.alternate).toBe(true)
    expect(after.units.find((u) => u.label === "Grade 7")?.alternate).toBe(false)

    await (prisma as any).division.updateMany({
      where: { seasonId },
      data: { alternateVenues: false },
    })
  })
})

/**
 * PATCH /seasons/[id]/sessions/[sessionId]/venues/[venueId] — the step that
 * moves a rental from "the solver assigned it" to "the gym said yes" (owner
 * ruling 2026-08-03).
 */
describe("a rental's booking lifecycle, over the wire", () => {
  const bookingCtx = (sessionId: string) => ({
    params: { id: seasonId, sessionId, venueId },
  })
  const statusesFor = (sessionId: string): Promise<string[]> =>
    (prisma as any).seasonSessionDayVenue
      .findMany({
        where: { venueId, day: { sessionId } },
        orderBy: { id: "asc" },
        select: { bookingStatus: true },
      })
      .then((rows: any[]) => rows.map((r) => r.bookingStatus))

  it("moves the whole weekend, and answers with where it stands", async () => {
    actAs(ownerId)
    const state = await buildPlannerState(seasonId)
    const sessionId = state.windows[0].weekends[0].sessionId

    const assumed = await PATCH_BOOKING(
      jsonRequest("/x", { bookingStatus: "assumed" }, "PATCH"),
      bookingCtx(sessionId)
    )
    expect(assumed.status).toBe(200)
    const body = await assumed.json()
    expect(body.bookingStatus).toBe("assumed")
    expect(body.daysUpdated).toBeGreaterThan(0)
    expect(new Set(await statusesFor(sessionId))).toEqual(new Set(["assumed"]))

    expect(
      (
        await PATCH_BOOKING(
          jsonRequest("/x", { bookingStatus: "confirmed" }, "PATCH"),
          bookingCtx(sessionId)
        )
      ).status
    ).toBe(200)
    expect(new Set(await statusesFor(sessionId))).toEqual(new Set(["confirmed"]))
  })

  it("refuses a status nobody defined, and keeps the season's gate", async () => {
    const state = await buildPlannerState(seasonId)
    const sessionId = state.windows[0].weekends[0].sessionId

    actAs(ownerId)
    expect(
      (
        await PATCH_BOOKING(jsonRequest("/x", { bookingStatus: "maybe" }, "PATCH"), bookingCtx(sessionId))
      ).status
    ).toBe(400)

    actAs(strangerId)
    expect(
      (
        await PATCH_BOOKING(
          jsonRequest("/x", { bookingStatus: "assumed" }, "PATCH"),
          bookingCtx(sessionId)
        )
      ).status
    ).toBe(403)
  })
})

describe("applying a plan's gyms", () => {
  it("writes one gym per grade as division keys, and reads it back as grades", async () => {
    const state = await buildPlannerState(seasonId)
    const weekend = state.windows[0].weekends[0]
    const keys = state.units.map((u) => u.key)

    await applyAssignment(
      seasonId,
      { [weekend.sessionId]: keys },
      { [weekend.sessionId]: Object.fromEntries(keys.map((k) => [k, venueId])) }
    )

    // On disk: the engine's own division keys, never the grade shorthand.
    const saved = await savedVenues(weekend.sessionId)
    const divisionIds = state.units.flatMap((u) => u.divisionIds)
    expect(Object.keys(saved).sort()).toEqual(
      divisionIds.map((id) => `division:${id}`).sort()
    )
    expect(new Set(Object.values(saved))).toEqual(new Set([venueId]))

    // On the board: grades again.
    const reread = await buildPlannerState(seasonId)
    const same = reread.windows[0].weekends.find((w) => w.sessionId === weekend.sessionId)!
    expect(same.assignedVenues).toEqual(Object.fromEntries(keys.map((k) => [k, venueId])))
  })

  it("never claims a gym for a grade the weekend does not play", async () => {
    const state = await buildPlannerState(seasonId)
    const weekend = state.windows[0].weekends[0]
    const [first] = state.units

    await applyAssignment(
      seasonId,
      { [weekend.sessionId]: [first.key] },
      // A leftover claim for a grade that was dragged off this weekend.
      Object.fromEntries([
        [weekend.sessionId, Object.fromEntries(state.units.map((u) => [u.key, venueId]))],
      ])
    )
    const saved = await savedVenues(weekend.sessionId)
    expect(Object.keys(saved).sort()).toEqual(
      first.divisionIds.map((id) => `division:${id}`).sort()
    )
  })

  it("clears the old gyms when a plan is re-applied without any", async () => {
    const state = await buildPlannerState(seasonId)
    const weekend = state.windows[0].weekends[0]
    expect(await savedVenues(weekend.sessionId)).not.toBeNull()

    await applyAssignment(seasonId, { [weekend.sessionId]: state.units.map((u) => u.key) })
    expect(await savedVenues(weekend.sessionId)).toBeNull()

    const reread = await buildPlannerState(seasonId)
    const same = reread.windows[0].weekends.find((w) => w.sessionId === weekend.sessionId)!
    expect(same.assignedVenues).toEqual({})
    // The calendar itself is untouched: only the gyms went away.
    expect(same.assigned.sort()).toEqual(state.units.map((u) => u.key).sort())
  })
})
