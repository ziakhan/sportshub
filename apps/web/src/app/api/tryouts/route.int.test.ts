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

// Security ruling 2026-07-20: tryout creation is CLUB-ADMIN ONLY (fees +
// registration payments hang off it). Superseded the 2026-07-07 call that let
// coaches/team managers post — that was part of the coach-overreach the owner
// reported.
describe("POST /api/tryouts — creation authz (integration)", () => {
  it("club owner can post a tryout", async () => {
    actAs(ownerId)
    const res = await createTryout({ title: "Owner-posted tryout" })
    expect(res.status).toBe(201)
  })

  it("team manager can NOT post a tryout", async () => {
    actAs(teamManagerId)
    const res = await createTryout({ title: "TM-posted tryout" })
    expect(res.status).toBe(403)
  })

  it("coach (Staff) can NOT post a tryout", async () => {
    actAs(coachId)
    const res = await createTryout({ title: "Coach-posted tryout" })
    expect(res.status).toBe(403)
  })

  it("a parent with no club role cannot", async () => {
    actAs(parentId)
    const res = await createTryout({ title: "Sneaky tryout" })
    expect(res.status).toBe(403)
  })
})
