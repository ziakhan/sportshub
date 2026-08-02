import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { applyAssignment, buildPlannerState } from "@/lib/scheduler/planner"
import { NO_PLAN_MESSAGE } from "@/lib/scheduler/planner-auth"
import { DELETE, POST } from "./publish/route"
import { GET as GET_CARD } from "./card/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * next/og rasterises through a wasm module that segfaults the vitest worker
 * (node 18 x64, 2026-08-02), so the card ROUTE is tested here and the
 * PICTURE is proven in the browser instead — scripts/demo/verify-plan-step4.mjs
 * loads the real PNG off the dev server. Everything this suite asserts about
 * the card is about who may fetch it and how long it may be cached.
 */
vi.mock("next/og", () => ({
  ImageResponse: class extends Response {
    constructor() {
      super("PNG", { headers: { "content-type": "image/png" } })
    }
  },
}))

/**
 * Publishing the season plan (plan wizard step 4, owner 2026-08-02). Two
 * contracts:
 *   - publish/unpublish is the league owner's, needs something to publish,
 *     and refuses a finalized season like every other step of the wizard
 *   - the card is PUBLIC once published and PRIVATE before: an operator sees
 *     their own preview, everyone else gets a 404 until they say go
 */

let world: BuiltWorld
let seasonId: string
let lockedSeasonId: string
let ownerId: string
let strangerId: string

const ctx = (id = seasonId) => ({ params: { id } })
const publishedAt = async (id = seasonId) =>
  (
    await (prisma as any).season.findUnique({
      where: { id },
      select: { planPublishedAt: true },
    })
  )?.planPublishedAt ?? null

/** Put a real calendar on the board: every grade onto the first weekend. */
async function keepACalendar(id = seasonId) {
  const state = await buildPlannerState(id)
  const weekend = state.windows[0].weekends[0]
  await applyAssignment(id, { [weekend.sessionId]: state.units.map((u) => u.key) })
}

