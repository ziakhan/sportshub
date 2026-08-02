import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { buildPlannerState } from "@/lib/scheduler/planner"
import { GET, PATCH } from "./route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * The planning number (plan wizard step 1). Owner ruling 2026-08-02, which
 * SUPERSEDES the earlier max(approved, expected) rule this file used to pin:
 * "The planning phase should not be looking at the real teams until we get to
 * the real scheduling. The estimate should be the number entered by the human,
 * not what's in the database. If teams sign up below the estimates that's
 * fine. If you go over, maybe a slight warning somewhere."
 *
 * Two contracts:
 *   - a grade plans on the operator's estimate and nothing else, per GRADE
 *     cluster (never per division). Registered teams ride along on the state
 *     as overlay data for the chips and the step-5 bars.
 *   - a registered grade is still editable while the season is unlocked. Only
 *     the season lock stops the save.
 */

let world: BuiltWorld
let seasonId: string
let lockedSeasonId: string
let ownerId: string

const ctx = (id = seasonId) => ({ params: { id } })

/** Every division of one grade, the way step 1 addresses a row. */
const divisionsOf = async (ageGroup: string, id = seasonId): Promise<string[]> =>
  (
    await (prisma as any).division.findMany({
      where: { seasonId: id, ageGroup },
      select: { id: true },
      orderBy: { id: "asc" },
    })
  ).map((d: any) => d.id)

/** Save a grade's estimate the way the stepper does: the operator's number
 *  split across that grade's divisions. */
async function estimate(ageGroup: string, perDivision: number[], id = seasonId) {
  const ids = await divisionsOf(ageGroup, id)
  return PATCH(
    jsonRequest(
      "/x",
      {
        expected: ids.map((divisionId, i) => ({
          divisionId,
          expectedTeams: perDivision[i] ?? 0,
        })),
      },
      "PATCH"
    ),
    ctx(id)
  )
}

const unit = async (ageGroup: string, id = seasonId) =>
  (await buildPlannerState(id)).units.find((u) => u.label === ageGroup)

beforeAll(async () => {
  world = await buildWorld({
    seed: 1142,
    leagues: [
      {
        seasons: [
          {
            label: "Planning while registration runs",
            status: "REGISTRATION",
            divisions: [
              // Registered, and the operator expects more to come.
              { name: "Grade 7", ageGroup: "Grade 7", teams: 3, rosterSize: 1 },
              // Registered past the estimate: a warning on screen, not a
              // bigger plan.
              { name: "Grade 8", ageGroup: "Grade 8", teams: 5, rosterSize: 1 },
              // Nobody in yet: the estimate IS the plan.
              { name: "Grade 9", ageGroup: "Grade 9", teams: 0 },
              // Neither number: not a grade anything plans for.
              { name: "Grade 10", ageGroup: "Grade 10", teams: 0 },
              // One GRADE, two divisions: the floor is the cluster's.
              { name: "Junior Girls A", ageGroup: "Junior Girls", teams: 2, rosterSize: 1 },
              { name: "Junior Girls B", ageGroup: "Junior Girls", teams: 1, rosterSize: 1 },
            ],
            venue: { courts: 2 },
            sessions: [{ days: 2, startInDays: 7 }],
          },
          {
            label: "Already finalized",
            status: "FINALIZED",
            divisions: [{ name: "Grade 7", ageGroup: "Grade 7", teams: 2, rosterSize: 1 }],
            venue: { courts: 2 },
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
  await destroyWorld(world.ctx)
})

describe("the planning number", () => {
  it("plans nothing for a grade nobody has estimated, teams in or not", async () => {
    // Three teams are registered; until a human says a number, this grade is
    // not in the plan (it still shows those three as overlay data).
    expect(await unit("Grade 7")).toMatchObject({ teams: 0, approved: 3, expected: 0 })
    expect((await unit("Grade 7"))!.source).toBe("none")
  })

  it("plans on the operator's number once they say one", async () => {
    expect((await estimate("Grade 7", [8])).status).toBe(200)

    expect(await unit("Grade 7")).toMatchObject({ teams: 8, approved: 3, expected: 8 })
    expect((await unit("Grade 7"))!.source).toBe("expected")
  })

  it("plans on the estimate even when more teams have registered", async () => {
    expect((await estimate("Grade 8", [2])).status).toBe(200)

    // Five are really in, the operator planned for two: the plan holds two
    // and the five are what the over-the-estimate warning is drawn from.
    expect(await unit("Grade 8")).toMatchObject({ teams: 2, approved: 5, expected: 2 })
    expect((await unit("Grade 8"))!.source).toBe("expected")
  })

  it("plans on the estimate alone before anyone registers", async () => {
    expect((await estimate("Grade 9", [4])).status).toBe(200)

    expect(await unit("Grade 9")).toMatchObject({ teams: 4, approved: 0, expected: 4 })
    expect((await unit("Grade 9"))!.source).toBe("expected")
  })

  it("leaves a grade with neither number at zero", async () => {
    expect(await unit("Grade 10")).toMatchObject({ teams: 0, approved: 0, expected: 0 })
    expect((await unit("Grade 10"))!.source).toBe("none")
  })

  it("counts the GRADE, not each division inside it", async () => {
    // Three teams registered across two divisions; the operator plans 2 + 2.
    expect((await estimate("Junior Girls", [2, 2])).status).toBe(200)
    expect(await unit("Junior Girls")).toMatchObject({ teams: 4, approved: 3, expected: 4 })

    // Drop the estimate under what registered: the plan follows the human.
    expect((await estimate("Junior Girls", [1, 1])).status).toBe(200)
    expect(await unit("Junior Girls")).toMatchObject({ teams: 2, approved: 3, expected: 2 })
  })
})

describe("PATCH /planner (step 1 saves)", () => {
  it("edits a grade that already has teams registered", async () => {
    // The ruling: planning is the operator's call while the season is open.
    const res = await estimate("Grade 8", [12])
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.updated).toBe(1)
    expect(body.state.units.find((u: any) => u.label === "Grade 8")).toMatchObject({
      teams: 12,
      approved: 5,
      expected: 12,
      source: "expected",
    })
  })

  it("still refuses once the season is finalized", async () => {
    const res = await estimate("Grade 7", [9], lockedSeasonId)
    expect(res.status).toBe(409)

    const ids = await divisionsOf("Grade 7", lockedSeasonId)
    const division = await (prisma as any).division.findUnique({
      where: { id: ids[0] },
      select: { expectedTeams: true },
    })
    expect(division.expectedTeams ?? 0).toBe(0)
  })

  it("hands step 1 the same numbers through GET", async () => {
    const res = await GET(jsonRequest("/x", undefined, "GET"), ctx())
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.state.units.find((u: any) => u.label === "Grade 7")).toMatchObject({
      teams: 8,
      approved: 3,
      expected: 8,
    })
    expect(body.seasonStatus).toBe("REGISTRATION")
  })
})
