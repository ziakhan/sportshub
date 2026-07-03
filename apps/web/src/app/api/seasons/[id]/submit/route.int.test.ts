import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  destroyWorld,
  createParentWithChildren,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST } from "./route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — club-submits-team boundary scenarios against the real database:
 * H15 (division at maxTeams), H20 (roster snapshot frozen at submit),
 * deadline and status gates, tenant authz. The unit variant
 * (route.test.ts) mocks prisma; this suite proves the same route against
 * real counts, constraints and cascades.
 */

let world: BuiltWorld
let seasonOpen: BuiltWorld["leagues"][0]["seasons"][0]
let seasonPastDeadline: BuiltWorld["leagues"][0]["seasons"][0]
let seasonFinalized: BuiltWorld["leagues"][0]["seasons"][0]
let ownerId: string
let outsiderId: string
let freshTeamId: string
let activePlayerIds: string[]

const submit = (seasonId: string, teamId: string, divisionId: string) =>
  POST(jsonRequest(`/api/seasons/${seasonId}/submit`, { teamId, divisionId }), {
    params: { id: seasonId },
  })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1101,
    leagues: [
      {
        seasons: [
          {
            status: "REGISTRATION",
            divisions: [
              { teams: 2, maxTeams: 2, rosterSize: 0 }, // full (H15)
              { teams: 0, maxTeams: 4 }, // open
            ],
            venue: false,
            sessions: [],
          },
          {
            status: "REGISTRATION",
            registrationDeadlineInDays: -1,
            divisions: [{ teams: 0 }],
            venue: false,
            sessions: [],
          },
          {
            status: "FINALIZED",
            divisions: [{ teams: 0 }],
            venue: false,
            sessions: [],
          },
        ],
      },
    ],
  })
  const { ctx } = world
  ;[seasonOpen, seasonPastDeadline, seasonFinalized] = world.leagues[0].seasons
  const feeder = seasonOpen.feederClub!
  ownerId = feeder.owner.id

  // A team not yet submitted anywhere: 3 ACTIVE players + 1 INACTIVE —
  // the snapshot must include only the ACTIVE ones.
  const team = await prisma.team.create({
    data: {
      tenantId: feeder.tenantId,
      name: ctx.name(`Fresh ${ctx.next()}`),
      ageGroup: "U12",
      gender: "MALE",
      season: "Test Season",
    },
  })
  freshTeamId = team.id
  const { players } = await createParentWithChildren(ctx, {
    children: [{ age: 11 }, { age: 11 }, { age: 11 }, { age: 11 }],
  })
  activePlayerIds = players.slice(0, 3).map((p) => p.id)
  for (const [i, p] of players.entries()) {
    await prisma.teamPlayer.create({
      data: {
        teamId: team.id,
        playerId: p.id,
        status: i < 3 ? "ACTIVE" : "INACTIVE",
        jerseyNumber: i + 4,
      },
    })
  }

  const outsider = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  outsiderId = outsider.parent.id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("POST /api/seasons/[id]/submit (integration)", () => {
  it("rejects a user with no club role on the team's tenant", async () => {
    actAs(outsiderId)
    const res = await submit(seasonOpen.id, freshTeamId, seasonOpen.divisions[1].id)
    expect(res.status).toBe(403)
  })

  it("rejects an unauthenticated request", async () => {
    actAs(null)
    const res = await submit(seasonOpen.id, freshTeamId, seasonOpen.divisions[1].id)
    expect(res.status).toBe(401)
  })

  it("H15 — rejects submission into a division at maxTeams, counting real rows", async () => {
    actAs(ownerId)
    const res = await submit(seasonOpen.id, freshTeamId, seasonOpen.divisions[0].id)
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({
      error: "Division capacity reached (2 teams).",
    })
  })

  it("submits into an open division and freezes only ACTIVE players into the roster", async () => {
    actAs(ownerId)
    const res = await submit(seasonOpen.id, freshTeamId, seasonOpen.divisions[1].id)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.playerCount).toBe(3)

    const roster = await prisma.seasonRoster.findFirst({
      where: { seasonId: seasonOpen.id, teamSubmission: { teamId: freshTeamId } },
      include: { players: true },
    })
    expect(roster).not.toBeNull()
    expect(roster!.players.map((p) => p.playerId).sort()).toEqual([...activePlayerIds].sort())
  })

  it("H20 — the roster snapshot stays frozen when the club roster changes afterwards", async () => {
    const { players } = await createParentWithChildren(world.ctx, { children: [{ age: 11 }] })
    await prisma.teamPlayer.create({
      data: { teamId: freshTeamId, playerId: players[0].id, status: "ACTIVE" },
    })
    const roster = await prisma.seasonRoster.findFirst({
      where: { seasonId: seasonOpen.id, teamSubmission: { teamId: freshTeamId } },
      include: { players: true },
    })
    expect(roster!.players).toHaveLength(3)
    expect(roster!.players.map((p) => p.playerId)).not.toContain(players[0].id)
  })

  it("rejects submitting the same team to the same season twice", async () => {
    actAs(ownerId)
    const res = await submit(seasonOpen.id, freshTeamId, seasonOpen.divisions[1].id)
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({
      error: "This team is already submitted to this league",
    })
  })

  it("rejects when the registration deadline has passed", async () => {
    actAs(ownerId)
    const res = await submit(seasonPastDeadline.id, freshTeamId, seasonPastDeadline.divisions[0].id)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Registration deadline has passed" })
  })

  it("rejects when the season is not open for registration", async () => {
    actAs(ownerId)
    const res = await submit(seasonFinalized.id, freshTeamId, seasonFinalized.divisions[0].id)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe("SEASON_NOT_OPEN")
  })
})
