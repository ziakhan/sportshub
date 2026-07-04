import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  destroyWorld,
  createOffer,
  createParentWithChildren,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { GET, POST } from "./route"
import { DELETE, PATCH } from "./[id]/route"
import { POST as signup } from "@/app/api/auth/signup/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — G3 PlayerInvitation, both lanes (scenarios F2, F6–F9):
 * invite by email → auto-attach (at creation for existing accounts, at
 * signup otherwise) → accept converts the invitation into a real Offer.
 */

const DAY = 24 * 60 * 60 * 1000

let world: BuiltWorld
let ownerId: string
let tenantId: string
let teamId: string
let strangerId: string // existing parent account, F8 addressee
let strangerChildId: string
let templateId: string

let f6Email: string
let f6InvitationId: string
let f6UserId: string
let f6ChildId: string
let f8InvitationId: string

const invite = (body: unknown) => POST(jsonRequest("/api/player-invitations", body) as any)
const respond = (id: string, body: unknown) =>
  PATCH(jsonRequest(`/api/player-invitations/${id}`, body, "PATCH") as any, { params: { id } })
const revoke = (id: string) =>
  DELETE(jsonRequest(`/api/player-invitations/${id}`, undefined, "DELETE") as any, {
    params: { id },
  })
const list = (query: string) =>
  GET(new NextRequest(`http://localhost:3000/api/player-invitations?${query}`))
const signUp = (email: string) =>
  signup(
    jsonRequest("/api/auth/signup", {
      email,
      password: "TestPass123!",
      firstName: "Invited",
      lastName: "Family",
    })
  )

/** Child (or 13+ self player) directly on the parent record. */
async function addPlayer(parentId: string, age: number) {
  return prisma.player.create({
    data: {
      firstName: "Invitee",
      lastName: `P${age}`,
      dateOfBirth: new Date(Date.now() - (age * 365.25 + 30) * DAY),
      gender: "MALE",
      parentId,
      isMinor: age < 13,
      canLogin: age >= 13,
    },
  })
}

