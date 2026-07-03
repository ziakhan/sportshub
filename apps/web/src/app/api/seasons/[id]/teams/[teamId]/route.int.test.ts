import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  destroyWorld,
  createClub,
  submitTeamToSeason,
  daysFromNow,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { PATCH } from "./route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — G4 withdraw cascade (H19/J2): withdrawing a team mid-season cancels
 * its FUTURE games (played ones stay for standings) and notifies the
 * opposing club; after finalize, approve/reject are locked while withdraw
 * stays open.
 */

let world: BuiltWorld
let leagueOwnerId: string
let opponentOwnerId: string
let lockedSeasonId: string
let openSeasonId: string
let withdrawSubmissionId: string
let lockedOtherSubmissionId: string
let openSubmissionId: string
let pastGameId: string
let futureGameIds: string[]

const patchSubmission = (seasonId: string, submissionId: string, body: unknown) =>
  PATCH(jsonRequest(`/api/seasons/${seasonId}/teams/${submissionId}`, body, "PATCH"), {
    params: { id: seasonId, teamId: submissionId },
  })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1107,
    leagues: [
      {
        seasons: [
          { status: "IN_PROGRESS", divisions: [{ teams: 1, rosterSize: 0 }], sessions: [] },
          { status: "REGISTRATION", divisions: [{ teams: 1, rosterSize: 0 }], sessions: [] },
        ],
      },
    ],
  })
  const [locked, open] = world.leagues[0].seasons
  lockedSeasonId = locked.id
  openSeasonId = open.id
  leagueOwnerId = world.leagues[0].owner.id
  opponentOwnerId = locked.feederClub!.owner.id
  const opponentTeamId = locked.divisions[0].submissions[0].teamId
  lockedOtherSubmissionId = locked.divisions[0].submissions[0].submissionId
  openSubmissionId = open.divisions[0].submissions[0].submissionId

  // The withdrawing team belongs to a separate club
  const clubB = await createClub(world.ctx, {})
  const submissionB = await submitTeamToSeason(world.ctx, {
    seasonId: locked.id,
    divisionId: locked.divisions[0].id,
    tenantId: clubB.tenantId,
    ageGroup: "U12",
    seasonLabel: locked.label,
    rosterSize: 0,
    status: "APPROVED",
  })
  withdrawSubmissionId = submissionB.submissionId

  const mkGame = async (daysAhead: number, status: string, scores?: [number, number]) =>
    (
      await prisma.game.create({
        data: {
          seasonId: locked.id,
          homeTeamId: submissionB.teamId,
          awayTeamId: opponentTeamId,
          scheduledAt: daysFromNow(daysAhead),
          duration: 60,
          status: status as any,
          homeScore: scores?.[0] ?? null,
          awayScore: scores?.[1] ?? null,
        },
      })
    ).id
  pastGameId = await mkGame(-5, "COMPLETED", [55, 48])
  futureGameIds = [await mkGame(2, "SCHEDULED"), await mkGame(4, "SCHEDULED")]
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("PATCH /api/seasons/[id]/teams/[teamId] (integration)", () => {
  it("H19 — blocks approve/reject once the season is locked", async () => {
    actAs(leagueOwnerId)
    const res = await patchSubmission(lockedSeasonId, lockedOtherSubmissionId, {
      status: "REJECTED",
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe("SEASON_LOCKED")
  })

  it("still allows approve/reject while registration is open", async () => {
    actAs(leagueOwnerId)
    const res = await patchSubmission(openSeasonId, openSubmissionId, { status: "REJECTED" })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("REJECTED")
    expect(body.cancelledGames).toBe(0)
  })

  it("G4/J2 — withdrawing cancels future games, keeps played ones, and notifies the opponent club", async () => {
    actAs(leagueOwnerId)
    const res = await patchSubmission(lockedSeasonId, withdrawSubmissionId, {
      status: "WITHDRAWN",
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("WITHDRAWN")
    expect(body.cancelledGames).toBe(2)

    for (const id of futureGameIds) {
      const g = await prisma.game.findUnique({ where: { id } })
      expect(g!.status).toBe("CANCELLED")
    }
    const past = await prisma.game.findUnique({ where: { id: pastGameId } })
    expect(past!.status).toBe("COMPLETED")

    const notified = await prisma.notification.findMany({
      where: { type: "game_cancelled", referenceId: withdrawSubmissionId },
      select: { userId: true },
    })
    expect(notified.map((n) => n.userId)).toEqual([opponentOwnerId])
  })

  it("withdrawing again does not re-cancel or re-notify", async () => {
    actAs(leagueOwnerId)
    const res = await patchSubmission(lockedSeasonId, withdrawSubmissionId, {
      status: "WITHDRAWN",
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cancelledGames).toBe(0)
    const notified = await prisma.notification.count({
      where: { type: "game_cancelled", referenceId: withdrawSubmissionId },
    })
    expect(notified).toBe(1)
  })
})
