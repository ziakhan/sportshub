import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { applyAssignment } from "@/lib/scheduler/planner"
import {
  ACTIVE_PLAN_DELETE_MESSAGE,
  IMPORTED_PLAN_NAME,
  IMPORTED_PLAN_READONLY_MESSAGE,
} from "@/lib/scheduler/season-plans"
import { GET as LIST_PLANS, POST as CREATE_PLAN } from "../plans/route"
import { DELETE as DELETE_PLAN, GET as GET_PLAN, PATCH as PATCH_PLAN } from "../plans/[planId]/route"
import { POST as ACTIVATE_PLAN } from "../plans/[planId]/activate/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * Plans as documents (owner 2026-08-02). A season holds MANY named calendars,
 * exactly one is active, and the active one is what the season's sessions
 * actually run. Four contracts:
 *   - the calendar already on the sessions becomes plan #1 ("NPH plan",
 *     imported, active) the first time anyone asks — once, not every read
 *   - saving is not applying: a new plan lands inactive, and the list reads
 *     active-first then newest
 *   - the imported plan can be renamed but never rewritten — it is the only
 *     record of what the league actually published
 *   - activating writes the plan onto SeasonSession.unitKeys/unitVenues and
 *     moves the flag; the active plan cannot be deleted out from under it
 */

let world: BuiltWorld
let seasonId: string
let otherSeasonId: string
let ownerId: string
let strangerId: string
let venueId: string
let weekendOne: string
let weekendTwo: string
let grade7Division: string
let grade8Division: string

let importedPlanId: string
let solverAId: string
let solverBId: string

const ctx = (id = seasonId) => ({ params: { id } })
const planCtx = (planId: string, id = seasonId) => ({ params: { id, planId } })

const listPlans = async (id = seasonId) =>
  (await (await LIST_PLANS(jsonRequest("/x", undefined, "GET"), ctx(id))).json()).plans

const sessionRow = (sessionId: string) =>
  (prisma as any).seasonSession.findUnique({
    where: { id: sessionId },
    select: { unitKeys: true, unitVenues: true },
  })

const activeFlags = async () =>
  Object.fromEntries(
    (
      await (prisma as any).seasonPlan.findMany({
        where: { seasonId },
        select: { id: true, isActive: true },
      })
    ).map((p: any) => [p.id, p.isActive])
  ) as Record<string, boolean>

