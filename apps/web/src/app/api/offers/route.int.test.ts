import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  destroyWorld,
  createOffer,
  createParentWithChildren,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST } from "./route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — G2 / E13: cross-club offers are a recruiting FEATURE (owner decision
 * 2026-07-03). Direct offers (no tryout signup) work to any player; offering
 * to a player rostered at another club succeeds AND writes an AuditLog row.
 */

let world: BuiltWorld
let clubA: { tenantId: string; ownerId: string; teamId: string }
let clubB: { tenantId: string; teamId: string }
let rosteredParentId: string
let rosteredPlayerId: string // ACTIVE on club B's roster
let freePlayerId: string // no roster anywhere

const sendOffer = (body: unknown) => POST(jsonRequest("/api/offers", body) as any)

const offerBody = (playerId: string) => ({
  teamId: clubA.teamId,
  playerId,
  seasonFee: 200,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
})

beforeAll(async () => {
  world = await buildWorld({ seed: 1109, clubs: [{ teams: [{}] }, { teams: [{}] }] })
  clubA = {
    tenantId: world.clubs[0].tenantId,
    ownerId: world.clubs[0].owner.id,
    teamId: world.clubs[0].teams[0].id,
  }
  clubB = { tenantId: world.clubs[1].tenantId, teamId: world.clubs[1].teams[0].id }

  const famA = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  rosteredParentId = famA.parent.id
  rosteredPlayerId = famA.players[0].id
  // ACCEPTED offer rosters the child ACTIVE on club B
  await createOffer(world.ctx, { teamId: clubB.teamId, playerId: rosteredPlayerId, status: "ACCEPTED" })

  const famB = await createParentWithChildren(world.ctx, { children: [{ age: 11 }] })
  freePlayerId = famB.players[0].id
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("POST /api/offers — cross-club recruiting (integration)", () => {
  it("G2/E13 — offer to a player rostered at another club succeeds and is audited", async () => {
    actAs(clubA.ownerId)
    const res = await sendOffer(offerBody(rosteredPlayerId))
    expect(res.status).toBe(201)
    const { id: offerId } = await res.json()

    const offer = await prisma.offer.findUnique({ where: { id: offerId } })
    expect(offer!.status).toBe("PENDING")
    expect(offer!.tryoutSignupId).toBeNull() // direct offer, no tryout

    // Parent notified like any offer
    const bell = await prisma.notification.findFirst({
      where: { userId: rosteredParentId, type: "offer_received", referenceId: offerId },
    })
    expect(bell).not.toBeNull()

    // ...and the recruiting trail exists
    const trail = await prisma.auditLog.findFirst({
      where: { action: "OFFER_CROSS_CLUB_RECRUIT", resourceId: offerId },
    })
    expect(trail).not.toBeNull()
    expect(trail!.userId).toBe(clubA.ownerId)
    expect(trail!.tenantId).toBe(clubA.tenantId)
    const recruitedFrom = (trail!.metadata as any).recruitedFrom
    expect(recruitedFrom.map((r: any) => r.tenantId)).toContain(clubB.tenantId)
  })

  it("offer to an unaffiliated player is NOT audited (nothing to recruit from)", async () => {
    actAs(clubA.ownerId)
    const res = await sendOffer(offerBody(freePlayerId))
    expect(res.status).toBe(201)
    const { id: offerId } = await res.json()

    const trail = await prisma.auditLog.findFirst({
      where: { action: "OFFER_CROSS_CLUB_RECRUIT", resourceId: offerId },
    })
    expect(trail).toBeNull()
  })

  it("offer to a player already on the club's own roster is NOT audited", async () => {
    // Roster the free player on club A itself, then send a fresh offer from A
    await prisma.teamPlayer.upsert({
      where: { teamId_playerId: { teamId: clubA.teamId, playerId: freePlayerId } },
      create: { teamId: clubA.teamId, playerId: freePlayerId, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    })
    // Close the pending offer from the previous test so the dup guard passes
    await prisma.offer.updateMany({
      where: { teamId: clubA.teamId, playerId: freePlayerId, status: "PENDING" },
      data: { status: "DECLINED" },
    })

    actAs(clubA.ownerId)
    const res = await sendOffer(offerBody(freePlayerId))
    expect(res.status).toBe(201)
    const { id: offerId } = await res.json()

    const trail = await prisma.auditLog.findFirst({
      where: { action: "OFFER_CROSS_CLUB_RECRUIT", resourceId: offerId },
    })
    expect(trail).toBeNull()
  })
})
