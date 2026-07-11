import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  createOffer,
  createParentWithChildren,
  destroyWorld,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { GET as MINE } from "./route"
import { PUT as RSVP_PUT } from "../../rsvp/route"
import { rsvpKey } from "@/lib/rsvp-shared"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — My Calendar: one cross-team feed per user. A parent with kids on two
 * teams sees both teams' items with family RSVP context; a coach sees their
 * team's items with the roster for roll-ups; a game between two member
 * teams appears once; users with no teams get an empty payload.
 */

let world: BuiltWorld
let teamAId: string
let teamBId: string
let coachId: string
let parentId: string // kid1 on team A, kid2 on team B
let kid1: string
let kid2: string
let noTeamUserId: string

let practiceAId: string
let gameABId: string
let eventBId: string

const mine = () => MINE()

beforeAll(async () => {
  world = await buildWorld({
    seed: 1126,
    clubs: [{ teams: [{ headCoach: true }, {}] }],
  })
  const club = world.clubs[0]
  teamAId = club.teams[0].id
  teamBId = club.teams[1].id
  coachId = club.teams[0].headCoach!.id

  const family = await createParentWithChildren(world.ctx, {
    children: [{ age: 11 }, { age: 13 }],
  })
  parentId = family.parent.id
  kid1 = family.players[0].id
  kid2 = family.players[1].id
  await createOffer(world.ctx, { teamId: teamAId, playerId: kid1, status: "ACCEPTED" })
  await createOffer(world.ctx, { teamId: teamBId, playerId: kid2, status: "ACCEPTED" })

  const loner = await createParentWithChildren(world.ctx, { children: [{ age: 10 }] })
  noTeamUserId = loner.parent.id

  const HOUR = 3_600_000
  practiceAId = (
    await (prisma as any).practice.create({
      data: {
        tenantId: club.tenantId,
        teamId: teamAId,
        scheduledAt: new Date(Date.now() + 48 * HOUR),
        duration: 90,
        location: "Gym 1",
      },
    })
  ).id
  // Game BETWEEN the two member teams — must appear once, not twice
  gameABId = (
    await (prisma as any).game.create({
      data: {
        homeTeamId: teamAId,
        awayTeamId: teamBId,
        scheduledAt: new Date(Date.now() + 72 * HOUR),
      },
    })
  ).id
  eventBId = (
    await (prisma as any).teamEvent.create({
      data: {
        createdById: coachId,
        title: "Fundraiser",
        startAt: new Date(Date.now() + 96 * HOUR),
        durationMinutes: 120,
        teams: { create: [{ teamId: teamBId }] },
      },
    })
  ).id
})

afterAll(async () => {
  await (prisma as any).eventRsvp.deleteMany({
    where: { itemId: { in: [practiceAId, gameABId, eventBId].filter(Boolean) } },
  })
  await (prisma as any).teamEvent.deleteMany({ where: { id: eventBId ?? "" } })
  await (prisma as any).game.deleteMany({ where: { id: gameABId ?? "" } })
  await (prisma as any).practice.deleteMany({ where: { id: practiceAId ?? "" } })
  if (world) await destroyWorld(world.ctx)
})

describe("My Calendar (integration)", () => {
  it("requires a session", async () => {
    actAs(null)
    expect((await mine()).status).toBe(401)
  })

  it("parent sees both kids' teams, all items, and family RSVP context", async () => {
    actAs(parentId)
    const res = await mine()
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data.teams).toHaveLength(2)
    expect(data.teams.every((t: any) => t.family && !t.staff)).toBe(true)

    const ids = data.items.map((i: any) => i.id)
    expect(ids).toContain(practiceAId)
    expect(ids).toContain(eventBId)
    // the cross-team game appears exactly once, tagged with both teams
    expect(ids.filter((id: string) => id === gameABId)).toHaveLength(1)
    const game = data.items.find((i: any) => i.id === gameABId)
    expect(game.teamIds.sort()).toEqual([teamAId, teamBId].sort())

    expect(data.rsvp.playersByTeam[teamAId].map((p: any) => p.id)).toEqual([kid1])
    expect(data.rsvp.playersByTeam[teamBId].map((p: any) => p.id)).toEqual([kid2])
    expect(data.rsvp.rosterByTeam).toEqual({})
  })

  it("answers land in byItem and both kids can RSVP the shared game", async () => {
    actAs(parentId)
    for (const [playerId, status] of [
      [kid1, "GOING"],
      [kid2, "NOT_GOING"],
    ] as const) {
      const res = await RSVP_PUT(
        jsonRequest("/api/rsvp", { playerId, itemType: "GAME", itemId: gameABId, status }, "PUT")
      )
      expect(res.status).toBe(200)
    }
    const data = await (await mine()).json()
    const answers = data.rsvp.byItem[rsvpKey("GAME", gameABId)]
    expect(answers[kid1].status).toBe("GOING")
    expect(answers[kid2].status).toBe("NOT_GOING")
  })

  it("coach gets the staff side: roster for roll-ups, no family players", async () => {
    actAs(coachId)
    const data = await (await mine()).json()
    const teamA = data.teams.find((t: any) => t.teamId === teamAId)
    expect(teamA.staff).toBe(true)
    expect(teamA.family).toBe(false)
    expect(data.rsvp.rosterByTeam[teamAId].map((p: any) => p.id)).toEqual([kid1])
    expect(data.rsvp.playersByTeam).toEqual({})
    // coach of team A still sees the game (team A plays in it)
    expect(data.items.map((i: any) => i.id)).toContain(gameABId)
  })

  it("a user with no team memberships gets an empty calendar", async () => {
    actAs(noTeamUserId)
    const data = await (await mine()).json()
    expect(data.teams).toEqual([])
    expect(data.items).toEqual([])
  })
})
