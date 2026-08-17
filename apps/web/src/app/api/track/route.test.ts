import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@youthbasketballhub/db"
import { getToken } from "next-auth/jwt"
import { POST } from "@/app/api/track/route"

vi.mock("@youthbasketballhub/db", () => ({
  prisma: {
    activityEvent: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}))

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn().mockResolvedValue(null),
}))

function request(body: unknown, ip = "1.2.3.4"): Request {
  return new Request("http://localhost/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  })
}

describe("POST /api/track", () => {
  beforeEach(() => {
    vi.mocked((prisma as any).activityEvent.createMany).mockClear()
    vi.mocked(getToken).mockResolvedValue(null as any)
  })

  it("stores a valid batch, anonymous by default", async () => {
    const res = await POST(
      request({
        visitorId: "v1",
        sessionId: "s1",
        events: [
          { kind: "pageview", path: "/launch", meta: { referrer: "https://x.com/a" } },
          { kind: "heartbeat", path: "/launch", meta: { seconds: 15 } },
        ],
      }) as any
    )
    expect(res.status).toBe(200)
    const call = vi.mocked((prisma as any).activityEvent.createMany).mock.calls[0][0]
    expect(call.data).toHaveLength(2)
    expect(call.data[0]).toMatchObject({
      visitorId: "v1",
      sessionId: "s1",
      kind: "pageview",
      path: "/launch",
      signedIn: false,
    })
  })

  it("drops unknown kinds and rows without a path, keeps the rest", async () => {
    await POST(
      request({
        visitorId: "v1",
        sessionId: "s2",
        events: [
          { kind: "evil", path: "/launch" },
          { kind: "click", path: "" },
          { kind: "click", path: "/demos", meta: { label: "Watch the demo" } },
        ],
      }) as any
    )
    const call = vi.mocked((prisma as any).activityEvent.createMany).mock.calls[0][0]
    expect(call.data).toHaveLength(1)
    expect(call.data[0].kind).toBe("click")
  })

  it("writes nothing without ids or events, but never errors", async () => {
    const res = await POST(request({ events: [{ kind: "pageview", path: "/" }] }) as any)
    expect(res.status).toBe(200)
    expect(vi.mocked((prisma as any).activityEvent.createMany)).not.toHaveBeenCalled()
  })

  it("flags rows from a signed-in browser", async () => {
    vi.mocked(getToken).mockResolvedValue({ sub: "u1" } as any)
    await POST(
      request(
        { visitorId: "v2", sessionId: "s3", events: [{ kind: "pageview", path: "/demos" }] },
        "5.6.7.8"
      ) as any
    )
    const call = vi.mocked((prisma as any).activityEvent.createMany).mock.calls[0][0]
    expect(call.data[0].signedIn).toBe(true)
  })
})
