import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  destroyWorld,
  createOffer,
  createParentWithChildren,
  createTryout,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { DELETE } from "./route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — G10 delete-child guard (B8/B9/D14): blocked while on an ACTIVE
 * roster; otherwise soft-deletes and sweeps dangling commitments (PENDING
 * offers auto-declined, future tryout signups cancelled, past ones kept).
 */

let world: BuiltWorld
let teamId: string
let rosteredParentId: string
let rosteredPlayerId: string
let freeParentId: string
let freePlayerId: string
let pendingOfferId: string
let futureSignupId: string
let pastSignupId: string

const deletePlayer = (id: string) =>
  DELETE(jsonRequest(`/api/players/${id}`, undefined, "DELETE"), { params: { id } })

beforeAll(async () => {
  world = await buildWorld({ seed: 1106, clubs: [{ teams: [{}] }] })
  const { ctx } = world
  const club = world.clubs[0]
  teamId = club.teams[0].id

  // Family A — child on an ACTIVE roster (accepted offer)
  const famA = await createParentWithChildren(ctx, { children: [{ age: 12 }] })
  rosteredParentId = famA.parent.id
  rosteredPlayerId = famA.players[0].id
  await createOffer(ctx, { teamId, playerId: rosteredPlayerId, status: "ACCEPTED" })

  // Family B — child with a PENDING offer + future and past tryout signups
  const famB = await createParentWithChildren(ctx, { children: [{ age: 11 }] })
  freeParentId = famB.parent.id
  freePlayerId = famB.players[0].id
  pendingOfferId = (await createOffer(ctx, { teamId, playerId: freePlayerId, status: "PENDING" })).id

  const futureTryout = await createTryout(ctx, { tenantId: club.tenantId, daysAhead: 10 })
  const pastTryout = await createTryout(ctx, { tenantId: club.tenantId, daysAhead: -3 })
  const mkSignup = async (tryoutId: string) =>
    (
      await prisma.tryoutSignup.create({
        data: {
          tryoutId,
          userId: freeParentId,
          playerId: freePlayerId,
          playerName: "Test Child",
          playerAge: 11,
          playerGender: "MALE",
          status: "CONFIRMED",
        },
      })
    ).id
  futureSignupId = await mkSignup(futureTryout.id)
  pastSignupId = await mkSignup(pastTryout.id)
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("DELETE /api/players/[id] (integration)", () => {
  it("B8 — blocks deleting a child who occupies an ACTIVE roster spot", async () => {
    actAs(rosteredParentId)
    const res = await deletePlayer(rosteredPlayerId)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe("ACTIVE_ROSTER")

    const player = await prisma.player.findUnique({ where: { id: rosteredPlayerId } })
    expect(player!.deletedAt).toBeNull()
  })

  it("rejects a parent deleting someone else's child", async () => {
    actAs(rosteredParentId)
    const res = await deletePlayer(freePlayerId)
    expect(res.status).toBe(404)
  })

  it("B9/D14 — soft-deletes and sweeps: pending offer declined, future signup cancelled, past signup kept", async () => {
    actAs(freeParentId)
    const res = await deletePlayer(freePlayerId)
    expect(res.status).toBe(200)

    const player = await prisma.player.findUnique({ where: { id: freePlayerId } })
    expect(player!.deletedAt).not.toBeNull()

    const offer = await prisma.offer.findUnique({ where: { id: pendingOfferId } })
    expect(offer!.status).toBe("DECLINED")
    expect(offer!.respondedAt).not.toBeNull()

    const future = await prisma.tryoutSignup.findUnique({ where: { id: futureSignupId } })
    expect(future!.status).toBe("CANCELLED")
    const past = await prisma.tryoutSignup.findUnique({ where: { id: pastSignupId } })
    expect(past!.status).toBe("CONFIRMED")
  })

  it("rejects deleting an already-removed child", async () => {
    actAs(freeParentId)
    const res = await deletePlayer(freePlayerId)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Player already removed" })
  })
})
