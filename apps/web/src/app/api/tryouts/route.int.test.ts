import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  createParentWithChildren,
  destroyWorld,
  daysFromNow,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST } from "./route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — tryout creation authz (owner call 2026-07-07): the whole team circle
 * that runs the team day-to-day can post tryouts — club owner/manager,
 * Staff (coaches) AND TeamManager. Parents cannot.
 */

let world: BuiltWorld
let tenantId: string
let teamId: string
let ownerId: string
let coachId: string
let teamManagerId: string
let parentId: string

const createTryout = (overrides: Record<string, unknown> = {}) =>
  POST(
    jsonRequest(`/api/tryouts`, {
      title: "U14 Spring Tryout",
      ageGroup: "U14",
      location: "Main Gym, 123 Court St",
      scheduledAt: daysFromNow(10).toISOString(),
      fee: 0,
      tenantId,
      teamId,
      ...overrides,
    })
  )

beforeAll(async () => {
  world = await buildWorld({
    seed: 1126,
    clubs: [{ teams: [{ headCoach: true }] }],
  })
  const club = world.clubs[0]
  tenantId = club.tenantId
  teamId = club.teams[0].id
  ownerId = club.owner.id
  coachId = club.teams[0].headCoach!.id

  // TeamManager on this team (invitation-granted role in production)
  const tmParent = await createParentWithChildren(world.ctx, { children: [] })
  teamManagerId = tmParent.parent.id
  await prisma.userRole.create({
    data: { userId: teamManagerId, role: "TeamManager", tenantId, teamId },
  })

  const outsider = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  parentId = outsider.parent.id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

// Security model 2026-07-20: a coach/team-manager may post a tryout FOR THEIR
// OWN TEAM (createTryout sets teamId = their team); the server enforces
// canActOnTeam. Club admins post for any team. A no-role parent never can.
// Cross-team + team-less-by-coach rejection is covered in authz/coach-scope.
describe("POST /api/tryouts — creation authz (integration)", () => {
  it("club owner can post a tryout", async () => {
    actAs(ownerId)
    const res = await createTryout({ title: "Owner-posted tryout" })
    expect(res.status).toBe(201)
  })

  it("team manager can post a tryout for their own team", async () => {
    actAs(teamManagerId)
    const res = await createTryout({ title: "TM-posted tryout" })
    expect(res.status).toBe(201)
  })

  it("coach (Staff) can post a tryout for their own team", async () => {
    actAs(coachId)
    const res = await createTryout({ title: "Coach-posted tryout" })
    expect(res.status).toBe(201)
  })

  it("a parent with no club role cannot", async () => {
    actAs(parentId)
    const res = await createTryout({ title: "Sneaky tryout" })
    expect(res.status).toBe(403)
  })
})

/**
 * QA-007 — capacity must hold under CONCURRENT signups: the pre-transaction
 * check is advisory; the serializable in-transaction re-check is the gate.
 */
describe("QA-007 concurrent capacity", () => {
  it("two simultaneous signups for the last spot: exactly one wins", async () => {
    const { POST: signupPost } = await import("./[id]/signup/route")
    const { NextRequest } = await import("next/server")

    // Fresh tryout with ONE spot, age group wide open.
    actAs(ownerId)
    const created = await (
      await createTryout({ title: "Race Tryout", ageGroup: "U18", maxParticipants: 1, publish: true })
    ).json()
    const tryoutId = created.id ?? created.tryout?.id

    const famA = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
    const famB = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })

    const fire = (parentUserId: string, playerId: string) => {
      actAs(parentUserId)
      return signupPost(
        new NextRequest(`http://localhost:3000/api/tryouts/${tryoutId}/signup`, {
          method: "POST",
          body: JSON.stringify({ registrations: [{ playerId }] }),
          headers: { "Content-Type": "application/json" },
        }),
        { params: { id: tryoutId } }
      )
    }

    // actAs is per-call global — serialize the SETUP but keep the two route
    // invocations racing inside the same event-loop turn.
    actAs(famA.parent.id)
    const reqA = signupPost(
      new NextRequest(`http://localhost:3000/api/tryouts/${tryoutId}/signup`, {
        method: "POST",
        body: JSON.stringify({ registrations: [{ playerId: famA.players[0].id }] }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: tryoutId } }
    )
    actAs(famB.parent.id)
    const reqB = fire(famB.parent.id, famB.players[0].id)

    const [resA, resB] = await Promise.all([reqA, reqB])
    const statuses = [resA.status, resB.status].sort()

    // Exactly one 201; the loser gets capacity-full (400) or a serialization
    // conflict (409) — never a second 201.
    expect(statuses[0]).toBe(201)
    expect([400, 409]).toContain(statuses[1])

    const count = await prisma.tryoutSignup.count({
      where: { tryoutId, status: { not: "CANCELLED" } },
    })
    expect(count).toBe(1)
  })
})
