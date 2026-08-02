import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { buildVenueWeekendGrid } from "@/lib/seasons/venue-grid"
import { markVenueUnavailable } from "@/lib/seasons/venue-propagation"
import { POST as TOGGLE_SEASON } from "./[seasonVenueId]/toggle-season/route"
import { POST as ATTACH } from "../sessions/[sessionId]/venues/[venueId]/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * A gym the season does NOT have on a weekend, WITH the reason (owner ruling
 * 2026-08-02: Six Park East is taken by the NJC/NSC circuits on six known
 * 2026-27 weekends). Three contracts:
 *
 *   - the grid reads a marked, unattached weekend as "taken" and carries the
 *     reason; attachment always wins, so a marked weekend that IS attached
 *     reads on
 *   - "on all weekends" skips the marked ones and says how many it left, so
 *     one press can never quietly claim a building somebody else has
 *   - turning a marked cell on IS the override: the attach route deletes the
 *     mark server side, and it stays deleted
 */

let world: BuiltWorld
let seasonId: string
let seasonVenueId: string
let venueId: string
let ownerId: string
let sessionIds: string[]
let sats: string[]

const toggleCtx = () => ({ params: { id: seasonId, seasonVenueId } })
const attachCtx = (sessionId: string) => ({
  params: { id: seasonId, sessionId, venueId },
})

/** The Saturday a session sits on, UTC midnight ISO — the weekend key. */
async function saturdayOfSession(sessionId: string): Promise<string> {
  const day = await (prisma as any).seasonSessionDay.findFirstOrThrow({
    where: { sessionId },
    orderBy: { date: "asc" },
    select: { date: true },
  })
  const d = new Date(day.date)
  const sat = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  if (sat.getUTCDay() === 0) sat.setUTCDate(sat.getUTCDate() - 1)
  return sat.toISOString()
}

const cellFor = async (satDateISO: string) => {
  const grid = await buildVenueWeekendGrid(seasonId)
  const row = grid.venues.find((v) => v.venueId === venueId)!
  const i = grid.weekends.findIndex((w) => w.satDateISO === satDateISO)
  return { cell: row.cells[i], weekend: grid.weekends[i] }
}

const marksOn = (satDateISO: string) =>
  (prisma as any).seasonVenueUnavailability.count({
    where: { seasonId, venueId, satDate: new Date(satDateISO) },
  })

