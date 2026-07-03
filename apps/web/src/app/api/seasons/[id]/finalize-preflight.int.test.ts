import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { PATCH } from "./route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — finalize preflight: G5 (1-team division warns, non-blocking),
 * H17 (zero approved teams blocks), and the existing grouped-division
 * blocker, all against real season structures.
 */

let world: BuiltWorld
let seasons: BuiltWorld["leagues"][0]["seasons"]
let ownerId: string

// The builder leaves periodLengthMinutes/tiebreakerOrder unset — supply the
// remaining finalize requirements in the PATCH body, as the UI does.
const finalize = (seasonId: string) =>
  PATCH(
    jsonRequest(
      `/api/seasons/${seasonId}`,
      { status: "FINALIZED", periodLengthMinutes: 20, tiebreakerOrder: ["WINS"] },
      "PATCH"
    ),
    { params: { id: seasonId } }
  )

beforeAll(async () => {
  world = await buildWorld({
    seed: 1102,
    leagues: [
      {
        seasons: [
          // [0] healthy: two 2-team divisions
          { status: "REGISTRATION", divisions: [{ teams: 2 }, { teams: 2 }] },
          // [1] G5: a 1-team division alongside a schedulable one
          { status: "REGISTRATION", divisions: [{ teams: 2 }, { teams: 1 }] },
          // [2] H17: structure complete but zero teams anywhere
          { status: "REGISTRATION", divisions: [{ teams: 0 }] },
          // [3] pooled 1-team division — existing blocking rule
          {
            status: "REGISTRATION",
            allowCrossDivisionScheduling: true,
            divisions: [{ teams: 1 }, { teams: 2 }],
            schedulingGroups: [{ divisions: [0] }],
          },
        ],
      },
    ],
  })
  seasons = world.leagues[0].seasons
  ownerId = world.leagues[0].owner.id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("PATCH /api/seasons/[id] — finalize preflight (integration)", () => {
  it("finalizes a healthy season with no warnings", async () => {
    actAs(ownerId)
    const res = await finalize(seasons[0].id)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("FINALIZED")
    expect(body.warnings).toEqual([])
  })

  it("G5 — finalizes but warns when an ungrouped division has fewer than 2 teams", async () => {
    actAs(ownerId)
    const res = await finalize(seasons[1].id)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("FINALIZED")
    expect(body.warnings).toEqual([
      'Division "Division 2" has 1 team(s) — the scheduler will skip it (needs at least 2).',
    ])
  })

  it("H17 — blocks finalize when the season has zero approved teams", async () => {
    actAs(ownerId)
    const res = await finalize(seasons[2].id)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.missing).toContain(
      "No approved teams — approve at least one team before finalizing"
    )
  })

  it("still blocks a 1-team division that sits inside a scheduling group", async () => {
    actAs(ownerId)
    const res = await finalize(seasons[3].id)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(
      body.missing.some((m: string) => m.includes("is in a scheduling group but has 1 team(s)"))
    ).toBe(true)
    // grouped shortfall is the blocker, so it must not ALSO appear as a warning
    expect(body.warnings ?? []).toEqual([])
  })

  it("rejects finalize from a non-owner", async () => {
    actAs(world.leagues[0].seasons[0].feederClub!.owner.id)
    const res = await finalize(seasons[0].id)
    expect(res.status).toBe(403)
  })
})
