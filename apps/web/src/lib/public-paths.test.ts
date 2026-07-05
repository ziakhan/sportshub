import { describe, expect, it } from "vitest"
import { isPublicPath } from "@/lib/public-paths"

describe("isPublicPath", () => {
  it("allows exact public routes and nested public pages", () => {
    expect(isPublicPath("/")).toBe(true)
    expect(isPublicPath("/club")).toBe(true)
    expect(isPublicPath("/club/warriors")).toBe(true)
    expect(isPublicPath("/api/auth/signup", "POST")).toBe(true)
    expect(isPublicPath("/api/auth/session")).toBe(true)
  })

  it("does not overmatch lookalike protected routes", () => {
    expect(isPublicPath("/clubs")).toBe(false)
    expect(isPublicPath("/marketplace-admin")).toBe(false)
    // League MANAGEMENT lives under /manage (public /leagues is the
    // spectator browse index)
    expect(isPublicPath("/manage/leagues")).toBe(false)
    expect(isPublicPath("/manage/leagues/abc/payments")).toBe(false)
  })

  it("allows anonymous READS of public API namespaces", () => {
    expect(isPublicPath("/api/seasons/abc/standings", "GET")).toBe(true)
    expect(isPublicPath("/api/tryouts", "GET")).toBe(true)
    expect(isPublicPath("/api/leagues", "HEAD")).toBe(true)
  })

  it("blocks anonymous MUTATIONS under public API namespaces", () => {
    expect(isPublicPath("/api/seasons/abc/schedule/commit", "POST")).toBe(false)
    expect(isPublicPath("/api/seasons/abc/submit", "POST")).toBe(false)
    expect(isPublicPath("/api/seasons/abc/divisions", "POST")).toBe(false)
    expect(isPublicPath("/api/tryouts/abc/signup", "POST")).toBe(false)
    expect(isPublicPath("/api/venues", "POST")).toBe(false)
    expect(isPublicPath("/api/reviews", "POST")).toBe(false)
    expect(isPublicPath("/api/leagues", "DELETE")).toBe(false)
  })

  it("keeps NextAuth flows public for all methods", () => {
    expect(isPublicPath("/api/auth/callback/credentials", "POST")).toBe(true)
    expect(isPublicPath("/api/auth/signout", "POST")).toBe(true)
  })

  it("never exposes unknown API namespaces", () => {
    expect(isPublicPath("/api/admin/users", "GET")).toBe(false)
    expect(isPublicPath("/api/offers", "GET")).toBe(false)
    expect(isPublicPath("/api/players", "GET")).toBe(false)
  })

  it("gates dev utilities by environment (non-production in tests)", () => {
    // vitest runs with NODE_ENV=test, so these are allowed here;
    // in production builds the same branch excludes them entirely.
    expect(isPublicPath("/api/dev/seed-demo-data", "GET")).toBe(true)
    expect(isPublicPath("/api/create-test-users", "POST")).toBe(true)
  })
})