beforeAll(async () => {
  world = await buildWorld({ seed: 1108, clubs: [{ teams: [{}] }] })
  const club = world.clubs[0]
  ownerId = club.owner.id
  tenantId = club.tenantId
  teamId = club.teams[0].id

  const family = await createParentWithChildren(world.ctx, { children: [{ age: 12 }] })
  strangerId = family.parent.id
  strangerChildId = family.players[0].id

  templateId = (
    await prisma.offerTemplate.create({
      data: {
        tenantId,
        name: world.ctx.name("Invite Package"),
        seasonFee: 450,
        installments: 3,
        includesUniform: true,
      },
    })
  ).id

  f6Email = `f6-parent@${world.ctx.runId}.world`
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("POST /api/player-invitations", () => {
  it("creates a PENDING invitation to a fresh email with a default 14-day expiry", async () => {
    actAs(ownerId)
    const res = await invite({
      teamId,
      email: f6Email,
      playerName: "Marcus",
      message: "Come play for us",
      seasonFee: 300,
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.attached).toBe(false)
    f6InvitationId = body.id

    const row = await prisma.playerInvitation.findUnique({ where: { id: body.id } })
    expect(row!.status).toBe("PENDING")
    expect(row!.invitedUserId).toBeNull()
    expect(Number(row!.seasonFee)).toBe(300)
    const daysOut = (row!.expiresAt.getTime() - Date.now()) / DAY
    expect(daysOut).toBeGreaterThan(13)
    expect(daysOut).toBeLessThan(15)
  })

  it("rejects anonymous and non-club users", async () => {
    actAs(null)
    expect((await invite({ teamId, email: "x@example.com" })).status).toBe(401)
    actAs(strangerId)
    expect((await invite({ teamId, email: "x@example.com" })).status).toBe(403)
  })

  it("404s on unknown team and unknown template", async () => {
    actAs(ownerId)
    expect((await invite({ teamId: "missing-team", email: "x@example.com" })).status).toBe(404)
    expect(
      (await invite({ teamId, email: "x@example.com", templateId: "missing-template" })).status
    ).toBe(404)
  })

  it("409s on a duplicate PENDING invitation for the same team + email", async () => {
    actAs(ownerId)
    const res = await invite({ teamId, email: f6Email.toUpperCase() })
    expect(res.status).toBe(409)
  })

  it("F8 — attaches immediately and notifies when the email already has an account", async () => {
    const stranger = await prisma.user.findUnique({ where: { id: strangerId } })
    actAs(ownerId)
    const res = await invite({ teamId, email: stranger!.email, playerName: "Jordan" })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.attached).toBe(true)
    f8InvitationId = body.id

    const row = await prisma.playerInvitation.findUnique({ where: { id: body.id } })
    expect(row!.invitedUserId).toBe(strangerId)

    const bell = await prisma.notification.findFirst({
      where: { userId: strangerId, type: "player_invite", referenceId: body.id },
    })
    expect(bell).not.toBeNull()
  })
})

describe("signup auto-attach (F6)", () => {
  it("attaches pending invitations to the new account and surfaces them", async () => {
    const res = await signUp(f6Email)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pendingPlayerInvitations).toBe(1)

    const user = await prisma.user.findFirst({ where: { email: f6Email } })
    f6UserId = user!.id

    const row = await prisma.playerInvitation.findUnique({ where: { id: f6InvitationId } })
    expect(row!.invitedUserId).toBe(f6UserId)

    const bell = await prisma.notification.findFirst({
      where: { userId: f6UserId, type: "player_invite", referenceId: f6InvitationId },
    })
    expect(bell).not.toBeNull()
  })
})

describe("PATCH /api/player-invitations/[id]", () => {
  it("F6 — new parent adds a child and accepts: invitation converts into a real offer", async () => {
    f6ChildId = (await addPlayer(f6UserId, 11)).id
    actAs(f6UserId)
    const res = await respond(f6InvitationId, { action: "accept", playerId: f6ChildId })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("accepted")

    const offer = await prisma.offer.findUnique({ where: { id: body.offerId } })
    expect(offer!.teamId).toBe(teamId)
    expect(offer!.playerId).toBe(f6ChildId)
    expect(offer!.status).toBe("PENDING")
    expect(Number(offer!.seasonFee)).toBe(300)
    expect(offer!.templateId).toBeNull()
    expect(offer!.message).toBe("Come play for us")

    const row = await prisma.playerInvitation.findUnique({ where: { id: f6InvitationId } })
    expect(row!.status).toBe("ACCEPTED")
    expect(row!.offerId).toBe(body.offerId)
    expect(row!.respondedAt).not.toBeNull()

    const inviterBell = await prisma.notification.findFirst({
      where: { userId: ownerId, type: "player_invite_accepted", referenceId: f6InvitationId },
    })
    expect(inviterBell).not.toBeNull()
    const offerBell = await prisma.notification.findFirst({
      where: { userId: f6UserId, type: "offer_received", referenceId: body.offerId },
    })
    expect(offerBell).not.toBeNull()
  })

  it("F7 — 13+ invitee signs up and accepts with their own player record; template terms apply", async () => {
    const f7Email = `f7-teen@${world.ctx.runId}.world`
    actAs(ownerId)
    const created = await (await invite({ teamId, email: f7Email, templateId })).json()

    await signUp(f7Email)
    const teen = await prisma.user.findFirst({ where: { email: f7Email } })
    const self = await addPlayer(teen!.id, 15) // self-registered: parentId = own user id

    actAs(teen!.id)
    const res = await respond(created.id, { action: "accept", playerId: self.id })
    expect(res.status).toBe(200)
    const { offerId } = await res.json()

    const offer = await prisma.offer.findUnique({ where: { id: offerId } })
    expect(Number(offer!.seasonFee)).toBe(450)
    expect(offer!.installments).toBe(3)
    expect(offer!.includesUniform).toBe(true)
    expect(offer!.templateId).toBe(templateId)
  })

  it("requires playerId to accept and leaves the invitation open", async () => {
    actAs(strangerId)
    const res = await respond(f8InvitationId, { action: "accept" })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe("PLAYER_REQUIRED")
    const row = await prisma.playerInvitation.findUnique({ where: { id: f8InvitationId } })
    expect(row!.status).toBe("PENDING")
  })

  it("403s for a user the invitation is not addressed to", async () => {
    actAs(f6UserId)
    expect((await respond(f8InvitationId, { action: "decline" })).status).toBe(403)
  })

  it("404s when accepting with someone else's child", async () => {
    actAs(strangerId)
    const res = await respond(f8InvitationId, { action: "accept", playerId: f6ChildId })
    expect(res.status).toBe(404)
  })

  it("409s when the player already has a pending offer on the team", async () => {
    await createOffer(world.ctx, { teamId, playerId: strangerChildId, status: "PENDING" })
    actAs(strangerId)
    const res = await respond(f8InvitationId, { action: "accept", playerId: strangerChildId })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe("DUPLICATE_PENDING_OFFER")
    const row = await prisma.playerInvitation.findUnique({ where: { id: f8InvitationId } })
    expect(row!.status).toBe("PENDING")
  })

  it("F9 — decline closes the invitation and notifies the inviter", async () => {
    actAs(strangerId)
    const res = await respond(f8InvitationId, { action: "decline" })
    expect(res.status).toBe(200)

    const row = await prisma.playerInvitation.findUnique({ where: { id: f8InvitationId } })
    expect(row!.status).toBe("DECLINED")

    const bell = await prisma.notification.findFirst({
      where: { userId: ownerId, type: "player_invite_declined", referenceId: f8InvitationId },
    })
    expect(bell).not.toBeNull()
  })

  it("F9 — responding to an expired invitation returns 410 and flips it to EXPIRED", async () => {
    const stranger = await prisma.user.findUnique({ where: { id: strangerId } })
    actAs(ownerId)
    const created = await (await invite({ teamId, email: stranger!.email })).json()
    await prisma.playerInvitation.update({
      where: { id: created.id },
      data: { expiresAt: new Date(Date.now() - DAY) },
    })

    actAs(strangerId)
    const res = await respond(created.id, { action: "accept", playerId: strangerChildId })
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.code).toBe("INVITATION_EXPIRED")

    const row = await prisma.playerInvitation.findUnique({ where: { id: created.id } })
    expect(row!.status).toBe("EXPIRED")

    // A closed invitation can't be responded to again
    expect((await respond(created.id, { action: "decline" })).status).toBe(400)
  })
})

