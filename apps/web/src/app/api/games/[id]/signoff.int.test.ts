import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import bcrypt from "bcryptjs"
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
import { GET as scoringGet } from "./scoring/route"
import { POST as finalizePost } from "./finalize/route"
import { GET as pinGet, POST as pinPost } from "@/app/api/referee/signoff-pin/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — referee sign-off (docs/live-scoring-design.md, owner spec): PIN
 * verified against the ASSIGNED referee's account (strong approval), drawn
 * signature stored and rendered, escape hatch stays. Seed registry: 1116.
 */

const SIG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

let world: BuiltWorld
let seasonId: string
let leagueOwnerId: string
let clubOwnerId: string
let refUserId: string
let gameId: string

beforeAll(async () => {
  world = await buildWorld({
    seed: 1116,
    leagues: [
      {
        seasons: [
          { status: "FINALIZED", divisions: [{ teams: 1, rosterSize: 5 }], sessions: [] },
        ],
      },
    ],
  })
  const season = world.leagues[0].seasons[0]
  seasonId = season.id
  leagueOwnerId = world.leagues[0].owner.id
  clubOwnerId = season.feederClub!.owner.id
  const subA = season.divisions[0].submissions[0]

  const clubB = await createClub(world.ctx, {})
  const subB = await submitTeamToSeason(world.ctx, {
    seasonId: season.id,
    divisionId: season.divisions[0].id,
    tenantId: clubB.tenantId,
    ageGroup: "U12",
    seasonLabel: season.label,
    rosterSize: 5,
    status: "APPROVED",
  })

  gameId = (
    await prisma.game.create({
      data: {
        seasonId: season.id,
        homeTeamId: subA.teamId,
        awayTeamId: subB.teamId,
        scheduledAt: daysFromNow(0),
        duration: 60,
        status: "LIVE",
      },
    })
  ).id

  // A couple of real events so finalize has something to fold
  await (prisma as any).gameEvent.createMany({
    data: [
      {
        gameId,
        eventType: "LINEUP",
        teamId: subA.teamId,
        sequence: 1,
        clientEventId: "so-1",
        metadata: { playerIds: subA.playerIds.slice(0, 5) },
      },
      {
        gameId,
        eventType: "LINEUP",
        teamId: subB.teamId,
        sequence: 2,
        clientEventId: "so-2",
        metadata: { playerIds: subB.playerIds.slice(0, 5) },
      },
      { gameId, eventType: "PERIOD_START", period: 1, sequence: 3, clientEventId: "so-3" },
      {
        gameId,
        eventType: "SCORE_2PT",
        teamId: subA.teamId,
        playerId: subA.playerIds[0],
        made: true,
        points: 2,
        period: 1,
        sequence: 4,
        clientEventId: "so-4",
      },
    ],
  })

  // League demands referee approval
  await (prisma as any).league.updateMany({
    where: { seasons: { some: { id: seasonId } } },
    data: { requireRefereeApproval: true },
  })

  // The assigned referee, with an account PIN
  const refUser = await prisma.user.create({
    data: {
      email: `signoff-ref@${world.ctx.runId}.world`,
      firstName: "Sam",
      lastName: "Stripes",
      passwordHash: await bcrypt.hash("TestPass123!", 4),
      onboardedAt: new Date(),
    } as any,
  })
  refUserId = refUser.id
  await (prisma as any).refereeProfile.create({
    data: { userId: refUserId, standardFee: 40, signoffPinHash: await bcrypt.hash("4321", 4) },
  })
  await prisma.userRole.create({
    data: { userId: refUserId, role: "Referee" as any, gameId },
  })
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: refUserId } }).catch(() => {})
  if (world) await destroyWorld(world.ctx)
})

const finalize = (body: unknown) =>
  finalizePost(jsonRequest(`/api/games/${gameId}/finalize`, body, "POST"), {
    params: { id: gameId },
  })

describe("assigned-referee PIN approval", () => {
  it("bootstrap lists the assigned referee with PIN availability", async () => {
    actAs(clubOwnerId)
    const res = await scoringGet(
      jsonRequest(`/api/games/${gameId}/scoring`, undefined, "GET"),
      { params: { id: gameId } }
    )
    const body = await res.json()
    expect(body.referees).toEqual([
      { userId: refUserId, name: "Sam Stripes", hasPin: true },
    ])
  })

  it("a wrong PIN is refused; the right PIN finalizes as PIN-verified", async () => {
    actAs(clubOwnerId)
    const bad = await finalize({ refereeUserId: refUserId, refereePin: "9999" })
    expect(bad.status).toBe(400)
    expect((await bad.json()).code).toBe("BAD_REFEREE_PIN")

    const ok = await finalize({ refereeUserId: refUserId, refereePin: "4321" })
    expect(ok.status).toBe(200)

    const game = await (prisma as any).game.findUnique({ where: { id: gameId } })
    expect(game.status).toBe("COMPLETED")
    expect(game.refereeVerified).toBe(true)
    expect(game.refereeName).toBe("Sam Stripes")
  })

  it("a drawn signature is stored on (league-owner) re-finalize and downgrades verification", async () => {
    actAs(leagueOwnerId)
    const res = await finalize({ refereeSignature: SIG, refereeName: "Sam Stripes" })
    expect(res.status).toBe(200)
    const game = await (prisma as any).game.findUnique({ where: { id: gameId } })
    expect(game.refereeSignature).toBe(SIG)
    expect(game.refereeVerified).toBe(false) // drawn ≠ account-verified
  })
})

describe("referee PIN self-service", () => {
  it("referees set and change their PIN; changing needs the current one", async () => {
    actAs(refUserId)
    expect((await (await pinGet()).json()).hasPin).toBe(true)

    const wrong = await pinPost(
      jsonRequest("/api/referee/signoff-pin", { pin: "5555", currentPin: "nope" }) as any
    )
    expect(wrong.status).toBe(400)

    const ok = await pinPost(
      jsonRequest("/api/referee/signoff-pin", { pin: "5555", currentPin: "4321" }) as any
    )
    expect(ok.status).toBe(200)
  })

  it("non-referees cannot set a PIN", async () => {
    actAs(clubOwnerId)
    const res = await pinPost(jsonRequest("/api/referee/signoff-pin", { pin: "1234" }) as any)
    expect(res.status).toBe(403)
  })
})
