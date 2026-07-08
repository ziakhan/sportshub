import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST } from "./route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — schedule commit fan-out (owner storyline 2026-07-07): committing a
 * session schedule must reach every team's full circle — club managers get
 * one club-level bell; team staff + rostered families get a bell (+email)
 * pointing at the team calendar. Nobody is double-belled.
 */

let world: BuiltWorld
let seasonId: string
let leagueOwnerId: string
let clubOwnerId: string
let teamId: string
let parentId: string

beforeAll(async () => {
  world = await buildWorld({
    seed: 1125,
    leagues: [
      {
        seasons: [
          {
            status: "FINALIZED",
            divisions: [{ teams: 2, rosterSize: 3 }],
            venue: { courts: 2 },
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

  const submission = season.divisions[0].submissions[0]
  teamId = submission.teamId
  const player = await prisma.player.findUnique({
    where: { id: submission.playerIds[0] },
    select: { parentId: true },
  })
  parentId = player!.parentId
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

const bells = (userId: string) =>
  prisma.notification.findMany({
    where: { userId, type: "schedule_published" },
    select: { link: true, message: true },
  })

describe("POST /api/seasons/[id]/schedule/commit — notification fan-out (integration)", () => {
  it("commits games and notifies club managers, team circle; no double-bell", async () => {
    actAs(leagueOwnerId)
    const res = await POST(
      jsonRequest(`/api/seasons/${seasonId}/schedule/commit`, { replaceExisting: true }),
      { params: { id: seasonId } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.created).toBeGreaterThan(0)

    // Club-level: feeder club's owner got exactly ONE bell (not one per team)
    const clubBells = await bells(clubOwnerId)
    expect(clubBells).toHaveLength(1)

    // Team-level: a rostered player's parent got the team bell with the
    // calendar link and their game count
    const parentBells = await bells(parentId)
    expect(parentBells).toHaveLength(1)
    expect(parentBells[0].link).toBe(`/teams/${teamId}/calendar`)
    expect(parentBells[0].message).toMatch(/\d+ games scheduled/)

    // The games really exist for that team
    const games = await prisma.game.count({
      where: { seasonId, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    })
    expect(games).toBeGreaterThan(0)
  })

  it("non-owner cannot commit", async () => {
    actAs(clubOwnerId)
    const res = await POST(
      jsonRequest(`/api/seasons/${seasonId}/schedule/commit`, { replaceExisting: true }),
      { params: { id: seasonId } }
    )
    expect(res.status).toBe(403)
  })
})