describe("DELETE /api/player-invitations/[id] (revoke)", () => {
  it("club revokes a pending invitation; addressee is notified; revoke is single-shot", async () => {
    const stranger = await prisma.user.findUnique({ where: { id: strangerId } })
    actAs(ownerId)
    const created = await (await invite({ teamId, email: stranger!.email })).json()

    actAs(strangerId)
    expect((await revoke(created.id)).status).toBe(403)

    actAs(ownerId)
    expect((await revoke(created.id)).status).toBe(200)
    const row = await prisma.playerInvitation.findUnique({ where: { id: created.id } })
    expect(row!.status).toBe("CANCELLED")

    const bell = await prisma.notification.findFirst({
      where: { userId: strangerId, type: "player_invite_cancelled", referenceId: created.id },
    })
    expect(bell).not.toBeNull()

    expect((await revoke(created.id)).status).toBe(400)

    // A cancelled invitation is closed to the addressee too
    actAs(strangerId)
    expect((await respond(created.id, { action: "decline" })).status).toBe(400)
  })
})

describe("GET /api/player-invitations", () => {
  it("mine=true lists my invitations and lazily expires overdue ones", async () => {
    const stranger = await prisma.user.findUnique({ where: { id: strangerId } })
    actAs(ownerId)
    const created = await (await invite({ teamId, email: stranger!.email })).json()
    await prisma.playerInvitation.update({
      where: { id: created.id },
      data: { expiresAt: new Date(Date.now() - DAY) },
    })

    actAs(strangerId)
    const res = await list("mine=true")
    expect(res.status).toBe(200)
    const { invitations } = await res.json()
    expect(invitations.length).toBeGreaterThanOrEqual(3)
    const lazy = invitations.find((i: any) => i.id === created.id)
    expect(lazy.status).toBe("EXPIRED")
    for (const inv of invitations) {
      expect(inv.seasonFee === null || typeof inv.seasonFee === "number").toBe(true)
      expect(inv.team.name).toBeTruthy()
    }
  })

  it("tenantId lists the club's invitations for club roles only", async () => {
    actAs(strangerId)
    expect((await list(`tenantId=${tenantId}`)).status).toBe(403)

    actAs(ownerId)
    const res = await list(`tenantId=${tenantId}`)
    expect(res.status).toBe(200)
    const { invitations } = await res.json()
    // Everything this suite created lives under this tenant
    expect(invitations.length).toBeGreaterThanOrEqual(6)
    expect(invitations.every((i: any) => i.tenantId === tenantId)).toBe(true)
  })

  it("400s without a scope parameter", async () => {
    actAs(ownerId)
    expect((await list("")).status).toBe(400)
  })
})
