import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import {
  buildWorld,
  createUser,
  destroyWorld,
  type BuiltUser,
  type BuiltWorld,
} from "@youthbasketballhub/test-worlds"
import { resetRateLimits } from "@/lib/rate-limit"
import {
  createLoginToken,
  redeemLoginCode,
  redeemLoginLink,
  MAX_ACTIVE_REQUESTS,
  MAX_CODE_ATTEMPTS,
} from "@/lib/auth-magic"
import { POST as magicPOST } from "./route"

// Capture the outbound email instead of hitting SMTP — the captured link/code
// also drive the redemption tests, so each test exercises the REAL grant the
// user would have received.
const sentEmails: Array<{ to: string; link: string; code: string }> = []
vi.mock("@/lib/email", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    sendMagicLinkEmail: vi.fn(async (args: { to: string; link: string; code: string }) => {
      sentEmails.push({ to: args.to, link: args.link, code: args.code })
    }),
  }
})

/**
 * L2 — magic sign-in (lib/auth-magic.ts + POST /api/auth/magic-link):
 * request → email capture → link/code redemption, single-use, code lockout,
 * expiry, per-user minting window, anti-enumeration.
 */

let world: BuiltWorld
let mainUser: BuiltUser
let codeUser: BuiltUser
let lockUser: BuiltUser
let windowUser: BuiltUser
let expiryUser: BuiltUser // own user — mainUser's mints would exhaust the window
let inactiveUser: BuiltUser

let ipCounter = 0
function magicRequest(email: string, callbackUrl?: string) {
  return new Request("http://localhost:3000/api/auth/magic-link", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.10.0.${++ipCounter}`,
    },
    body: JSON.stringify({ email, callbackUrl }),
  })
}

function linkToken(link: string): string {
  return new URL(link).searchParams.get("token")!
}

beforeAll(async () => {
  world = await buildWorld({ seed: 1132, clubs: [] })
  mainUser = await createUser(world.ctx, { localPart: "magic-main" })
  codeUser = await createUser(world.ctx, { localPart: "magic-code" })
  lockUser = await createUser(world.ctx, { localPart: "magic-lock" })
  windowUser = await createUser(world.ctx, { localPart: "magic-window" })
  expiryUser = await createUser(world.ctx, { localPart: "magic-expiry" })
  inactiveUser = await createUser(world.ctx, { localPart: "magic-inactive" })
  await prisma.user.update({ where: { id: inactiveUser.id }, data: { status: "INACTIVE" } })
})

afterAll(async () => {
  if (world) await destroyWorld(world.ctx)
})

beforeEach(() => {
  sentEmails.length = 0
  resetRateLimits()
})

describe("POST /api/auth/magic-link", () => {
  it("existing user: 200, row minted, email carries working link + code", async () => {
    const res = await magicPOST(magicRequest(mainUser.email, "/calendar"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })

    expect(sentEmails).toHaveLength(1)
    expect(sentEmails[0].to).toBe(mainUser.email)
    expect(sentEmails[0].code).toMatch(/^\d{6}$/)

    const url = new URL(sentEmails[0].link)
    expect(url.pathname).toBe("/magic-link")
    expect(url.searchParams.get("callbackUrl")).toBe("/calendar")

    const row = await prisma.loginToken.findFirst({ where: { userId: mainUser.id } })
    expect(row).toBeTruthy()
    // Hashed at rest — neither secret appears in the row
    expect(row!.tokenHash).not.toContain(url.searchParams.get("token"))
    expect(row!.codeHash).not.toContain(sentEmails[0].code)
  })

  it("unknown email: 200 with identical body, nothing sent (anti-enumeration)", async () => {
    const res = await magicPOST(magicRequest("nobody-here@example.com"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(sentEmails).toHaveLength(0)
  })

  it("inactive user: 200, nothing sent", async () => {
    const res = await magicPOST(magicRequest(inactiveUser.email))
    expect(res.status).toBe(200)
    expect(sentEmails).toHaveLength(0)
  })

  it("off-origin callbackUrl is dropped from the emailed link", async () => {
    await magicPOST(magicRequest(mainUser.email, "https://evil.example.com/phish"))
    expect(sentEmails).toHaveLength(1)
    expect(new URL(sentEmails[0].link).searchParams.get("callbackUrl")).toBeNull()
  })
})

describe("link redemption", () => {
  it("works once, then the grant is dead", async () => {
    await magicPOST(magicRequest(mainUser.email))
    const token = linkToken(sentEmails[0].link)

    const user = await redeemLoginLink(token)
    expect(user).toEqual({
      id: mainUser.id,
      email: mainUser.email,
      name: `${mainUser.firstName} ${mainUser.lastName}`,
    })

    expect(await redeemLoginLink(token)).toBeNull()
  })

  it("expired token: null", async () => {
    await magicPOST(magicRequest(expiryUser.email))
    const token = linkToken(sentEmails[0].link)
    await prisma.loginToken.updateMany({
      where: { userId: expiryUser.id, consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    expect(await redeemLoginLink(token)).toBeNull()
  })

  it("garbage token: null", async () => {
    expect(await redeemLoginLink("not-a-real-token")).toBeNull()
  })
})

describe("code redemption", () => {
  it("correct email+code signs in, single-use, and kills the paired link", async () => {
    await magicPOST(magicRequest(codeUser.email))
    const { code, link } = sentEmails[0]

    const user = await redeemLoginCode(codeUser.email.toUpperCase(), code)
    expect(user?.id).toBe(codeUser.id)

    // Same grant: both shapes are consumed together
    expect(await redeemLoginCode(codeUser.email, code)).toBeNull()
    expect(await redeemLoginLink(linkToken(link))).toBeNull()
  })

  it("someone else's code: null (id-salted hashes never cross accounts)", async () => {
    await magicPOST(magicRequest(codeUser.email))
    const { code } = sentEmails[0]
    expect(await redeemLoginCode(mainUser.email, code)).toBeNull()
  })

  it(`${MAX_CODE_ATTEMPTS} wrong guesses lock the grant — even the right code and link die`, async () => {
    await magicPOST(magicRequest(lockUser.email))
    const { code, link } = sentEmails[0]
    const wrong = code === "000000" ? "000001" : "000000"

    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
      expect(await redeemLoginCode(lockUser.email, wrong)).toBeNull()
    }

    expect(await redeemLoginCode(lockUser.email, code)).toBeNull()
    expect(await redeemLoginLink(linkToken(link))).toBeNull()
  })
})

describe("minting window", () => {
  it(`stops after ${MAX_ACTIVE_REQUESTS} live requests; response stays identical`, async () => {
    for (let i = 0; i < MAX_ACTIVE_REQUESTS; i++) {
      const res = await magicPOST(magicRequest(windowUser.email))
      expect(res.status).toBe(200)
    }
    expect(sentEmails).toHaveLength(MAX_ACTIVE_REQUESTS)

    const res = await magicPOST(magicRequest(windowUser.email))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(sentEmails).toHaveLength(MAX_ACTIVE_REQUESTS) // no 4th email

    const rows = await prisma.loginToken.count({ where: { userId: windowUser.id } })
    expect(rows).toBe(MAX_ACTIVE_REQUESTS)
  })

  it("direct mint for an inactive user's id still redeems to null", async () => {
    const minted = await createLoginToken(inactiveUser.id)
    expect(minted).toBeTruthy()
    expect(await redeemLoginLink(minted!.token)).toBeNull()
  })
})
