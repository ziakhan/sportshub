import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  createOffer,
  createParentWithChildren,
  daysFromNow,
  destroyWorld,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST } from "./route"
import { PATCH } from "./[id]/route"
import { GET as PRACTICES_GET } from "../teams/[id]/practices/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — team events (owner ask 2026-07-07): one calendar. Events are created
 * by team staff / club managers (multi-team) / league owners (across their
 * league's approved teams), members get ONE bell each (deduped across
 * teams), and events ride the same calendar endpoint as practices + games.
 */

let world: BuiltWorld
let teamAId: string
let teamBId: string
let coachAId: string
let clubOwnerId: string
let bothTeamsParentId: string
let outsiderParentId: string
let leagueOwnerId: string
let leagueTeamIds: string[]

const createEvent = (teamIds: string[], overrides: Record<string, unknown> = {}) =>
  POST(
    jsonRequest(`/api/team-events`, {
      teamIds,
      title: "Team Photo Day",
      startAt: daysFromNow(5).toISOString(),
      durationMinutes: 60,
      location: "Main Gym",
      ...overrides,
    })
  )

const eventBells = (userId: string) =>
  prisma.notification.findMany({
    where: { userId, type: "team_event" },
    select: { id: true, title: true, link: true },
  })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1127,
    clubs: [{ teams: [{ headCoach: true }, { headCoach: true }] }],
    leagues: [
      {
        seasons: [
          { status: "REGISTRATION", divisions: [{ teams: 2, rosterSize: 2 }] },
        ],
      },
    ],
  })
  const club = world.clubs[0]
  teamAId = club.teams[0].id
  teamBId = club.teams[1].id
  coachAId = club.teams[0].headCoach!.id
  clubOwnerId = club.owner.id
  leagueOwnerId = world.leagues[0].owner.id
  leagueTeamIds = world.leagues[0].seasons[0].divisions[0].submissions.map((s) => s.teamId)

  // One parent with a kid rostered on EACH club team — the dedupe subject
  const family = await createParentWithChildren(world.ctx, { children: [{ age: 12 }, { age: 13 }] })
  bothTeamsParentId = family.parent.id
  await createOffer(world.ctx, { teamId: teamAId, playerId: family.players[0].id, status: "ACCEPTED" })
  await createOffer(world.ctx, { teamId: teamBId, playerId: family.players[1].id, status: "ACCEPTED" })

  const outsider = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  outsiderParentId = outsider.parent.id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("team events (integration)", () => {
  it("coach creates an event on their own team; family belled with calendar link", async () => {
    actAs(coachAId)
    const res = await createEvent([teamAId], { title: "Film session" })
    expect(res.status).toBe(201)
    const { event } = await res.json()
    expect(event.teams.map((t: any) => t.id)).toEqual([teamAId])

    const bells = await eventBells(bothTeamsParentId)
    expect(bells).toHaveLength(1)
    expect(bells[0].link).toBe(`/teams/${teamAId}/calendar`)
  })

  it("club owner pushes one event to BOTH teams — members get ONE bell, not two", async () => {
    await prisma.notification.deleteMany({
      where: { userId: bothTeamsParentId, type: "team_event" },
    })
    actAs(clubOwnerId)
    const res = await createEvent([teamAId, teamBId], { title: "Club Photo Day" })
    expect(res.status).toBe(201)
    const { event } = await res.json()
    expect(event.teams).toHaveLength(2)

    // Parent is in both teams' circles → exactly one bell (dedup)
    const bells = await eventBells(bothTeamsParentId)
    expect(bells).toHaveLength(1)
    expect(bells[0].title).toContain("Club Photo Day")
  })

  it("coach cannot attach a team they don't manage", async () => {
    actAs(coachAId)
    const res = await createEvent([teamAId, leagueTeamIds[0]])
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.deniedTeamIds).toEqual([leagueTeamIds[0]])
  })

  it("league owner spans teams via approved submissions", async () => {
    actAs(leagueOwnerId)
    const res = await createEvent(leagueTeamIds, { title: "League Media Day" })
    expect(res.status).toBe(201)
    const { event } = await res.json()
    expect(event.teams).toHaveLength(leagueTeamIds.length)
  })

  it("a parent cannot create events", async () => {
    actAs(bothTeamsParentId)
    expect((await createEvent([teamAId])).status).toBe(403)
  })

  it("events ride the same calendar endpoint as practices + games", async () => {
    actAs(bothTeamsParentId)
    const res = await PRACTICES_GET(
      jsonRequest(`/api/teams/${teamAId}/practices?includeGames=1`, undefined, "GET"),
      { params: { id: teamAId } }
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    const titles = body.events.map((e: any) => e.title)
    expect(titles).toContain("Film session")
    expect(titles).toContain("Club Photo Day")
  })

  it("cancelling notifies the circle; event stays visible as CANCELLED", async () => {
    actAs(coachAId)
    const { event } = await (await createEvent([teamAId], { title: "To be cancelled" })).json()

    await prisma.notification.deleteMany({
      where: { userId: bothTeamsParentId, type: "team_event" },
    })
    const res = await PATCH(
      jsonRequest(`/api/team-events/${event.id}`, { status: "CANCELLED" }, "PATCH"),
      { params: { id: event.id } }
    )
    expect(res.status).toBe(200)
    expect((await res.json()).event.status).toBe("CANCELLED")

    const bells = await eventBells(bothTeamsParentId)
    expect(bells).toHaveLength(1)
    expect(bells[0].title).toContain("cancelled")
  })
})