beforeAll(async () => {
  world = await buildWorld({
    seed: 1141,
    leagues: [
      // League one exists only for its owner: a signed-in user with no
      // business publishing league two's calendar.
      { seasons: [] },
      {
        seasons: [
          {
            label: "Publishable",
            status: "REGISTRATION",
            divisions: [
              { name: "Grade 7", ageGroup: "Grade 7", teams: 2, rosterSize: 1, submissionStatus: "APPROVED" },
              { name: "Junior Girls", ageGroup: "Junior Girls", teams: 2, rosterSize: 1, submissionStatus: "APPROVED" },
            ],
            venue: { courts: 2, open: "09:00", close: "21:00" },
            sessions: [{ days: 2, startInDays: 7 }, { days: 2, startInDays: 40 }],
          },
          {
            label: "Already finalized",
            status: "FINALIZED",
            divisions: [
              { name: "Grade 8", ageGroup: "Grade 8", teams: 2, rosterSize: 1, submissionStatus: "APPROVED" },
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
})

afterAll(async () => {
  await destroyWorld(world.ctx)
})

describe("POST /planner/publish", () => {
  it("turns away a signed-out visitor", async () => {
    actAs(null)
    const res = await POST(jsonRequest("/x"), ctx())
    expect(res.status).toBe(401)
    expect(await publishedAt()).toBeNull()
  })

  it("turns away another league's owner", async () => {
    actAs(strangerId)
    const res = await POST(jsonRequest("/x"), ctx())
    expect(res.status).toBe(403)
    expect(await publishedAt()).toBeNull()
  })

  it("refuses when no calendar was ever kept, and says so in words", async () => {
    actAs(ownerId)
    const res = await POST(jsonRequest("/x"), ctx())
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(NO_PLAN_MESSAGE)
    expect(await publishedAt()).toBeNull()
  })

  it("publishes a kept calendar", async () => {
    await keepACalendar()
    actAs(ownerId)
    const res = await POST(jsonRequest("/x"), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })
    expect(await publishedAt()).toBeInstanceOf(Date)
  })

  it("republishes by moving the timestamp, never by erroring", async () => {
    const before = await publishedAt()
    actAs(ownerId)
    const res = await POST(jsonRequest("/x"), ctx())
    expect(res.status).toBe(200)
    const after = await publishedAt()
    expect(after).toBeInstanceOf(Date)
    expect(after!.getTime()).toBeGreaterThanOrEqual(before!.getTime())
  })

  it("refuses once the season is finalized", async () => {
    await keepACalendar(lockedSeasonId)
    actAs(ownerId)
    const res = await POST(jsonRequest("/x"), ctx(lockedSeasonId))
    expect(res.status).toBe(409)
    expect(await publishedAt(lockedSeasonId)).toBeNull()
  })

  it("404s a season that does not exist", async () => {
    actAs(ownerId)
    const res = await POST(jsonRequest("/x"), ctx("00000000-0000-0000-0000-000000000000"))
    expect(res.status).toBe(404)
  })
})

describe("GET /planner/card", () => {
  it("serves the operator their own preview, uncached", async () => {
    // Published from the block above; unpublish so this is the pre-publish case.
    actAs(ownerId)
    await DELETE(jsonRequest("/x", undefined, "DELETE"), ctx())
    expect(await publishedAt()).toBeNull()

    const res = await GET_CARD(jsonRequest("/x", undefined, "GET"), ctx())
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("image/png")
    expect(res.headers.get("cache-control")).toBe("private, no-store")
  })

  it("404s an unpublished calendar for everyone else", async () => {
    actAs(null)
    expect((await GET_CARD(jsonRequest("/x", undefined, "GET"), ctx())).status).toBe(404)
    actAs(strangerId)
    expect((await GET_CARD(jsonRequest("/x", undefined, "GET"), ctx())).status).toBe(404)
  })

  it("goes public the moment the plan is published", async () => {
    actAs(ownerId)
    expect((await POST(jsonRequest("/x"), ctx())).status).toBe(200)

    actAs(null)
    const res = await GET_CARD(jsonRequest("/x", undefined, "GET"), ctx())
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("image/png")
    expect(res.headers.get("cache-control")).toContain("s-maxage=300")

    // A signed-in parent is not an operator, and does not need to be.
    actAs(strangerId)
    expect((await GET_CARD(jsonRequest("/x", undefined, "GET"), ctx())).status).toBe(200)
  })

  it("404s a season that does not exist, published or not", async () => {
    actAs(ownerId)
    const res = await GET_CARD(jsonRequest("/x", undefined, "GET"), ctx("00000000-0000-0000-0000-000000000000"))
    expect(res.status).toBe(404)
  })
})

describe("DELETE /planner/publish", () => {
  it("turns away another league's owner", async () => {
    actAs(strangerId)
    const res = await DELETE(jsonRequest("/x", undefined, "DELETE"), ctx())
    expect(res.status).toBe(403)
    expect(await publishedAt()).toBeInstanceOf(Date)
  })

  it("takes the calendar back down, and the card with it", async () => {
    actAs(ownerId)
    const res = await DELETE(jsonRequest("/x", undefined, "DELETE"), ctx())
    expect(res.status).toBe(200)
    expect(await publishedAt()).toBeNull()

    actAs(null)
    expect((await GET_CARD(jsonRequest("/x", undefined, "GET"), ctx())).status).toBe(404)
  })

  it("leaves the kept calendar itself alone", async () => {
    const state = await buildPlannerState(seasonId)
    expect(state.windows.flatMap((w) => w.weekends).some((w) => w.assigned.length > 0)).toBe(true)
  })

  it("refuses once the season is finalized", async () => {
    actAs(ownerId)
    const res = await DELETE(jsonRequest("/x", undefined, "DELETE"), ctx(lockedSeasonId))
    expect(res.status).toBe(409)
  })
})
