import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  buildWorld,
  destroyWorld,
  createClub,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import {
  isClubAdmin,
  canActOnTeam,
  coachedTeamIds,
} from "@/lib/authz/team-scope"
import { POST as tryoutCreatePOST } from "../tryouts/route"
import { POST as finalizePOST } from "../teams/[id]/finalize/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — SECURITY: club-staff (coach) scoping (owner report 2026-07-20: a
 * one-team coach could see + act on the whole club). A coach's authority is
 * exactly the team(s) their role rows reference; club-wide actions are
 * owner/manager only. The test-worlds builder reproduces the real-world data
 * shape — a coach carries BOTH the legacy unscoped tenant Staff row AND a
 * team-scoped row — so this proves containment despite the stray row.
 */

let world: BuiltWorld
let tenantId: string
let ownerId: string
let coachA: string
let coachB: string
let teamAId: string
let teamBId: string

beforeAll(async () => {
  world = await buildWorld({ seed: 1135, leagues: [] })
  const club = await createClub(world.ctx, {
    teams: [{ headCoach: true }, { headCoach: true }],
  })
  tenantId = club.tenantId
  ownerId = club.owner.id
  teamAId = club.teams[0].id
  teamBId = club.teams[1].id
  coachA = club.teams[0].headCoach!.id
  coachB = club.teams[1].headCoach!.id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("scoping helpers", () => {
  it("coach is not a club admin; owner is", async () => {
    expect(await isClubAdmin(coachA, tenantId)).toBe(false)
    expect(await isClubAdmin(ownerId, tenantId)).toBe(true)
  })

  it("a coach may act only on their own team", async () => {
    expect(await canActOnTeam(coachA, tenantId, teamAId)).toBe(true)
    expect(await canActOnTeam(coachA, tenantId, teamBId)).toBe(false)
    expect(await canActOnTeam(coachB, tenantId, teamBId)).toBe(true)
    expect(await canActOnTeam(coachB, tenantId, teamAId)).toBe(false)
  })

  it("an admin may act on any team", async () => {
    expect(await canActOnTeam(ownerId, tenantId, teamAId)).toBe(true)
    expect(await canActOnTeam(ownerId, tenantId, teamBId)).toBe(true)
  })

  it("coachedTeamIds ignores the legacy unscoped tenant row", async () => {
    expect(await coachedTeamIds(coachA, tenantId)).toEqual([teamAId])
  })
})

describe("tryout creation is club-admin only", () => {
  const body = () => ({
    title: "Spring Tryout",
    ageGroup: "U12",
    location: "Main Gym",
    scheduledAt: new Date(Date.now() + 7 * 864e5).toISOString(),
    fee: 0,
    tenantId,
    teamId: teamAId,
  })

  it("a coach cannot create a tryout, even for their own team", async () => {
    actAs(coachA)
    const res = await tryoutCreatePOST(jsonRequest("/api/tryouts", body()))
    expect(res.status).toBe(403)
  })

  it("the club owner can", async () => {
    actAs(ownerId)
    const res = await tryoutCreatePOST(jsonRequest("/api/tryouts", body()))
    expect(res.status).toBe(201)
  })
})

describe("roster finalize is team-scoped", () => {
  const finalize = (teamId: string) =>
    finalizePOST(jsonRequest(`/api/teams/${teamId}/finalize`, {}), {
      params: { id: teamId },
    })

  it("a coach cannot finalize another team's roster", async () => {
    actAs(coachA)
    const res = await finalize(teamBId)
    expect(res.status).toBe(403)
  })

  it("a coach can act on their own team's roster (not forbidden)", async () => {
    actAs(coachA)
    const res = await finalize(teamAId)
    expect(res.status).not.toBe(403)
  })
})
