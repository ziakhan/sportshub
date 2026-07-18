import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { createWithdrawalRequest, decideWithdrawalRequest } from "./requests"

/**
 * Withdrawal-approval flow (owner 2026-07-18): self-withdrawal always needs
 * the other party's sign-off — clubs asking out of a season (league decides),
 * parents asking a child's release (club decides).
 */

let world: BuiltWorld
let seasonId: string
let submissionId: string
let teamId: string
let playerId: string
let parentId: string
let clubOwnerId: string
let leagueOwnerId: string

beforeAll(async () => {
  world = await buildWorld({
    seed: 1132,
    leagues: [
      {
        seasons: [
          {
            status: "IN_PROGRESS",
            divisions: [{ teams: 2, rosterSize: 2, submissionStatus: "APPROVED" }],
          },
        ],
      },
    ],
  })
  const season = world.leagues[0].seasons[0]
  seasonId = season.id
  const sub = season.divisions[0].submissions[0]
  submissionId = sub.submissionId
  teamId = sub.teamId
  playerId = sub.playerIds[0]

  const [team, player, league] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { tenantId: true } }),
    prisma.player.findUnique({ where: { id: playerId }, select: { parentId: true } }),
    prisma.league.findUnique({
      where: { id: world.leagues[0].id },
      select: { ownerId: true },
    }),
  ])
  parentId = player!.parentId!
  leagueOwnerId = league!.ownerId
  const clubOwnerRole = await prisma.userRole.findFirst({
    where: { tenantId: team!.tenantId, role: "ClubOwner" },
    select: { userId: true },
  })
  clubOwnerId = clubOwnerRole!.userId
})

afterAll(async () => {
  await (prisma as any).withdrawalRequest.deleteMany({
    where: { OR: [{ submissionId }, { teamPlayer: { teamId } }] },
  })
  await destroyWorld(world.ctx)
})

describe("club-from-league withdrawal", () => {
  let requestId: string

  it("club operator opens a request; random users and duplicates are rejected", async () => {
    const stranger = await createWithdrawalRequest({
      userId: parentId, // a parent is not a club operator
      type: "CLUB_FROM_LEAGUE",
      submissionId,
      reason: "not my club",
    })
    expect(stranger.ok).toBe(false)
    if (!stranger.ok) expect(stranger.status).toBe(403)

    const created = await createWithdrawalRequest({
      userId: clubOwnerId,
      type: "CLUB_FROM_LEAGUE",
      submissionId,
      reason: "Not enough players for the spring session",
    })
    expect(created.ok).toBe(true)
    if (created.ok) requestId = created.requestId

    const dup = await createWithdrawalRequest({
      userId: clubOwnerId,
      type: "CLUB_FROM_LEAGUE",
      submissionId,
      reason: "again",
    })
    expect(dup.ok).toBe(false)
    if (!dup.ok) expect(dup.code).toBe("DUPLICATE")
  })

  it("the requester cannot approve their own request", async () => {
    const res = await decideWithdrawalRequest({
      requestId,
      userId: clubOwnerId,
      isPlatformAdmin: false,
      action: "approve",
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(403)
  })

  it("league owner approval flips the submission to WITHDRAWN and cancels future games", async () => {
    // seed one future game so the cascade has something to cancel
    const otherSub = world.leagues[0].seasons[0].divisions[0].submissions[1]
    const game = await (prisma as any).game.create({
      data: {
        seasonId,
        homeTeamId: teamId,
        awayTeamId: otherSub.teamId,
        scheduledAt: new Date(Date.now() + 7 * 24 * 3600_000),
      },
    })

    const res = await decideWithdrawalRequest({
      requestId,
      userId: leagueOwnerId,
      isPlatformAdmin: false,
      action: "approve",
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.cancelledGames).toBe(1)

    const [sub, g] = await Promise.all([
      (prisma as any).teamSubmission.findUnique({
        where: { id: submissionId },
        select: { status: true },
      }),
      (prisma as any).game.findUnique({ where: { id: game.id }, select: { status: true } }),
    ])
    expect(sub.status).toBe("WITHDRAWN")
    expect(g.status).toBe("CANCELLED")

    const again = await decideWithdrawalRequest({
      requestId,
      userId: leagueOwnerId,
      isPlatformAdmin: false,
      action: "approve",
    })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.code).toBe("ALREADY_DECIDED")
  })
})

describe("player-from-team release", () => {
  let requestId: string

  it("only the parent can ask; decline leaves the roster untouched", async () => {
    const stranger = await createWithdrawalRequest({
      userId: leagueOwnerId,
      type: "PLAYER_FROM_TEAM",
      playerId,
      teamId,
      reason: "nope",
    })
    expect(stranger.ok).toBe(false)

    const created = await createWithdrawalRequest({
      userId: parentId,
      type: "PLAYER_FROM_TEAM",
      playerId,
      teamId,
      reason: "We are moving cities in March",
    })
    expect(created.ok).toBe(true)
    if (created.ok) requestId = created.requestId

    const declined = await decideWithdrawalRequest({
      requestId,
      userId: clubOwnerId,
      isPlatformAdmin: false,
      action: "decline",
      note: "Let's talk first",
    })
    expect(declined.ok).toBe(true)

    const tp = await (prisma as any).teamPlayer.findUnique({
      where: { teamId_playerId: { teamId, playerId } },
      select: { status: true },
    })
    expect(tp.status).toBe("ACTIVE")
  })

  it("a fresh request approved by the club releases the player (INACTIVE + leftAt)", async () => {
    const created = await createWithdrawalRequest({
      userId: parentId,
      type: "PLAYER_FROM_TEAM",
      playerId,
      teamId,
      reason: "Confirmed — we are moving",
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const approved = await decideWithdrawalRequest({
      requestId: created.requestId,
      userId: clubOwnerId,
      isPlatformAdmin: false,
      action: "approve",
    })
    expect(approved.ok).toBe(true)

    const tp = await (prisma as any).teamPlayer.findUnique({
      where: { teamId_playerId: { teamId, playerId } },
      select: { status: true, leftAt: true },
    })
    expect(tp.status).toBe("INACTIVE")
    expect(tp.leftAt).not.toBeNull()
  })

  it("requester can cancel a pending request", async () => {
    // player is released now, so use the OTHER rostered player
    const otherPlayerId = world.leagues[0].seasons[0].divisions[0].submissions[0].playerIds[1]
    const otherPlayer = await prisma.player.findUnique({
      where: { id: otherPlayerId },
      select: { parentId: true },
    })
    const created = await createWithdrawalRequest({
      userId: otherPlayer!.parentId!,
      type: "PLAYER_FROM_TEAM",
      playerId: otherPlayerId,
      teamId,
      reason: "Thinking about it",
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const cancelled = await decideWithdrawalRequest({
      requestId: created.requestId,
      userId: otherPlayer!.parentId!,
      isPlatformAdmin: false,
      action: "cancel",
    })
    expect(cancelled.ok).toBe(true)
    if (cancelled.ok) expect(cancelled.status).toBe("CANCELLED")
  })
})