/** @updatedAt lands on a JS millisecond, so two saves inside the same tick
 *  would tie and the "newest first" assertion would flap. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

beforeAll(async () => {
  world = await buildWorld({
    seed: 1148,
    leagues: [
      // League one exists only for its owner: a signed-in user with no
      // business reading league two's plans.
      { seasons: [] },
      {
        seasons: [
          {
            label: "Plans as documents",
            status: "REGISTRATION",
            divisions: [
              { name: "Grade 7", ageGroup: "Grade 7", teams: 2, rosterSize: 1, submissionStatus: "APPROVED" },
              { name: "Grade 8", ageGroup: "Grade 8", teams: 2, rosterSize: 1, submissionStatus: "APPROVED" },
            ],
            venue: { courts: 2, open: "09:00", close: "21:00" },
            sessions: [{ days: 2, startInDays: 7 }, { days: 2, startInDays: 40 }],
          },
          {
            label: "A different season",
            status: "REGISTRATION",
            divisions: [
              { name: "Grade 9", ageGroup: "Grade 9", teams: 2, rosterSize: 1, submissionStatus: "APPROVED" },
            ],
            venue: { courts: 2 },
            sessions: [{ days: 2, startInDays: 14 }],
          },
        ],
      },
    ],
  })
  const league = world.leagues[1]
  ownerId = league.owner.id
  strangerId = world.leagues[0].owner.id
  const season = league.seasons[0]
  seasonId = season.id
  otherSeasonId = league.seasons[1].id
  venueId = season.venue!.id
  weekendOne = season.sessions[0].id
  weekendTwo = season.sessions[1].id
  grade7Division = season.divisions.find((d) => d.ageGroup === "Grade 7")!.id
  grade8Division = season.divisions.find((d) => d.ageGroup === "Grade 8")!.id

  // The league's published calendar, already sitting on the sessions the way
  // an import would have left it: one grade per weekend, each in the gym.
  await applyAssignment(
    seasonId,
    { [weekendOne]: ["age:Grade 7"], [weekendTwo]: ["age:Grade 8"] },
    {
      [weekendOne]: { "age:Grade 7": venueId },
      [weekendTwo]: { "age:Grade 8": venueId },
    }
  )
})

afterAll(async () => {
  await destroyWorld(world.ctx)
})

describe("GET /seasons/[id]/plans — who may look", () => {
  it("turns away a signed-out visitor without snapshotting anything", async () => {
    actAs(null)
    const res = await LIST_PLANS(jsonRequest("/x", undefined, "GET"), ctx())
    expect(res.status).toBe(401)
    expect(await (prisma as any).seasonPlan.count({ where: { seasonId } })).toBe(0)
  })

  it("turns away another league's owner", async () => {
    actAs(strangerId)
    const res = await LIST_PLANS(jsonRequest("/x", undefined, "GET"), ctx())
    expect(res.status).toBe(403)
    expect(await (prisma as any).seasonPlan.count({ where: { seasonId } })).toBe(0)
  })
})

describe("the lazy NPH snapshot", () => {
  it("turns the saved calendar into plan #1, imported and active", async () => {
    actAs(ownerId)
    const plans = await listPlans()
    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({
      name: IMPORTED_PLAN_NAME,
      source: "imported",
      isActive: true,
    })
    importedPlanId = plans[0].id
  })

  it("snapshots what the sessions actually held, in grade keys and gyms", async () => {
    actAs(ownerId)
    const res = await GET_PLAN(jsonRequest("/x", undefined, "GET"), planCtx(importedPlanId))
    expect(res.status).toBe(200)
    const { plan } = await res.json()
    expect(plan.assignment).toEqual({
      [weekendOne]: ["age:Grade 7"],
      [weekendTwo]: ["age:Grade 8"],
    })
    expect(plan.venues).toEqual({
      [weekendOne]: { "age:Grade 7": venueId },
      [weekendTwo]: { "age:Grade 8": venueId },
    })
  })

  it("happens once, not on every read", async () => {
    actAs(ownerId)
    await listPlans()
    await listPlans()
    expect(await (prisma as any).seasonPlan.count({ where: { seasonId } })).toBe(1)
  })

  it("leaves a season with no calendar alone rather than naming an empty one", async () => {
    actAs(ownerId)
    expect(await listPlans(otherSeasonId)).toHaveLength(0)
  })
})

describe("POST /seasons/[id]/plans — saving is not applying", () => {
  it("saves the board as a named plan, inactive", async () => {
    actAs(ownerId)
    const res = await CREATE_PLAN(
      jsonRequest("/x", {
        name: "Solver A",
        source: "proposed",
        assignment: { [weekendOne]: ["age:Grade 7", "age:Grade 8"], [weekendTwo]: [] },
        venues: { [weekendOne]: { "age:Grade 7": venueId, "age:Grade 8": venueId } },
      }),
      ctx()
    )
    expect(res.status).toBe(200)
    const { plan } = await res.json()
    expect(plan).toMatchObject({ name: "Solver A", source: "proposed", isActive: false })
    solverAId = plan.id

    // The sessions still run the imported calendar: nothing was applied.
    expect((await sessionRow(weekendOne)).unitKeys).toEqual([`division:${grade7Division}`])
  })

  it("refuses a nameless plan", async () => {
    actAs(ownerId)
    const res = await CREATE_PLAN(jsonRequest("/x", { name: "  ", assignment: {} }), ctx())
    expect(res.status).toBe(400)
  })

  it("refuses to mint a second imported reference", async () => {
    actAs(ownerId)
    const res = await CREATE_PLAN(
      jsonRequest("/x", { name: "Fake import", source: "imported", assignment: {} }),
      ctx()
    )
    expect(res.status).toBe(400)
  })

  it("lists active first, then newest", async () => {
    await tick()
    actAs(ownerId)
    const created = await CREATE_PLAN(
      jsonRequest("/x", {
        name: "Solver B",
        assignment: { [weekendTwo]: ["age:Grade 7", "age:Grade 8"] },
      }),
      ctx()
    )
    solverBId = (await created.json()).plan.id

    const plans = await listPlans()
    expect(plans.map((p: any) => p.id)).toEqual([importedPlanId, solverBId, solverAId])
    expect(plans[0].isActive).toBe(true)
    // The list row is the dropdown's, not the document's.
    expect(plans[0].assignment).toBeUndefined()
  })
})

describe("PATCH /seasons/[id]/plans/[planId]", () => {
  it("renames the imported plan — that much is always allowed", async () => {
    actAs(ownerId)
    const res = await PATCH_PLAN(
      jsonRequest("/x", { name: "NPH official" }, "PATCH"),
      planCtx(importedPlanId)
    )
    expect(res.status).toBe(200)
    expect((await res.json()).plan.name).toBe("NPH official")
  })

  it("refuses to rewrite what the imported plan says, in words", async () => {
    actAs(ownerId)
    const res = await PATCH_PLAN(
      jsonRequest("/x", { assignment: { [weekendOne]: [] } }, "PATCH"),
      planCtx(importedPlanId)
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(IMPORTED_PLAN_READONLY_MESSAGE)

    const { plan } = await (
      await GET_PLAN(jsonRequest("/x", undefined, "GET"), planCtx(importedPlanId))
    ).json()
    expect(plan.assignment[weekendOne]).toEqual(["age:Grade 7"])
  })

  it("rewrites the operator's own plan", async () => {
    actAs(ownerId)
    const res = await PATCH_PLAN(
      jsonRequest("/x", { name: "Solver B (edited)", assignment: { [weekendTwo]: ["age:Grade 8"] } }, "PATCH"),
      planCtx(solverBId)
    )
    expect(res.status).toBe(200)
    const { plan } = await res.json()
    expect(plan.name).toBe("Solver B (edited)")
    expect(plan.assignment).toEqual({ [weekendTwo]: ["age:Grade 8"] })
  })

  it("404s a plan that belongs to another season", async () => {
    actAs(ownerId)
    const res = await PATCH_PLAN(
      jsonRequest("/x", { name: "Not yours" }, "PATCH"),
      planCtx(solverAId, otherSeasonId)
    )
    expect(res.status).toBe(404)
  })
})

describe("POST /seasons/[id]/plans/[planId]/activate", () => {
  it("writes the plan onto the sessions and moves the flag", async () => {
    actAs(ownerId)
    const res = await ACTIVATE_PLAN(jsonRequest("/x"), planCtx(solverAId))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })

    // Grade keys expanded to the division keys the engine reads, gyms with them.
    const one = await sessionRow(weekendOne)
    expect(new Set(one.unitKeys)).toEqual(
      new Set([`division:${grade7Division}`, `division:${grade8Division}`])
    )
    expect(one.unitVenues).toEqual({
      [`division:${grade7Division}`]: venueId,
      [`division:${grade8Division}`]: venueId,
    })

    // Weekend two is empty in this plan, so the imported plan's Grade 8 goes.
    const two = await sessionRow(weekendTwo)
    expect(two.unitKeys).toEqual([])
    expect(two.unitVenues).toBeNull()

    const flags = await activeFlags()
    expect(flags[solverAId]).toBe(true)
    expect(flags[importedPlanId]).toBe(false)
    expect(flags[solverBId]).toBe(false)
  })

  it("puts the freshly activated plan at the top of the list", async () => {
    actAs(ownerId)
    expect((await listPlans())[0].id).toBe(solverAId)
  })

  it("goes back to the imported calendar just as cleanly", async () => {
    actAs(ownerId)
    expect((await ACTIVATE_PLAN(jsonRequest("/x"), planCtx(importedPlanId))).status).toBe(200)

    expect((await sessionRow(weekendOne)).unitKeys).toEqual([`division:${grade7Division}`])
    expect((await sessionRow(weekendTwo)).unitKeys).toEqual([`division:${grade8Division}`])

    const flags = await activeFlags()
    expect(flags[importedPlanId]).toBe(true)
    expect(flags[solverAId]).toBe(false)
  })

  it("404s a plan from another season", async () => {
    actAs(ownerId)
    const res = await ACTIVATE_PLAN(jsonRequest("/x"), planCtx(solverAId, otherSeasonId))
    expect(res.status).toBe(404)
  })
})

describe("DELETE /seasons/[id]/plans/[planId]", () => {
  it("refuses the active plan, and says which way out", async () => {
    actAs(ownerId)
    const res = await DELETE_PLAN(jsonRequest("/x", undefined, "DELETE"), planCtx(importedPlanId))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(ACTIVE_PLAN_DELETE_MESSAGE)
    expect(await (prisma as any).seasonPlan.count({ where: { id: importedPlanId } })).toBe(1)
  })

  it("throws away a plan nobody is running", async () => {
    actAs(ownerId)
    const res = await DELETE_PLAN(jsonRequest("/x", undefined, "DELETE"), planCtx(solverBId))
    expect(res.status).toBe(200)
    expect((await listPlans()).map((p: any) => p.id)).toEqual([importedPlanId, solverAId])
  })

  it("404s a plan from another season instead of deleting it", async () => {
    actAs(ownerId)
    const res = await DELETE_PLAN(
      jsonRequest("/x", undefined, "DELETE"),
      planCtx(solverAId, otherSeasonId)
    )
    expect(res.status).toBe(404)
    expect(await (prisma as any).seasonPlan.count({ where: { id: solverAId } })).toBe(1)
  })
})
