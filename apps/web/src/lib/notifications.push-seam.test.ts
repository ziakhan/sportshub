import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { notify, notifyMany } from "@/lib/notifications"

vi.mock("@youthbasketballhub/db", () => ({
  prisma: {
    notification: {
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
    },
  },
}))

/**
 * The M3 push seam: push-enabled notification types must reach the
 * sidecar's /internal/push (detached), everything else stays bell-only.
 */

import { prisma } from "@youthbasketballhub/db"

describe("notifications push seam", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    process.env.SIDECAR_URL = "http://sidecar.test"
    process.env.SIDECAR_SHARED_SECRET = "seam-test-secret"
    fetchMock.mockReset().mockResolvedValue(new Response("{}"))
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.SIDECAR_URL
    delete process.env.SIDECAR_SHARED_SECRET
  })

  const pushCalls = () =>
    fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/internal/push"))

  it("a push-enabled type enqueues on the sidecar", async () => {
    await notify(prisma, {
      userId: "u1",
      type: "game_final",
      title: "Final Score",
      message: "50 — 40",
      link: "/live/g1",
    })
    await vi.waitFor(() => expect(pushCalls()).toHaveLength(1))
    const body = JSON.parse(pushCalls()[0][1].body)
    expect(body.items).toEqual([
      { userId: "u1", type: "game_final", title: "Final Score", message: "50 — 40", link: "/live/g1" },
    ])
  })

  it("a bell-only type does not touch /internal/push", async () => {
    await notify(prisma, {
      userId: "u1",
      type: "claim_approved",
      title: "Claim approved",
      message: "Your club claim was approved",
    })
    // The realtime bell ping still fires — wait for it, then check push
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/internal/publish"))).toBe(true)
    )
    expect(pushCalls()).toHaveLength(0)
  })

  it("notifyMany fans one push item per recipient", async () => {
    await notifyMany(prisma, ["u1", "u2", "u3"], {
      type: "team_chat",
      title: "New message",
      message: "Coach: practice moved",
      link: "/teams/t1/chat",
    })
    await vi.waitFor(() => expect(pushCalls()).toHaveLength(1))
    const body = JSON.parse(pushCalls()[0][1].body)
    expect(body.items.map((i: any) => i.userId)).toEqual(["u1", "u2", "u3"])
  })
})
