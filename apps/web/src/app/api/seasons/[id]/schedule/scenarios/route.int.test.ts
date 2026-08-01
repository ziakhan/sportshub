import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST as SCENARIOS } from "./route"
import { POST as PREVIEW } from "../preview/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * Scenario recommendations (owner 2026-08-01): the engine runs the baseline
 * plus automatic variants and each card's descriptor round-trips through
 * preview so "Use this scenario" shows exactly what would be saved.
 */

let world: BuiltWorld
let seasonId: string
let leagueOwnerId: string
let clubOwnerId: string

beforeAll(async () => {
  world = await buildWorld({
    seed: 1153,
    leagues: [
      {
        seasons: [
          {
            status: "FINALIZED",
            divisions: [{ teams: 4, rosterSize: 2 }],
            venue: { courts: 3 },
            sessions: [{ days: 2 }],
          },
        ],
      },
    ],
  })
  const season = world.leagues[0].seasons[0]
  seasonId = season.id
  leagueOwnerId = world.leagues[0].owner.id
  clubOwnerId = season.feederClub!.owner.id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("schedule scenarios", () => {
  it("club-side callers are refused", async () => {
    actAs(clubOwnerId)
    const res = await SCENARIOS(
      jsonRequest(`/api/seasons/${seasonId}/schedule/scenarios`) as any,
      { params: { id: seasonId } } as any
    )
    expect(res.status).toBe(403)
  })

  it("returns a baseline card plus runnable variants, and descriptors round-trip through preview", async () => {
    actAs(leagueOwnerId)
    const res = await SCENARIOS(
      jsonRequest(`/api/seasons/${seasonId}/schedule/scenarios`) as any,
      { params: { id: seasonId } } as any
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cards.length).toBeGreaterThanOrEqual(1)
    expect(body.cards[0].key).toBe("baseline")
    expect(body.cards[0].totals.games).toBeGreaterThan(0)

    // Every offered variant kept the season whole.
    for (const card of body.cards) expect(card.unscheduled).toBe(0)

    // A variant's descriptor previews to the SAME game count.
    const variant = body.cards.find((c: any) => c.descriptor)
    if (variant) {
      const preview = await PREVIEW(
        jsonRequest(`/api/seasons/${seasonId}/schedule/preview`, {
          scenario: variant.descriptor,
        }) as any,
        { params: { id: seasonId } } as any
      )
      expect(preview.status).toBe(200)
      const previewBody = await preview.json()
      expect(previewBody.games.length).toBe(variant.totals.games)
      if (variant.descriptor.excludeCourtIds?.length) {
        const excluded = new Set(variant.descriptor.excludeCourtIds)
        expect(previewBody.games.some((g: any) => excluded.has(g.courtId))).toBe(false)
      }
    }
  })
})
