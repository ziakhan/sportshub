import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  createUser,
  destroyWorld,
  WORLD_PASSWORD,
  type BuiltUser,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { resetRateLimits } from "@/lib/rate-limit"
import { POST as loginPOST } from "./token/route"
import { POST as refreshPOST } from "./refresh/route"
import { POST as revokePOST } from "./revoke/route"
import { GET as notificationsGET } from "../notifications/route"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

// getSessionUserId reads the Authorization header via next/headers — in
// direct handler invocation there is no request scope, so we control it here.
let authHeader: string | null = null
vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined }),
  headers: () => ({
    get: (name: string) => (name.toLowerCase() === "authorization" ? authHeader : null),
  }),
}))

// .env.local provides this locally; the fallback keeps CI green.
process.env.AUTH_TOKEN_SECRET ||= "int-test-auth-token-secret"

/**
 * L2 — M2 native bearer auth (docs/roadmap/native-app-execution-plan.md):
 * login, refresh rotation, replay → family revocation, revoke (device +
 * all), and the getSessionUserId bearer path on a real route.
 */

let world: BuiltWorld
let mainUser: BuiltUser // login/refresh/revoke/bearer flows
let limitUser: BuiltUser // rate-limit target
let expiryUser: BuiltUser // expired-refresh-token flow
let inactiveUser: BuiltUser // status=INACTIVE login rejection

let ipCounter = 0
function authRequest(url: string, body?: unknown, opts: { bearer?: string; ip?: string } = {}) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    // Unique per request so the per-IP budget never couples separate tests.
    "x-forwarded-for": opts.ip ?? `10.9.0.${++ipCounter}`,
  }
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`
  return new Request(`http://localhost:3000${url}`, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function login(user: BuiltUser, password = WORLD_PASSWORD) {
  return loginPOST(
    authRequest("/api/auth/token", {
      email: user.email,
      password,
      deviceLabel: "Int Test Phone",
    })
  )
}

beforeAll(async () => {
  world = await buildWorld({ seed: 1131, clubs: [] })
  mainUser = await createUser(world.ctx, { localPart: "native-main" })
  limitUser = await createUser(world.ctx, { localPart: "native-limit" })
  expiryUser = await createUser(world.ctx, { localPart: "native-expiry" })
  inactiveUser = await createUser(world.ctx, { localPart: "native-inactive" })
  await prisma.user.update({ where: { id: inactiveUser.id }, data: { status: "INACTIVE" } })
  await prisma.notification.create({
    data: {
      userId: mainUser.id,
      type: "announcement",
      title: "Bearer smoke test",
      message: "Visible through the bearer path",
    },
  })
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

beforeEach(() => {
  authHeader = null
  resetRateLimits()
})

describe("POST /api/auth/token — native login", () => {
  it("valid credentials return access JWT + refresh token + user", async () => {
    const res = await login(mainUser)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accessToken).toMatch(/^eyJ/)
    expect(body.refreshToken).toBeTruthy()
    expect(new Date(body.accessTokenExpiresAt).getTime()).toBeGreaterThan(Date.now())
    expect(body.user).toEqual({
      id: mainUser.id,
      email: mainUser.email,
      name: `${mainUser.firstName} ${mainUser.lastName}`,
    })
    const row = await prisma.refreshToken.findFirst({
      where: { userId: mainUser.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
    })
    expect(row?.deviceLabel).toBe("Int Test Phone")
    // Opaque token is never stored raw
    expect(row?.tokenHash).not.toBe(body.refreshToken)
  })

  it("wrong password → 401", async () => {
    const res = await login(mainUser, "WrongPass999!")
    expect(res.status).toBe(401)
  })

  it("INACTIVE user → 401 even with the right password", async () => {
    const res = await login(inactiveUser)
    expect(res.status).toBe(401)
  })

  it("malformed body → 400", async () => {
    const res = await loginPOST(authRequest("/api/auth/token", { email: "not-an-email" }))
    expect(res.status).toBe(400)
  })

  it("11th attempt for one email inside the window → 429", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await login(limitUser, "WrongPass999!")
      expect(res.status).toBe(401)
    }
    // Correct password no longer helps — attempts count, not failures.
    const res = await login(limitUser)
    expect(res.status).toBe(429)
  })
})

