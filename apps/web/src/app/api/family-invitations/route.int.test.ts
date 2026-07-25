import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  destroyWorld,
  createParentWithChildren,
  createUser,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { GET, POST } from "./route"
import { GET as getInvite, PATCH } from "./[token]/route"
import { POST as signup } from "@/app/api/auth/signup/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — family-accounts plan (2026-07-23) parent<->child linking layer:
 *  CHILD_LOGIN — a guardian invites their 13+ kid's email; accepting sets
 *  Player.userId (the kid's own login, same Player row, canLogin=true).
 *  GUARDIAN — a self-registered 13+ player (parentId === userId) invites a
 *  real parent; accepting flips Player.parentId to the new guardian/payer.
 * Covers create-time validation, the accept/decline PATCH, and the signup
 * auto-attach path shared with StaffInvitation/PlayerInvitation (F6 pattern
 * in player-invitations/route.int.test.ts).
 */

const DAY = 24 * 60 * 60 * 1000

let world: BuiltWorld
let parentAId: string
let childUnder13Id: string
let childTeenId: string
let strangerId: string
let selfTeenId: string // signed-in account of a self-registered 13+ player
let selfPlayerId: string // parentId === userId === selfTeenId (self-guardian)

let childTeenInviteToken: string
let childTeenInviteId: string
let childLoginEmail: string

const invite = (body: unknown) => POST(jsonRequest("/api/family-invitations", body) as any)
const respond = (token: string, action: "accept" | "decline") =>
  PATCH(jsonRequest(`/api/family-invitations/${token}`, { action }, "PATCH") as any, {
    params: { token },
  })
const getByToken = (token: string) =>
  getInvite(jsonRequest(`/api/family-invitations/${token}`, undefined, "GET") as any, {
    params: { token },
  })
const signUp = (email: string) =>
  signup(
    jsonRequest("/api/auth/signup", {
      email,
      password: "TestPass123!",
      firstName: "Invited",
      lastName: "Family",
    })
  )

/** POST /api/family-invitations only returns `id` — look up the token. */
async function tokenFor(id: string): Promise<string> {
  const row = await prisma.familyInvitation.findUnique({ where: { id } })
  return row!.token
}

/** A fresh 13+ teen (parentId set, userId null — not self-registered). */
async function freshTeen(localPart: string) {
  const family = await createParentWithChildren(world.ctx, {
    localPart,
    children: [{ age: 14 }],
  })
  return { parentId: family.parent.id, playerId: family.players[0].id }
}

/** A fresh self-registered 13+ player (parentId === userId — self-guardian). */
async function freshSelfRegisteredTeen(localPart: string) {
  const user = await createUser(world.ctx, { localPart })
  const player = await prisma.player.create({
    data: {
      firstName: "Self",
      lastName: "Reg",
      dateOfBirth: new Date(Date.now() - (15 * 365.25 + 30) * DAY),
      gender: "MALE",
      parentId: user.id,
      userId: user.id,
      isMinor: false,
      canLogin: true,
    },
  })
  return { userId: user.id, playerId: player.id }
}

beforeAll(async () => {
  world = await buildWorld({ seed: 1136 })

  const familyA = await createParentWithChildren(world.ctx, {
    localPart: "parentA",
    children: [{ age: 12 }, { age: 14 }],
  })
  parentAId = familyA.parent.id
  childUnder13Id = familyA.players[0].id
  childTeenId = familyA.players[1].id

  const stranger = await createUser(world.ctx, { localPart: "stranger" })
  strangerId = stranger.id

  const selfTeen = await createUser(world.ctx, { localPart: "selfteen" })
  selfTeenId = selfTeen.id
  const selfPlayer = await prisma.player.create({
    data: {
      firstName: "Self",
      lastName: "Registered",
      dateOfBirth: new Date(Date.now() - (15 * 365.25 + 30) * DAY),
      gender: "MALE",
      parentId: selfTeenId, // self-guardian convention (CLAUDE.md: Player 13+)
      userId: selfTeenId,
      isMinor: false,
      canLogin: true,
    },
  })
  selfPlayerId = selfPlayer.id

  childLoginEmail = world.ctx.email("childteen-login")
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

describe("POST /api/family-invitations — CHILD_LOGIN", () => {
  it("guardian invites their 13+ kid's email — creates a PENDING invite with a 14-day expiry", async () => {
    actAs(parentAId)
    const res = await invite({ type: "CHILD_LOGIN", playerId: childTeenId, email: childLoginEmail })
    expect(res.status).toBe(201)
    const body = await res.json()
    childTeenInviteId = body.id

    const row = await prisma.familyInvitation.findUnique({ where: { id: body.id } })
    expect(row!.type).toBe("CHILD_LOGIN")
    expect(row!.status).toBe("PENDING")
    expect(row!.invitedEmail).toBe(childLoginEmail)
    expect(row!.invitedUserId).toBeNull()
    childTeenInviteToken = row!.token
    const daysOut = (row!.expiresAt.getTime() - Date.now()) / DAY
    expect(daysOut).toBeGreaterThan(13)
    expect(daysOut).toBeLessThan(15)
  })

  it("refuses an under-13 player with 400 (COPPA — parent-managed only)", async () => {
    actAs(parentAId)
    const res = await invite({
      type: "CHILD_LOGIN",
      playerId: childUnder13Id,
      email: world.ctx.email("under13-login"),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/under 13/i)

    const row = await prisma.familyInvitation.findFirst({ where: { playerId: childUnder13Id } })
    expect(row).toBeNull()
  })

  it("409s on a duplicate PENDING CHILD_LOGIN invite for the same player", async () => {
    actAs(parentAId)
    const res = await invite({
      type: "CHILD_LOGIN",
      playerId: childTeenId,
      email: world.ctx.email("second-attempt"),
    })
    expect(res.status).toBe(409)
  })

  it("403s a user who is neither the player's guardian nor the player themself", async () => {
    actAs(strangerId)
    const res = await invite({
      type: "CHILD_LOGIN",
      playerId: childTeenId,
      email: world.ctx.email("stranger-attempt"),
    })
    expect(res.status).toBe(403)
  })
})

describe("POST /api/family-invitations — GUARDIAN", () => {
  it("a self-registered 13+ player (parentId === userId) can invite a guardian", async () => {
    actAs(selfTeenId)
    const res = await invite({
      type: "GUARDIAN",
      playerId: selfPlayerId,
      email: world.ctx.email("guardian-create-check"),
    })
    expect(res.status).toBe(201)
    const body = await res.json()

    const row = await prisma.familyInvitation.findUnique({ where: { id: body.id } })
    expect(row!.type).toBe("GUARDIAN")
    expect(row!.status).toBe("PENDING")
  })

  it("409s when the player already has a parent/guardian attached (not self-guardian)", async () => {
    actAs(parentAId) // real guardian of a normal (non-self-registered) teen
    const res = await invite({
      type: "GUARDIAN",
      playerId: childTeenId, // parentId=parentA, userId=null — not self-guardian
      email: world.ctx.email("wontwork"),
    })
    expect(res.status).toBe(409)
  })
})

describe("signup auto-attach", () => {
  it("attaches a pending CHILD_LOGIN invite to the new account at signup", async () => {
    const res = await signUp(childLoginEmail)
    expect(res.status).toBe(200)

    const newUser = await prisma.user.findFirst({ where: { email: childLoginEmail } })
    expect(newUser).not.toBeNull()

    const row = await prisma.familyInvitation.findUnique({ where: { id: childTeenInviteId } })
    expect(row!.invitedUserId).toBe(newUser!.id)

    const bell = await prisma.notification.findFirst({
      where: { userId: newUser!.id, type: "family_invite", referenceId: childTeenInviteId },
    })
    expect(bell).not.toBeNull()
  })
})

describe("PATCH /api/family-invitations/[token] — accept/decline", () => {
  it("CHILD_LOGIN accept sets Player.userId + grants the Player role; a second accept 409s", async () => {
    const newUser = await prisma.user.findFirst({ where: { email: childLoginEmail } })
    actAs(newUser!.id)
    const res = await respond(childTeenInviteToken, "accept")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("ACCEPTED")
    expect(body.playerId).toBe(childTeenId)

    const player = await prisma.player.findUnique({ where: { id: childTeenId } })
    expect(player!.userId).toBe(newUser!.id)
    expect(player!.canLogin).toBe(true)
    // Guardianship/payer stays with the parent who added the kid
    expect(player!.parentId).toBe(parentAId)

    const role = await prisma.userRole.findFirst({
      where: { userId: newUser!.id, role: "Player" as any, tenantId: null, teamId: null },
    })
    expect(role).not.toBeNull()

    const row = await prisma.familyInvitation.findUnique({ where: { id: childTeenInviteId } })
    expect(row!.status).toBe("ACCEPTED")
    expect(row!.respondedAt).not.toBeNull()

    // Double-accept: the invitation is no longer PENDING
    const again = await respond(childTeenInviteToken, "accept")
    expect(again.status).toBe(409)
  })

  it("GUARDIAN accept flips Player.parentId + grants the Parent role", async () => {
    const self = await freshSelfRegisteredTeen("selfteenAccept")
    const guardianEmail = world.ctx.email("guardian-accept")
    actAs(self.userId)
    const created = await (
      await invite({ type: "GUARDIAN", playerId: self.playerId, email: guardianEmail })
    ).json()

    await signUp(guardianEmail) // auto-attaches invitedUserId
    const guardianUser = await prisma.user.findFirst({ where: { email: guardianEmail } })

    actAs(guardianUser!.id)
    const res = await respond(await tokenFor(created.id), "accept")
    expect(res.status).toBe(200)

    const player = await prisma.player.findUnique({ where: { id: self.playerId } })
    expect(player!.parentId).toBe(guardianUser!.id)
    // The player keeps their own login
    expect(player!.userId).toBe(self.userId)

    const role = await prisma.userRole.findFirst({
      where: { userId: guardianUser!.id, role: "Parent", tenantId: null, teamId: null },
    })
    expect(role).not.toBeNull()
  })

  it("403s when a different account (not the invitee) tries to accept", async () => {
    const teen = await freshTeen("parentWrongEmail")
    actAs(teen.parentId)
    const created = await (
      await invite({ type: "CHILD_LOGIN", playerId: teen.playerId, email: world.ctx.email("wrong-email-target") })
    ).json()

    actAs(strangerId) // neither invitedUserId nor invitedEmail match
    const res = await respond(await tokenFor(created.id), "accept")
    expect(res.status).toBe(403)

    const row = await prisma.familyInvitation.findUnique({ where: { id: created.id } })
    expect(row!.status).toBe("PENDING")
  })

  it("410s and flips to EXPIRED when the invite's expiresAt has passed", async () => {
    const teen = await freshTeen("parentExpiry")
    const expiringEmail = world.ctx.email("expiring-teen")
    actAs(teen.parentId)
    const created = await (
      await invite({ type: "CHILD_LOGIN", playerId: teen.playerId, email: expiringEmail })
    ).json()
    await prisma.familyInvitation.update({
      where: { id: created.id },
      data: { expiresAt: new Date(Date.now() - DAY) },
    })

    await signUp(expiringEmail)
    const expiredUserAcct = await prisma.user.findFirst({ where: { email: expiringEmail } })
    actAs(expiredUserAcct!.id)
    const res = await respond(await tokenFor(created.id), "accept")
    expect(res.status).toBe(410)

    const row = await prisma.familyInvitation.findUnique({ where: { id: created.id } })
    expect(row!.status).toBe("EXPIRED")
  })

  it("declines close the invitation without touching the player", async () => {
    const teen = await freshTeen("parentDecline")
    const email = world.ctx.email("decline-teen")
    actAs(teen.parentId)
    const created = await (await invite({ type: "CHILD_LOGIN", playerId: teen.playerId, email })).json()

    await signUp(email)
    const declineUser = await prisma.user.findFirst({ where: { email } })
    actAs(declineUser!.id)
    const res = await respond(await tokenFor(created.id), "decline")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("DECLINED")

    const player = await prisma.player.findUnique({ where: { id: teen.playerId } })
    expect(player!.userId).toBeNull()
  })

  it("GET by token returns the invite for the accept page", async () => {
    const teen = await freshTeen("parentGetCheck")
    const email = world.ctx.email("get-check-teen")
    actAs(teen.parentId)
    const created = await (await invite({ type: "CHILD_LOGIN", playerId: teen.playerId, email })).json()

    const res = await getByToken(await tokenFor(created.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.invitation.type).toBe("CHILD_LOGIN")
    expect(body.invitation.status).toBe("PENDING")
    expect(body.invitation.invitedEmail).toBe(email)
  })
})

describe("GET /api/family-invitations", () => {
  it("lists pending invites sent by and addressed to me", async () => {
    actAs(parentAId)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.invitations)).toBe(true)
  })

  it("401s when signed out", async () => {
    actAs(null)
    expect((await GET()).status).toBe(401)
  })
})
