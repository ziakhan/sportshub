import { describe, expect, it } from "vitest"
import { isPublicPath } from "@/lib/public-paths"

describe("isPublicPath", () => {
  it("allows exact public routes and nested public pages", () => {
    expect(isPublicPath("/")).toBe(true)
    expect(isPublicPath("/club")).toBe(true)
    expect(isPublicPath("/club/warriors")).toBe(true)
    expect(isPublicPath("/api/auth/signup")).toBe(true)
    expect(isPublicPath("/api/auth/session")).toBe(true)
  })

  it("does not overmatch lookalike protected routes", () => {
    expect(isPublicPath("/clubs")).toBe(false)
    expect(isPublicPath("/marketplace-admin")).toBe(false)
    expect(isPublicPath("/leagues/private")).toBe(false)
  })
})
