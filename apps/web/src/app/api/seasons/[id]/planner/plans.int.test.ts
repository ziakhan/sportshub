import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { applyAssignment } from "@/lib/scheduler/planner"
import { planDrift } from "@/lib/scheduler/plan-documents"
import {
  ACTIVE_PLAN_DELETE_MESSAGE,
  currentSettings,
  IMPORTED_PLAN_DELETE_MESSAGE,
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
 *
 * And a fifth, added 2026-08-02 (owner: "a new plan also could have different
 * venues. It could have different settings, so how are you going to save it
 * and how do you remember? It could be a different team combination"): every
 * plan carries the WORLD it was saved in — the gyms and their capacity, the
 * fill order, the team estimate per grade — snapshotted on the server so a
 * client can never claim a world the season was not in.
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

/**
 * EVERYTHING A PLAN'S WORLD COULD MOVE IF IT LEAKED, in one comparable object:
 * the grade estimates, the gym's role and courts, the season's buffer, and every
 * weekend-gym attachment. Editing a plan the season does not run must leave this
 * byte-identical (owner ruling 2026-08-05, the architecture).
 */
const seasonShape = async () => ({
  divisions: await (prisma as any).division.findMany({
    where: { seasonId },
    select: { id: true, ageGroup: true, expectedTeams: true },
    orderBy: { id: "asc" },
  }),
  season: await (prisma as any).season.findUnique({
    where: { id: seasonId },
    select: { courtBuffer: true },
  }),
  venues: await (prisma as any).seasonVenue.findMany({
    where: { seasonId },
    select: {
      venueId: true,
      role: true,
      courtsAvailable: true,
      hours: { select: { dayOfWeek: true, openTime: true, closeTime: true }, orderBy: { dayOfWeek: "asc" } },
    },
    orderBy: { venueId: "asc" },
  }),
  attachments: await (prisma as any).seasonSessionDayVenue.findMany({
    where: { day: { session: { seasonId } } },
    select: { venueId: true, startTime: true, endTime: true, day: { select: { sessionId: true, date: true } } },
    orderBy: [{ id: "asc" }],
  }),
})

/** Every weekend of a saved world, by sessionId. */
const weekendsOf = (settings: any): Record<string, any> =>
  Object.fromEntries(
    (settings?.state?.windows ?? []).flatMap((win: any) =>
      (win.weekends ?? []).map((w: any) => [w.sessionId, w])
    )
  )

/** A settings blob that actually describes this season: when it was taken,
 *  the grades with the numbers they plan on, and the weekends with their gyms.
 *  Asserted in one place because four routes have to produce the same thing. */
function expectWorld(settings: any) {
  expect(typeof settings?.capturedAt).toBe("string")
  expect(Number.isNaN(Date.parse(settings.capturedAt))).toBe(false)

  const grades = Object.fromEntries(
    (settings.state.units ?? []).map((u: any) => [u.key, u])
  )
  expect(Object.keys(grades).sort()).toEqual(["age:Grade 7", "age:Grade 8"])
  expect(grades["age:Grade 7"].label).toBe("Grade 7")

  const weekends = weekendsOf(settings)
  expect(Object.keys(weekends).sort()).toEqual([weekendOne, weekendTwo].sort())
  const one = weekends[weekendOne]
  expect(one.capacityGames).toBeGreaterThan(0)
  expect(one.targetGamesPerTeam).toBeGreaterThan(0)
  expect(one.venues.map((v: any) => v.venueId)).toEqual([venueId])
  expect(one.venues[0].capacityGames).toBeGreaterThan(0)
  expect(typeof one.venues[0].fillOrder).toBe("number")
}

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

  it("remembers the world that calendar was published in", async () => {
    actAs(ownerId)
    const { plan } = await (
      await GET_PLAN(jsonRequest("/x", undefined, "GET"), planCtx(importedPlanId))
    ).json()
    expectWorld(plan.settings)
    // The calendar is the plan's own two columns; the world carries none of it.
    const weekend = weekendsOf(plan.settings)[weekendOne]
    expect(weekend.assigned).toBeUndefined()
    expect(weekend.assignedVenues).toBeUndefined()
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

    // The world it was saved in rides along, read off the season by the server.
    expectWorld(plan.settings)

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

describe("the world a plan remembers", () => {
  const read = async (planId: string) =>
    (await (await GET_PLAN(jsonRequest("/x", undefined, "GET"), planCtx(planId))).json()).plan

  it("leaves the snapshot alone on a rename, because a rename changes no season", async () => {
    actAs(ownerId)
    const before = (await read(solverAId)).settings.capturedAt
    await PATCH_PLAN(jsonRequest("/x", { name: "Solver A renamed" }, "PATCH"), planCtx(solverAId))
    expect((await read(solverAId)).settings.capturedAt).toBe(before)
  })

  /**
   * A PLAN OWNS ITS WORLD (owner ruling 2026-08-05, and this test SUPERSEDES
   * the old "re-reads the world when the calendar is rewritten"). Saving a
   * calendar onto a plan the season does not run used to re-snapshot the season
   * over the plan's world, which silently moved every number the operator had
   * been working with. The plan keeps its own now.
   */
  it("KEEPS a plan's own world when its calendar is rewritten", async () => {
    actAs(ownerId)
    const was = (await read(solverAId)).settings

    // The season changes underneath the plan: a grade is now planned bigger.
    await (prisma as any).division.update({
      where: { id: grade8Division },
      data: { expectedTeams: 9 },
    })

    const res = await PATCH_PLAN(
      jsonRequest("/x", { assignment: { [weekendOne]: ["age:Grade 7", "age:Grade 8"] } }, "PATCH"),
      planCtx(solverAId)
    )
    expect(res.status).toBe(200)
    const now = (await res.json()).plan.settings
    expectWorld(now)
    // Untouched: same capture, same numbers. This is the whole ruling.
    expect(now.capturedAt).toBe(was.capturedAt)
    expect(now.state.units.find((u: any) => u.key === "age:Grade 8").teams).toBe(0)

    // And the drift line still has something honest to say, because the season
    // really has moved on from the world this plan holds.
    const live = await currentSettings(seasonId)
    expect(planDrift(now.state, live.state)).toEqual([
      "Grade 8 planned at 0 teams; the season now expects 9.",
    ])
  })

  it("gives a plan saved with no world of its own the season as it stands", async () => {
    actAs(ownerId)
    const created = await CREATE_PLAN(
      jsonRequest("/x", { name: "After the change", assignment: { [weekendTwo]: ["age:Grade 8"] } }),
      ctx()
    )
    const plan = (await created.json()).plan
    expectWorld(plan.settings)
    const grade8 = plan.settings.state.units.find((u: any) => u.key === "age:Grade 8")
    expect(grade8.teams).toBe(9)
    await DELETE_PLAN(jsonRequest("/x", undefined, "DELETE"), planCtx(plan.id))
  })

  /**
   * THE ACTIVE PLAN IS THE SEASON (owner ruling 2026-08-05, "one truth"). Its
   * world is read live rather than out of the column, so steps 1 and 2 writing
   * through to the season cannot leave its snapshot describing a season that no
   * longer exists. RETIRED 2026-08-07: the active plan is a sandbox like any
   * other now and reads stored settings; the test below pins the new truth.
   */
  it("keeps the ACTIVE plan's own stored world: sandboxes, full stop", async () => {
    // Write-through died (owner ruling 2026-08-07): the active plan reads its
    // STORED settings like any other plan, so a season-side change is allowed
    // to disagree with it — that difference is honest drift, said at
    // generation, not silently erased by a live re-read.
    actAs(ownerId)
    const imported = await read(importedPlanId)
    const grade8 = imported.settings.state.units.find((u: any) => u.key === "age:Grade 8")
    // The season moved to 9 earlier in this suite; the stored snapshot keeps
    // the number it was captured with rather than tracking the season.
    expect(grade8.teams).toBe(0)
    const live = await currentSettings(seasonId)
    expect(
      planDrift(imported.settings.state, live.state).length
    ).toBeGreaterThan(0)
  })
})

/* ------------------- the plan's own world, edited by hand ----------------- */

describe("PATCH {settings} — steps 1 and 2 write the plan's world", () => {
  const read = async (planId: string) =>
    (await (await GET_PLAN(jsonRequest("/x", undefined, "GET"), planCtx(planId))).json()).plan
  let ownPlanId: string

  it("creates a FRESH plan: grades prefilled, no gym time assumed", async () => {
    actAs(ownerId)
    const res = await CREATE_PLAN(jsonRequest("/x", { name: "Fresh world", fresh: true }), ctx())
    expect(res.status).toBe(200)
    const plan = (await res.json()).plan
    ownPlanId = plan.id
    // A fresh plan has no calendar at all: there is nothing to solve against
    // until the operator has said when the league runs.
    expect(plan.assignment).toEqual({})
    expect(plan.venues).toEqual({})
    expect(plan.isActive).toBe(false)

    const state = plan.settings.state
    // The grades ARE there, with the numbers the season knows.
    expect(state.units.map((u: any) => u.key).sort()).toEqual(["age:Grade 7", "age:Grade 8"])
    expect(state.units.find((u: any) => u.key === "age:Grade 8").teams).toBe(9)
    // And NOT one weekend is chosen, nor one gym attached.
    for (const w of Object.values(weekendsOf(plan.settings)) as any[]) {
      expect(w.chosen).toBe(false)
      expect(w.venues).toEqual([])
      expect(w.capacityGames).toBe(0)
    }
    // The gyms the league HAS are still listed, with their roles: the home gym
    // is known, the pool is named, and nobody has phoned anybody.
    expect(state.gyms.map((g: any) => g.venueId)).toEqual([venueId])
    expect(typeof state.courtBuffer).toBe("number")
    expect(state.gameSlotMinutes).toBeGreaterThan(0)
  })

  it("takes the operator's own world and does NOT touch the season", async () => {
    actAs(ownerId)
    const before = await seasonShape()

    const plan = await read(ownPlanId)
    const world = plan.settings.state
    // Step 1: a grade taken out, another re-estimated. Step 2: the weekend
    // chosen with the gym on it, on six courts and different hours.
    const next = {
      ...world,
      courtBuffer: 1,
      units: world.units.map((u: any) =>
        u.key === "age:Grade 7"
          ? { ...u, teams: 20, expected: 20, included: true }
          : { ...u, included: false }
      ),
      // And the building the plan says the league OWNS, which the test world
      // never named: activation has to hand that over too.
      gyms: world.gyms.map((g: any) => ({
        ...g,
        role: "home",
        courts: 6,
        openTime: "08:00",
        closeTime: "14:00",
      })),
      windows: world.windows.map((win: any) => ({
        ...win,
        weekends: win.weekends.map((w: any) =>
          w.sessionId !== weekendOne
            ? w
            : {
                ...w,
                chosen: true,
                venues: [{ venueId, name: "gym", capacityGames: 0, role: "home", fillOrder: 0 }],
              }
        ),
      })),
    }

    const res = await PATCH_PLAN(jsonRequest("/x", { settings: { state: next } }, "PATCH"), planCtx(ownPlanId))
    expect(res.status).toBe(200)
    const saved = (await res.json()).plan.settings.state
    expect(saved.courtBuffer).toBe(1)
    expect(saved.units.find((u: any) => u.key === "age:Grade 7").teams).toBe(20)
    expect(saved.units.find((u: any) => u.key === "age:Grade 8").included).toBe(false)
    expect(saved.gyms[0].courts).toBe(6)

    // THE SEASON DID NOT MOVE. Not the estimates, not the gym, not one
    // attachment: that is the whole architecture in one assertion.
    expect(await seasonShape()).toEqual(before)
  })

  it("clamps a world to ids this season really has", async () => {
    actAs(ownerId)
    const plan = await read(ownPlanId)
    const world = plan.settings.state
    const res = await PATCH_PLAN(
      jsonRequest(
        "/x",
        {
          settings: {
            state: {
              ...world,
              // A gym and a grade from nowhere, and a weekend that is not ours.
              gyms: [...world.gyms, { venueId: "not-a-venue", name: "Nowhere", role: "pool", courts: 4 }],
              units: [...world.units, { key: "age:Grade 99", label: "Grade 99", teams: 40 }],
              windows: [
                ...world.windows,
                {
                  label: "Never",
                  weekends: [
                    {
                      sessionId: "not-a-session",
                      label: "Never",
                      capacityGames: 99,
                      targetGamesPerTeam: 2,
                      venues: [],
                    },
                  ],
                },
              ],
            },
          },
        },
        "PATCH"
      ),
      planCtx(ownPlanId)
    )
    expect(res.status).toBe(200)
    const saved = (await res.json()).plan.settings.state
    expect(saved.gyms.map((g: any) => g.venueId)).toEqual([venueId])
    expect(saved.units.some((u: any) => u.key === "age:Grade 99")).toBe(false)
    expect(Object.keys(weekendsOf({ state: saved } as any))).not.toContain("not-a-session")
  })

  it("refuses a world edit on the imported reference, in words", async () => {
    actAs(ownerId)
    const imported = await read(importedPlanId)
    const res = await PATCH_PLAN(
      jsonRequest("/x", { settings: { state: imported.settings.state } }, "PATCH"),
      planCtx(importedPlanId)
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(IMPORTED_PLAN_READONLY_MESSAGE)
  })

  /**
   * ACTIVATION APPLIES THE WORLD TOO (owner ruling 2026-08-05, #5). Until now
   * the season kept its own gyms, hours and estimates and the confirmation had
   * to say so. A plan that owns its world hands the whole thing over.
   */
  it("applies the plan's WORLD to the season on activation, not only its calendar", async () => {
    actAs(ownerId)
    // Give the plan a calendar to apply as well, so both halves are checked.
    await PATCH_PLAN(
      jsonRequest("/x", { assignment: { [weekendOne]: ["age:Grade 7"] } }, "PATCH"),
      planCtx(ownPlanId)
    )

    const res = await ACTIVATE_PLAN(jsonRequest("/x", undefined), planCtx(ownPlanId))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.world).toMatchObject({ courtBuffer: 1 })

    // The estimates the plan holds are the season's now, and a grade the plan
    // left OUT asks the season for nothing.
    const divisions = await (prisma as any).division.findMany({
      where: { seasonId },
      select: { ageGroup: true, expectedTeams: true },
    })
    const byGrade = Object.fromEntries(divisions.map((d: any) => [d.ageGroup, d.expectedTeams]))
    expect(byGrade["Grade 7"]).toBe(20)
    expect(byGrade["Grade 8"]).toBe(0)

    // The buffer, the courts and the hours are the season's.
    const season = await (prisma as any).season.findUnique({
      where: { id: seasonId },
      select: { courtBuffer: true },
    })
    expect(season.courtBuffer).toBe(1)
    const link = await (prisma as any).seasonVenue.findFirst({
      where: { seasonId, venueId },
      select: { courtsAvailable: true, role: true, hours: true },
    })
    expect(link.courtsAvailable).toBe(6)
    expect(link.role).toBe("home")
    expect(link.hours.find((h: any) => h.dayOfWeek === 6)).toMatchObject({
      openTime: "08:00",
      closeTime: "14:00",
    })

    // The attachments are the plan's: weekend one has the gym, weekend two does
    // not, because this plan never chose it.
    const attached = async (sessionId: string) =>
      (
        await (prisma as any).seasonSessionDayVenue.count({
          where: { venueId, day: { sessionId } },
        })
      ) > 0
    expect(await attached(weekendOne)).toBe(true)
    expect(await attached(weekendTwo)).toBe(false)

    // And the calendar landed, which is what activation always did.
    expect((await sessionRow(weekendOne)).unitKeys).toEqual([`division:${grade7Division}`])

    // The plan and the season agree now, so there is no drift left to report.
    const after = await read(ownPlanId)
    const live = await currentSettings(seasonId)
    expect(planDrift(after.settings.state, live.state)).toEqual([])
  })

  it("refuses to delete the imported reference, with the reason", async () => {
    actAs(ownerId)
    // It is no longer active (the plan above took over), so only its being the
    // published record can be what stops the delete.
    const imported = await read(importedPlanId)
    expect(imported.isActive).toBe(false)
    const res = await DELETE_PLAN(jsonRequest("/x", undefined, "DELETE"), planCtx(importedPlanId))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(IMPORTED_PLAN_DELETE_MESSAGE)
    expect(await (prisma as any).seasonPlan.count({ where: { id: importedPlanId } })).toBe(1)
  })
})
