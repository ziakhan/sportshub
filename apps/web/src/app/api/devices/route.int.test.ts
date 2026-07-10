import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  createUser,
  destroyWorld,
  type BuiltUser,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { DELETE, POST } from "./route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — M3 device registry: register / re-register-moves-account /
 * revoke-own-only / auth. (The push worker itself is unit-tested in
 * apps/sidecar.)
 */

let world: BuiltWorld
let userA: BuiltUser
let userB: BuiltUser
const TOKEN = "ExponentPushToken[int-test-device-1]"

beforeAll(async () => {
  world = await buildWorld({ seed: 1133, clubs: [] })
  userA = await createUser(world.ctx, { localPart: "device-a" })
  userB = await createUser(world.ctx, { localPart: "device-b" })
})

afterAll(async () => {
  await (prisma as any).device.deleteMany({ where: { token: TOKEN } })
  if (world) await destroyWorld(world.ctx)
})

describe("POST/DELETE /api/devices", () => {
  it("anonymous → 401", async () => {
    actAs(null)
    const res = await POST(jsonRequest("/api/devices", { token: TOKEN, platform: "ANDROID" }))
    expect(res.status).toBe(401)
  })

  it("registers a device for the authed user", async () => {
    actAs(userA.id)
    const res = await POST(
      jsonRequest("/api/devices", { token: TOKEN, platform: "ANDROID", appVersion: "1.0.0" })
    )
    expect(res.status).toBe(200)
    const row = await (prisma as any).device.findUnique({ where: { token: TOKEN } })
    expect(row).toMatchObject({
      userId: userA.id,
      platform: "ANDROID",
      provider: "EXPO",
      appVersion: "1.0.0",
      revokedAt: null,
    })
  })

  it("re-register moves the token to the new account and un-revokes", async () => {
    // Simulate a revoked device that a different family member signs into
    await (prisma as any).device.update({
      where: { token: TOKEN },
      data: { revokedAt: new Date() },
    })
    actAs(userB.id)
    const res = await POST(jsonRequest("/api/devices", { token: TOKEN, platform: "ANDROID" }))
    expect(res.status).toBe(200)
    const row = await (prisma as any).device.findUnique({ where: { token: TOKEN } })
    expect(row.userId).toBe(userB.id)
    expect(row.revokedAt).toBeNull()
  })

  it("only the owner can revoke", async () => {
    actAs(userA.id) // not the current owner (userB is)
    await DELETE(jsonRequest("/api/devices", { token: TOKEN }, "DELETE"))
    let row = await (prisma as any).device.findUnique({ where: { token: TOKEN } })
    expect(row.revokedAt).toBeNull()

    actAs(userB.id)
    const res = await DELETE(jsonRequest("/api/devices", { token: TOKEN }, "DELETE"))
    expect(res.status).toBe(200)
    row = await (prisma as any).device.findUnique({ where: { token: TOKEN } })
    expect(row.revokedAt).not.toBeNull()
  })

  it("malformed body → 400", async () => {
    actAs(userA.id)
    const res = await POST(jsonRequest("/api/devices", { platform: "ANDROID" }))
    expect(res.status).toBe(400)
  })
})
