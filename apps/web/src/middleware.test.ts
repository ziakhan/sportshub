import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import middleware from "@/middleware"

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}))

function createRequest(url: string, host?: string) {
  const headers = new Headers()
  if (host) {
    headers.set("host", host)
  }

  return new NextRequest(url, { headers })
}

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXTAUTH_SECRET = "test-secret"
  })

  it("redirects protected requests without a token to sign-in", async () => {
    vi.mocked(getToken).mockResolvedValue(null)

    const response = await middleware(
      createRequest("http://localhost:3000/dashboard", "localhost:3000")
    )

    expect(getToken).toHaveBeenCalled()
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in?callbackUrl=%2Fdashboard"
    )
  })

  it("allows public routes without calling auth", async () => {
    const response = await middleware(
      createRequest("http://localhost:3000/club/warriors", "localhost:3000")
    )

    expect(getToken).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it("301s club subdomains to the canonical path URL (seo-strategy §6c)", async () => {
    vi.mocked(getToken).mockResolvedValue({ sub: "user-1" } as any)

    const response = await middleware(
      createRequest(
        "https://warriors.sportshubone.com/dashboard",
        "warriors.sportshubone.com"
      )
    )

    expect(response.status).toBe(301)
    expect(response.headers.get("location")).toBe("http://localhost:3000/club/warriors")
  })

  it("does not treat reserved subdomains as clubs", async () => {
    vi.mocked(getToken).mockResolvedValue({ sub: "user-1" } as any)

    const response = await middleware(
      createRequest("https://www.sportshubone.com/dashboard", "www.sportshubone.com")
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })

  it("passes unknown custom domains through while the feature flag is off", async () => {
    const response = await middleware(
      createRequest("https://eaglesbasketball.ca/", "eaglesbasketball.ca")
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("x-middleware-rewrite")).toBeNull()
  })
})