describe("POST /api/auth/refresh — rotation + replay detection", () => {
  it("rotates through a chain, then a stale replay (past grace) kills the family", async () => {
    const r0 = (await (await login(mainUser)).json()).refreshToken as string

    const res1 = await refreshPOST(authRequest("/api/auth/refresh", { refreshToken: r0 }))
    expect(res1.status).toBe(200)
    const body1 = await res1.json()
    expect(body1.accessToken).toMatch(/^eyJ/)
    const r1 = body1.refreshToken as string
    expect(r1).not.toBe(r0)

    const res2 = await refreshPOST(authRequest("/api/auth/refresh", { refreshToken: r1 }))
    expect(res2.status).toBe(200)
    const r2 = (await res2.json()).refreshToken as string

    // Age r0's revocation past the lost-response grace window — this replay
    // is a genuine theft signal, not a dropped rotation response.
    await prisma.refreshToken.updateMany({
      where: { userId: mainUser.id, revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 5 * 60_000) },
    })

    // Replay the rotated-out r0 → 401 and the whole family is revoked…
    const replay = await refreshPOST(authRequest("/api/auth/refresh", { refreshToken: r0 }))
    expect(replay.status).toBe(401)
    // …so the live tip r2 is dead too.
    const tip = await refreshPOST(authRequest("/api/auth/refresh", { refreshToken: r2 }))
    expect(tip.status).toBe(401)
  })

  it("re-presenting a just-rotated token inside the grace window recovers the session (lost response)", async () => {
    // Other tests leave live tokens for this user — assert on the delta.
    const liveBefore = await prisma.refreshToken.count({
      where: { userId: mainUser.id, revokedAt: null },
    })
    const r0 = (await (await login(mainUser)).json()).refreshToken as string

    // Rotation whose response the client "never received"
    const res1 = await refreshPOST(authRequest("/api/auth/refresh", { refreshToken: r0 }))
    expect(res1.status).toBe(200)
    const r1 = (await res1.json()).refreshToken as string

    // The phone still holds r0 and retries — inside the grace window this is
    // recovery, not theft: 200, fresh token, family alive.
    const retry = await refreshPOST(authRequest("/api/auth/refresh", { refreshToken: r0 }))
    expect(retry.status).toBe(200)
    const rG = (await retry.json()).refreshToken as string
    expect(rG).not.toBe(r0)
    expect(rG).not.toBe(r1)

    // The recovered token is fully usable.
    const next = await refreshPOST(authRequest("/api/auth/refresh", { refreshToken: rG }))
    expect(next.status).toBe(200)

    // Exactly one live token remains in this family (the unseen successor r1
    // was revoked by the recovery).
    const live = await prisma.refreshToken.count({
      where: { userId: mainUser.id, revokedAt: null },
    })
    expect(live).toBe(liveBefore + 1)
  })

  it("unknown token → 401", async () => {
    const res = await refreshPOST(
      authRequest("/api/auth/refresh", { refreshToken: "definitely-not-issued" })
    )
    expect(res.status).toBe(401)
  })

  it("expired refresh token → 401", async () => {
    const r0 = (await (await login(expiryUser)).json()).refreshToken as string
    await prisma.refreshToken.updateMany({
      where: { userId: expiryUser.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const res = await refreshPOST(authRequest("/api/auth/refresh", { refreshToken: r0 }))
    expect(res.status).toBe(401)
  })
})

describe("POST /api/auth/revoke — sign out", () => {
  it("device sign-out: possession of the refresh token revokes its family", async () => {
    const r0 = (await (await login(mainUser)).json()).refreshToken as string
    const res = await revokePOST(authRequest("/api/auth/revoke", { refreshToken: r0 }))
    expect(res.status).toBe(200)
    const after = await refreshPOST(authRequest("/api/auth/refresh", { refreshToken: r0 }))
    expect(after.status).toBe(401)
  })

  it("revoke all requires a valid bearer and kills every device", async () => {
    const [a, b] = await Promise.all([login(mainUser), login(mainUser)])
    const deviceA = await a.json()
    const deviceB = await b.json()

    const noAuth = await revokePOST(authRequest("/api/auth/revoke", { all: true }))
    expect(noAuth.status).toBe(401)

    const res = await revokePOST(
      authRequest("/api/auth/revoke", { all: true }, { bearer: deviceA.accessToken })
    )
    expect(res.status).toBe(200)

    for (const token of [deviceA.refreshToken, deviceB.refreshToken]) {
      const after = await refreshPOST(authRequest("/api/auth/refresh", { refreshToken: token }))
      expect(after.status).toBe(401)
    }
  })

  it("neither refreshToken nor all → 400", async () => {
    const res = await revokePOST(authRequest("/api/auth/revoke", {}))
    expect(res.status).toBe(400)
  })
})

describe("bearer path through getSessionUserId on a real route", () => {
  it("a bearer access token reads the user's notifications", async () => {
    const { accessToken } = await (await login(mainUser)).json()
    authHeader = `Bearer ${accessToken}`
    const res = await notificationsGET(
      new NextRequest("http://localhost:3000/api/notifications")
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.notifications.map((n: any) => n.title)).toContain("Bearer smoke test")
  })

  it("an invalid bearer is a hard 401 — no cookie fallback", async () => {
    authHeader = "Bearer not-a-real-token"
    const res = await notificationsGET(
      new NextRequest("http://localhost:3000/api/notifications")
    )
    expect(res.status).toBe(401)
  })
})
