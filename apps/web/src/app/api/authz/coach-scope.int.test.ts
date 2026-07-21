import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  buildWorld,
  destroyWorld,
  createClub,
  createParentWithChildren,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { NextRequest } from "next/server"
import { actAs, jsonRequest } from "@/test/integration-harness"

// GET routes here read request.nextUrl.searchParams, so they need a real
// NextRequest (a plain Request has no nextUrl).
const getReq = (url: string) => new NextRequest(`http://localhost:3000${url}`)
import {
  isClubAdmin,
  canActOnTeam,
  coachedTeamIds,
} from "@/lib/authz/team-scope"
import { POST as tryoutCreatePOST, GET as tryoutGET } from "../tryouts/route"
import { GET as teamsGET } from "../teams/route"
import { POST as finalizePOST } from "../teams/[id]/finalize/route"
import { GET as obligationsGET } from "../obligations/route"
import { GET as offersGET } from "../offers/route"
import { POST as tournamentsPOST } from "../tournaments/route"
import { canManageTeamRoster } from "@/lib/teams/roster-access"
import { canScoreGame } from "@/lib/scoring/authz"
import { prisma } from "@youthbasketballhub/db"

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
let teamCId: string
let coachC: string

beforeAll(async () => {
  world = await buildWorld({ seed: 1135, leagues: [] })
  const club = await createClub(world.ctx, {
    teams: [{ headCoach: true }, { headCoach: true }, { headCoach: true }],
  })
  tenantId = club.tenantId
  ownerId = club.owner.id
  teamAId = club.teams[0].id
  teamBId = club.teams[1].id
  teamCId = club.teams[2].id
  coachA = club.teams[0].headCoach!.id
  coachB = club.teams[1].headCoach!.id
  coachC = club.teams[2].headCoach!.id
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

describe("tryout creation is team-scoped for coaches", () => {
  const body = (teamId: string) => ({
    title: "Spring Tryout",
    ageGroup: "U12",
    location: "Main Gym",
    scheduledAt: new Date(Date.now() + 7 * 864e5).toISOString(),
    fee: 0,
    tenantId,
    teamId,
  })

  it("a coach CAN create a tryout for their own team", async () => {
    actAs(coachA)
    const res = await tryoutCreatePOST(jsonRequest("/api/tryouts", body(teamAId)))
    expect(res.status).toBe(201)
  })

  it("a coach can NOT create a tryout for another team", async () => {
    actAs(coachA)
    const res = await tryoutCreatePOST(jsonRequest("/api/tryouts", body(teamBId)))
    expect(res.status).toBe(403)
  })

  it("a coach can NOT create a club-wide (team-less) tryout", async () => {
    actAs(coachA)
    const { teamId, ...noTeam } = body(teamAId)
    void teamId
    const res = await tryoutCreatePOST(jsonRequest("/api/tryouts", noTeam))
    expect(res.status).toBe(403)
  })

  it("the club owner can create for any team", async () => {
    actAs(ownerId)
    const res = await tryoutCreatePOST(jsonRequest("/api/tryouts", body(teamBId)))
    expect(res.status).toBe(201)
  })
})

describe("read APIs are scoped for coaches (no club-wide leak)", () => {
  it("GET /api/teams returns only the coach's team", async () => {
    actAs(coachA)
    const res = await teamsGET(getReq(`/api/teams?tenantId=${tenantId}`))
    expect(res.status).toBe(200)
    const { teams } = await res.json()
    expect(teams.map((t: any) => t.id).sort()).toEqual([teamAId])
  })

  it("GET /api/teams returns every team for an admin", async () => {
    actAs(ownerId)
    const res = await teamsGET(getReq(`/api/teams?tenantId=${tenantId}`))
    const { teams } = await res.json()
    expect(teams.map((t: any) => t.id).sort()).toEqual([teamAId, teamBId, teamCId].sort())
  })

  it("GET /api/tryouts scopes a coach to their own team's tryouts", async () => {
    // owner made a teamB tryout above; coachA (teamA) must not see it
    actAs(coachA)
    const res = await tryoutGET(getReq(`/api/tryouts?tenantId=${tenantId}`))
    expect(res.status).toBe(200)
    const { tryouts } = await res.json()
    const teamIds = new Set(tryouts.map((t: any) => t.team?.id))
    expect(teamIds.has(teamBId)).toBe(false)
    for (const t of tryouts) expect(t.team?.id).toBe(teamAId)
  })
})

describe("audit fixes — read scoping + cross-team + spoofing", () => {
  it("canManageTeamRoster: a coach cannot manage another team's roster (teamId:null hole closed)", async () => {
    // coachA already carries a legacy unscoped tenant Staff row (teamId:null)
    // from the builder — the exact leak the audit found. It must NOT grant
    // roster power over teamB, only over their own teamA.
    const nullRow = await prisma.userRole.findFirst({
      where: { userId: coachA, role: "Staff", tenantId, teamId: null },
    })
    expect(nullRow).not.toBeNull()
    expect(await canManageTeamRoster(coachA, false, { id: teamAId, tenantId })).toBe(true)
    expect(await canManageTeamRoster(coachA, false, { id: teamBId, tenantId })).toBe(false)
  })

  it("GET /api/obligations?tenantId is admin-only (no coach financial read)", async () => {
    actAs(coachA)
    const denied = await obligationsGET(getReq(`/api/obligations?tenantId=${tenantId}`))
    expect(denied.status).toBe(403)
    actAs(ownerId)
    const ok = await obligationsGET(getReq(`/api/obligations?tenantId=${tenantId}`))
    expect(ok.status).toBe(200)
  })

  it("GET /api/offers?tenantId scopes a coach to their team; ?teamId blocks another team", async () => {
    actAs(coachA)
    const list = await offersGET(getReq(`/api/offers?tenantId=${tenantId}`))
    expect(list.status).toBe(200)
    const otherTeam = await offersGET(getReq(`/api/offers?teamId=${teamBId}`))
    expect(otherTeam.status).toBe(403)
  })

  it("tournament creation cannot spoof a club the caller does not manage", async () => {
    // A coach (no club-admin, no league role) cannot attribute a tournament
    // to this club.
    actAs(coachA)
    const res = await tournamentsPOST(
      jsonRequest("/api/tournaments", {
        name: "Spoof Cup",
        tenantId,
        city: "Toronto",
        country: "CA",
        teamFee: 100,
        startDate: new Date(Date.now() + 30 * 864e5).toISOString(),
        endDate: new Date(Date.now() + 31 * 864e5).toISOString(),
      })
    )
    expect(res.status).toBe(403)
    // The club owner can host under their own club.
    actAs(ownerId)
    const ok = await tournamentsPOST(
      jsonRequest("/api/tournaments", {
        name: "Real Cup",
        tenantId,
        city: "Toronto",
        country: "CA",
        teamFee: 100,
        startDate: new Date(Date.now() + 30 * 864e5).toISOString(),
        endDate: new Date(Date.now() + 31 * 864e5).toISOString(),
      })
    )
    expect(ok.status).toBe(201)
  })
})

describe("game scoring is limited to the two playing teams' staff (owner ruling)", () => {
  let game: { id: string; homeTeamId: string; awayTeamId: string; seasonId: string | null }

  beforeAll(async () => {
    // A game between teamA and teamB. teamC's coach is a same-club coach who
    // is NOT involved — the exact "unrelated team" the old rule wrongly let in.
    const row = await prisma.game.create({
      data: {
        homeTeamId: teamAId,
        awayTeamId: teamBId,
        scheduledAt: new Date(Date.now() + 864e5),
        status: "SCHEDULED",
      },
      select: { id: true, homeTeamId: true, awayTeamId: true, seasonId: true },
    })
    game = row
  })

  it("a coach of a NON-playing team in the same club cannot score", async () => {
    expect(await canScoreGame(coachC, false, game)).toBe(false)
  })

  it("the home and away teams' coaches can score", async () => {
    expect(await canScoreGame(coachA, false, game)).toBe(true)
    expect(await canScoreGame(coachB, false, game)).toBe(true)
  })

  it("a club admin and a league-assigned scorekeeper can score", async () => {
    expect(await canScoreGame(ownerId, false, game)).toBe(true)
    // League assigns a scorekeeper for THIS game (gameId-scoped role).
    const keeper = await createParentWithChildren(world.ctx, { children: [] })
    await prisma.userRole.create({
      data: { userId: keeper.parent.id, role: "Scorekeeper", gameId: game.id },
    })
    expect(await canScoreGame(keeper.parent.id, false, game)).toBe(true)
    // ...but that scorekeeper cannot score a DIFFERENT game.
    const other = await prisma.game.create({
      data: {
        homeTeamId: teamCId,
        awayTeamId: teamAId,
        scheduledAt: new Date(Date.now() + 2 * 864e5),
        status: "SCHEDULED",
      },
      select: { id: true, homeTeamId: true, awayTeamId: true, seasonId: true },
    })
    expect(await canScoreGame(keeper.parent.id, false, other)).toBe(false)
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
