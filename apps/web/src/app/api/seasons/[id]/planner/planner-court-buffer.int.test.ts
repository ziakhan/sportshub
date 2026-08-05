import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { buildPlannerState } from "@/lib/scheduler/planner"
import { courtsHeldOn, heldBackPhrase } from "@/lib/scheduler/planner-core"
import { GET as GRID, PATCH as SET_BUFFER } from "./venues/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * COURTS THE LEAGUE HOLDS BACK (Season.courtBuffer, owner ruling 2026-08-03):
 * "a court left empty, because games overrun and teams still turn up late."
 *
 * The contract this file pins, end to end against a real season:
 *   - the setting is edited where gym time is edited (step 2's grid route),
 *     under the planner gate, and a finalized season cannot move it.
 *   - EVERY capacity number downstream is already net of it — the planner's
 *     weekend capacity, its per-gym courts, and the court-days behind them.
 *   - the number is carried back out (`courtsHeld`) so a meter can say why it
 *     is smaller, instead of just being smaller.
 */

let world: BuiltWorld
let seasonId: string
let lockedSeasonId: string
let ownerId: string

const ctx = (id = seasonId) => ({ params: { id } })

const setBuffer = (courtBuffer: number, id = seasonId) =>
  SET_BUFFER(jsonRequest("/x", { courtBuffer }, "PATCH"), ctx(id))

/** The season's first weekend, as the board reads it. */
async function weekendOne(id = seasonId) {
  const state = await buildPlannerState(id)
  return state.windows[0].weekends[0]
}

beforeAll(async () => {
  world = await buildWorld({
    seed: 2261,
    leagues: [
      {
        seasons: [
          {
            label: "A season that holds a court back",
            status: "REGISTRATION",
            divisions: [{ name: "Grade 7", ageGroup: "Grade 7", teams: 4, rosterSize: 1 }],
            venue: { courts: 4 },
            sessions: [{ days: 2, startInDays: 7 }],
          },
          {
            label: "Already finalized",
            status: "FINALIZED",
            divisions: [{ name: "Grade 7", ageGroup: "Grade 7", teams: 2, rosterSize: 1 }],
            venue: { courts: 4 },
            sessions: [{ days: 2, startInDays: 21 }],
          },
        ],
      },
    ],
  })
  ownerId = world.leagues[0].owner.id
  seasonId = world.leagues[0].seasons[0].id
  lockedSeasonId = world.leagues[0].seasons[1].id
  actAs(ownerId)
})

afterAll(async () => {
  await setBuffer(0).catch(() => null)
  await destroyWorld(world.ctx)
})

describe("the court buffer", () => {
  it("starts at zero: a season plans to the whole building", async () => {
    const grid = await (await GRID(jsonRequest("/x"), ctx())).json()
    expect(grid.grid.courtBuffer).toBe(0)
    const w = await weekendOne()
    expect(w.venues[0].courts).toBe(4)
    expect(w.venues[0].courtsHeld).toBe(0)
    expect(heldBackPhrase(w.venues)).toBeNull()
  })

  it("takes a court out of the weekend's capacity, and says which", async () => {
    const before = await weekendOne()
    const res = await setBuffer(1)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.courtBuffer).toBe(1)
    expect(body.grid.courtBuffer).toBe(1)

    const after = await weekendOne()
    // Three courts of four, so three quarters of the games and three quarters
    // of the court-days. Same hours, same days: one fewer court.
    expect(after.venues[0].courts).toBe(3)
    expect(after.venues[0].courtsHeld).toBe(1)
    expect(after.venues[0].courtDays).toBe(Math.round((before.venues[0].courtDays! * 3) / 4))
    expect(after.capacityGames).toBe(Math.round((before.capacityGames * 3) / 4))
    expect(courtsHeldOn(after.venues)).toBe(1)
    expect(heldBackPhrase(after.venues)).toBe("1 court held back")
  })

  it("refuses a number that is not a count of courts", async () => {
    expect((await setBuffer(-1)).status).toBe(400)
    expect((await setBuffer(99)).status).toBe(400)
    // And the last good value is still standing.
    expect((await weekendOne()).venues[0].courtsHeld).toBe(1)
  })

  it("gives the courts back when the buffer goes to zero", async () => {
    expect((await setBuffer(0)).status).toBe(200)
    const w = await weekendOne()
    expect(w.venues[0].courts).toBe(4)
    expect(w.venues[0].courtsHeld).toBe(0)
  })

  it("a finalized season's capacity is history, not a setting", async () => {
    const res = await setBuffer(2, lockedSeasonId)
    expect(res.status).toBe(409)
    expect((await weekendOne(lockedSeasonId)).venues[0].courtsHeld).toBe(0)
  })
})
