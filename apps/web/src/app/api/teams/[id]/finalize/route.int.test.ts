import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  buildWorld,
  destroyWorld,
  createOffer,
  createParentWithChildren,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST } from "./route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — team finalize: G1 under-roster warning (F1: 3 accepted offers on a
 * team that wanted 10 still finalizes, but now says so), full roster stays
 * quiet, and the no-accepted-offers 400.
 */

let world: BuiltWorld
let ownerId: string
let underTeamId: string
let fullTeamId: string
let emptyTeamId: string

const finalize = (teamId: string) =>
  POST(jsonRequest(`/api/teams/${teamId}/finalize`, {}), { params: { id: teamId } })

async function acceptOffers(ctx: BuiltWorld["ctx"], teamId: string, count: number) {
  for (let i = 0; i < count; i++) {
    const { players } = await createParentWithChildren(ctx, { children: [{ age: 11 }] })
    await createOffer(ctx, { teamId, playerId: players[0].id, status: "ACCEPTED" })
  }
}

beforeAll(async () => {
  world = await buildWorld({ seed: 1103, clubs: [{ teams: [{}, {}, {}] }] })
  const club = world.clubs[0]
  ownerId = club.owner.id
  ;[underTeamId, fullTeamId, emptyTeamId] = club.teams.map((t) => t.id)
  await acceptOffers(world.ctx, underTeamId, 3)
  await acceptOffers(world.ctx, fullTeamId, 5)
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("POST /api/teams/[id]/finalize (integration)", () => {
  it("G1 — finalizes an under-roster team but warns about the player count", async () => {
    actAs(ownerId)
    const res = await finalize(underTeamId)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.assignments).toHaveLength(3)
    expect(body.warnings).toEqual([
      "Roster has 3 player(s) — below the minimum of 5 needed to field a lineup.",
    ])
  })

  it("stays quiet when the roster can field a lineup", async () => {
    actAs(ownerId)
    const res = await finalize(fullTeamId)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assignments).toHaveLength(5)
    expect(body.warnings).toEqual([])
  })

  it("rejects finalize with no accepted offers", async () => {
    actAs(ownerId)
    const res = await finalize(emptyTeamId)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "No accepted offers to finalize" })
  })
})
