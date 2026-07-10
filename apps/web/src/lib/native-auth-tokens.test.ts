import { beforeAll, describe, expect, it } from "vitest"
import { SignJWT } from "jose"
import {
  ACCESS_TOKEN_TTL_SECONDS,
  bearerToken,
  mintAccessToken,
  verifyAccessToken,
} from "@/lib/native-auth-tokens"

const TEST_SECRET = "unit-test-auth-token-secret"

beforeAll(() => {
  process.env.AUTH_TOKEN_SECRET = TEST_SECRET
})

describe("mintAccessToken / verifyAccessToken", () => {
  it("round-trips: minted token verifies to the same userId", async () => {
    const { token, expiresAt } = await mintAccessToken("user-123")
    expect(await verifyAccessToken(token)).toBe("user-123")
    const ttlMs = expiresAt.getTime() - Date.now()
    expect(ttlMs).toBeGreaterThan((ACCESS_TOKEN_TTL_SECONDS - 60) * 1000)
    expect(ttlMs).toBeLessThanOrEqual(ACCESS_TOKEN_TTL_SECONDS * 1000)
  })

  it("rejects a token signed with a different secret", async () => {
    const forged = await new SignJWT({ token_use: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("wrong-secret"))
    expect(await verifyAccessToken(forged)).toBeNull()
  })

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ token_use: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(TEST_SECRET))
    expect(await verifyAccessToken(expired)).toBeNull()
  })

  it("rejects a valid JWT without token_use=access (a realtime ticket)", async () => {
    // M1 socket tickets share the secret but must never work as API creds.
    const ticket = await new SignJWT({ rooms: ["team:t1"] })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setExpirationTime("60s")
      .sign(new TextEncoder().encode(TEST_SECRET))
    expect(await verifyAccessToken(ticket)).toBeNull()
  })

  it("rejects garbage", async () => {
    expect(await verifyAccessToken("not-a-jwt")).toBeNull()
    expect(await verifyAccessToken("")).toBeNull()
  })
})

describe("bearerToken", () => {
  it("extracts the token from a Bearer header, case-insensitively", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi")
    expect(bearerToken("bearer abc")).toBe("abc")
  })

  it("returns null for missing or non-Bearer headers", () => {
    expect(bearerToken(null)).toBeNull()
    expect(bearerToken(undefined)).toBeNull()
    expect(bearerToken("")).toBeNull()
    expect(bearerToken("Basic dXNlcjpwdw==")).toBeNull()
    expect(bearerToken("Bearer")).toBeNull()
    expect(bearerToken("Bearer ")).toBeNull()
  })
})
