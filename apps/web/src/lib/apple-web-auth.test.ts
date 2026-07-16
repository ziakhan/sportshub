import { generateKeyPairSync } from "crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { decodeProtectedHeader, jwtVerify } from "jose"

/**
 * apple-web-auth mints the ES256 client-secret JWT Apple requires instead of
 * a static secret. Verified end-to-end against the public half of a
 * throwaway P-256 key — same curve/format as Apple's portal .p8.
 */

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
const pkcs8 = privateKey.export({ type: "pkcs8", format: "pem" }).toString()

async function loadFresh() {
  vi.resetModules() // drop the module-level secret cache between tests
  return import("./apple-web-auth")
}

describe("apple-web-auth", () => {
  beforeEach(() => {
    process.env.APPLE_TEAM_ID = "TEAM123456"
    process.env.APPLE_KEY_ID = "KEY1234567"
    process.env.APPLE_CLIENT_ID = "com.ysportshub.web"
    process.env.APPLE_PRIVATE_KEY_B64 = Buffer.from(pkcs8).toString("base64")
  })

  afterEach(() => {
    delete process.env.APPLE_TEAM_ID
    delete process.env.APPLE_KEY_ID
    delete process.env.APPLE_CLIENT_ID
    delete process.env.APPLE_PRIVATE_KEY_B64
  })

  it("appleWebEnabled requires all four vars", async () => {
    let mod = await loadFresh()
    expect(mod.appleWebEnabled()).toBe(true)
    delete process.env.APPLE_PRIVATE_KEY_B64
    mod = await loadFresh()
    expect(mod.appleWebEnabled()).toBe(false)
  })

  it("mints an ES256 JWT Apple would accept (kid, iss, sub, aud, ~150d exp)", async () => {
    const { appleClientSecret } = await loadFresh()
    const secret = appleClientSecret()

    expect(decodeProtectedHeader(secret)).toMatchObject({ alg: "ES256", kid: "KEY1234567" })

    const { payload } = await jwtVerify(secret, publicKey, {
      issuer: "TEAM123456",
      audience: "https://appleid.apple.com",
    })
    expect(payload.sub).toBe("com.ysportshub.web")
    const now = Math.floor(Date.now() / 1000)
    expect(payload.exp).toBeGreaterThan(now + 149 * 24 * 60 * 60)
    expect(payload.exp).toBeLessThan(now + 151 * 24 * 60 * 60)
  })

  it("caches the secret per process", async () => {
    const { appleClientSecret } = await loadFresh()
    expect(appleClientSecret()).toBe(appleClientSecret())
  })
})
