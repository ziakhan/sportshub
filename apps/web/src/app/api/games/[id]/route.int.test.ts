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
import { DELETE, PATCH } from "./route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — G8: cancelling or rescheduling a game notifies the club managers of
 * BOTH teams (previously silent). Silent edits (lock flag) notify nobody.
 */

let world: BuiltWorld
let leagueOwnerId: string
let clubAOwnerId: string
let clubBOwnerId: string
let game1Id: string
let game2Id: string

const patchGame = (id: string, body: unknown) =>
  PATCH(jsonRequest(`/api/games/${id}`, body, "PATCH"), { params: { id } })

const notificationsOf = (type: string, referenceId: string) =>
  prisma.notification.findMany({
    where: { type, referenceId },
    select: { userId: true },
  })

beforeAll(async () => {
  world = await buildWorld({
    seed: 1105,
    leagues: [
      {
        seasons: [
          { status: "FINALIZED", divisions: [{ teams: 1, rosterSize: 0 }], sessions: [] },
        ],
      },
    ],
  })
  const season = world.leagues[0].seasons[0]
  leagueOwnerId = world.leagues[0].owner.id
  clubAOwnerId = season.feederClub!.owner.id
  const teamA = season.divisions[0].submissions[0].teamId

  // Opponent from a DIFFERENT club — "both clubs" must mean both.
  const clubB = await createClub(world.ctx, {})
  clubBOwnerId = clubB.owner.id
  const submissionB = await submitTeamToSeason(world.ctx, {
    seasonId: season.id,
    divisionId: season.divisions[0].id,
    tenantId: clubB.tenantId,
    ageGroup: "U12",
    seasonLabel: season.label,
    rosterSize: 0,
    status: "APPROVED",
  })

  const mkGame = async (daysAhead: number) =>
    (
      await prisma.game.create({
        data: {
          seasonId: season.id,
          homeTeamId: teamA,
          awayTeamId: submissionB.teamId,
          scheduledAt: daysFromNow(daysAhead),
          duration: 60,
          status: "SCHEDULED",
        },
      })
    ).id
  game1Id = await mkGame(3)
  game2Id = await mkGame(5)
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("PATCH/DELETE /api/games/[id] (integration)", () => {
  it("a silent edit (lock flag) notifies nobody", async () => {
    actAs(leagueOwnerId)
    const res = await patchGame(game1Id, { isLocked: true })
    expect(res.status).toBe(200)
    expect(await notificationsOf("game_rescheduled", game1Id)).toEqual([])
    expect(await notificationsOf("game_cancelled", game1Id)).toEqual([])
  })

  it("G8 — rescheduling notifies both clubs' owners", async () => {
    actAs(leagueOwnerId)
    const res = await patchGame(game1Id, { scheduledAt: daysFromNow(3, 15).toISOString() })
    expect(res.status).toBe(200)
    const notified = (await notificationsOf("game_rescheduled", game1Id)).map((n) => n.userId)
    expect(notified.sort()).toEqual([clubAOwnerId, clubBOwnerId].sort())
  })

  it("G8 — cancelling via PATCH notifies both clubs' owners", async () => {
    actAs(leagueOwnerId)
    const res = await patchGame(game1Id, { status: "CANCELLED" })
    expect(res.status).toBe(200)
    const notified = (await notificationsOf("game_cancelled", game1Id)).map((n) => n.userId)
    expect(notified.sort()).toEqual([clubAOwnerId, clubBOwnerId].sort())
  })

  it("G8 — cancelling via DELETE notifies both clubs, and repeating it does not re-notify", async () => {
    actAs(leagueOwnerId)
    const res = await DELETE(jsonRequest(`/api/games/${game2Id}`, undefined, "DELETE"), {
      params: { id: game2Id },
    })
    expect(res.status).toBe(200)
    expect(await notificationsOf("game_cancelled", game2Id)).toHaveLength(2)

    const again = await DELETE(jsonRequest(`/api/games/${game2Id}`, undefined, "DELETE"), {
      params: { id: game2Id },
    })
    expect(again.status).toBe(200)
    expect(await notificationsOf("game_cancelled", game2Id)).toHaveLength(2)
  })

  it("rejects a non-league-owner", async () => {
    actAs(clubAOwnerId)
    const res = await patchGame(game1Id, { isLocked: false })
    expect(res.status).toBe(403)
  })
})