const attachedDays = (sessionId: string) =>
  (prisma as any).seasonSessionDayVenue.count({ where: { venueId, day: { sessionId } } })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1146,
    leagues: [
      {
        seasons: [
          {
            label: "Taken weekends",
            status: "REGISTRATION",
            divisions: [{ teams: 2, rosterSize: 1, submissionStatus: "APPROVED" }],
            venue: { courts: 2, open: "09:00", close: "21:00" },
            // Three weekends: one stays ours, two get marked.
            sessions: [
              { days: 2, startInDays: 7 },
              { days: 2, startInDays: 14 },
              { days: 2, startInDays: 21 },
            ],
          },
        ],
      },
    ],
  })
  const league = world.leagues[0]
  ownerId = league.owner.id
  seasonId = league.seasons[0].id
  venueId = league.seasons[0].venue!.id
  seasonVenueId = (
    await (prisma as any).seasonVenue.findFirstOrThrow({
      where: { seasonId, venueId },
      select: { id: true },
    })
  ).id

  const sessions = await (prisma as any).seasonSession.findMany({
    where: { seasonId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  sessionIds = sessions.map((s: any) => s.id)
  sats = await Promise.all(sessionIds.map(saturdayOfSession))

  // The gym starts off every weekend, so "on all weekends" has work to do.
  await (prisma as any).seasonSessionDayVenue.deleteMany({
    where: { venueId, day: { session: { seasonId } } },
  })
})

afterAll(async () => {
  await destroyWorld(world.ctx)
})

describe("the grid reads a marked weekend as taken", () => {
  it("carries the reason, and only where the gym is not attached", async () => {
    await markVenueUnavailable(seasonId, venueId, sats[1], "Taken: NJC/NSC")
    await markVenueUnavailable(seasonId, venueId, sats[2], "Taken: NJC/NSC")

    const marked = await cellFor(sats[1])
    expect(marked.cell.state).toBe("taken")
    expect(marked.cell.reason).toBe("Taken: NJC/NSC")

    // The weekend nobody marked is plain off, with nothing to read.
    const plain = await cellFor(sats[0])
    expect(plain.cell.state).toBe("off")
    expect(plain.cell.reason).toBeNull()
  })
})

describe("POST toggle-season { on: true } — every weekend except the taken ones", () => {
  it("skips the marked weekends and reports them with the reason", async () => {
    actAs(ownerId)
    const res = await TOGGLE_SEASON(jsonRequest("/x", { on: true }), toggleCtx())
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.weekendsChanged).toBe(1)
    expect(body.weekendsUnavailable).toBe(2)
    expect(body.unavailableReason).toBe("Taken: NJC/NSC")

    // On disk: the free weekend got the gym, the marked ones did not.
    expect(await attachedDays(sessionIds[0])).toBe(2)
    expect(await attachedDays(sessionIds[1])).toBe(0)
    expect(await attachedDays(sessionIds[2])).toBe(0)
    // And nothing deleted a mark on the way past it.
    expect(await marksOn(sats[1])).toBe(1)
  })

  it("leaves the marks alone when the gym goes off for the season", async () => {
    actAs(ownerId)
    const res = await TOGGLE_SEASON(jsonRequest("/x", { on: false }), toggleCtx())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.weekendsChanged).toBe(1)
    // Off is not a reason: releasing weekends never marks or unmarks any.
    expect(body.weekendsUnavailable).toBe(0)
    expect(await marksOn(sats[1])).toBe(1)
    expect(await marksOn(sats[2])).toBe(1)
    expect((await cellFor(sats[0])).cell.state).toBe("off")
  })
})

describe("POST session venue — turning a taken weekend on is the override", () => {
  it("deletes the mark, attaches the gym, and the cell reads on", async () => {
    actAs(ownerId)
    expect((await cellFor(sats[1])).cell.state).toBe("taken")

    const res = await ATTACH(jsonRequest("/x", {}), attachCtx(sessionIds[1]))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, daysAttached: 2, overrodeUnavailable: 1 })

    expect(await marksOn(sats[1])).toBe(0)
    const after = await cellFor(sats[1])
    expect(after.cell.state).toBe("on")
    expect(after.cell.reason).toBeNull()
  })

  it("stays overridden: a second on/off round trip never brings the reason back", async () => {
    actAs(ownerId)
    const { DELETE } = await import("../sessions/[sessionId]/venues/[venueId]/route")
    expect((await DELETE(jsonRequest("/x", undefined, "DELETE"), attachCtx(sessionIds[1]))).status).toBe(200)

    // Released, and plain off — releasing a weekend writes no reason.
    const off = await cellFor(sats[1])
    expect(off.cell.state).toBe("off")
    expect(off.cell.reason).toBeNull()
    expect(await marksOn(sats[1])).toBe(0)

    // "On all weekends" now includes it, because nothing marks it any more.
    const res = await TOGGLE_SEASON(jsonRequest("/x", { on: true }), toggleCtx())
    const body = await res.json()
    expect(body.weekendsUnavailable).toBe(1)
    expect(await attachedDays(sessionIds[1])).toBe(2)
  })

  it("attachment wins while a mark still stands underneath it", async () => {
    // Re-mark a weekend the gym is already on: the operator's attachment is
    // the newer fact, so the cell reads on, not taken.
    await markVenueUnavailable(seasonId, venueId, sats[0], "Taken: NJC/NSC")
    expect(await attachedDays(sessionIds[0])).toBe(2)

    const cell = (await cellFor(sats[0])).cell
    expect(cell.state).toBe("on")
    expect(cell.reason).toBeNull()

    // And "on all weekends" does not report a weekend it never left off.
    actAs(ownerId)
    const res = await TOGGLE_SEASON(jsonRequest("/x", { on: true }), toggleCtx())
    const body = await res.json()
    expect(body.weekendsUnavailable).toBe(1)
    expect(await attachedDays(sessionIds[0])).toBe(2)
  })
})
