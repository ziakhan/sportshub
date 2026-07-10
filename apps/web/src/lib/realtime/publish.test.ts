import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createHmac } from "node:crypto"
import { publishRealtime, rooms } from "@/lib/realtime/publish"

/**
 * The HMAC here must stay byte-compatible with the sidecar's verifyPublish
 * (apps/sidecar/src/hmac.ts): sha256 over `${timestamp}.${rawBody}` with the
 * shared secret, hex-encoded, carried in x-timestamp / x-signature.
 */

const SECRET = "unit-test-sidecar-secret"

function sidecarVerify(secret: string, timestamp: string, signature: string, rawBody: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex") === signature
}

describe("publishRealtime", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    process.env.SIDECAR_URL = "http://sidecar.test"
    process.env.SIDECAR_SHARED_SECRET = SECRET
    fetchMock.mockReset().mockResolvedValue(new Response("{}"))
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.SIDECAR_URL
    delete process.env.SIDECAR_SHARED_SECRET
  })

  it("signs the publish exactly the way the sidecar verifies it", async () => {
    await publishRealtime({
      rooms: [rooms.game("g1"), rooms.scores],
      event: "game.update",
      payload: { gameId: "g1", homeScore: 10 },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("http://sidecar.test/internal/publish")
    const { "x-timestamp": ts, "x-signature": sig } = init.headers
    expect(sidecarVerify(SECRET, ts, sig, init.body)).toBe(true)
    expect(JSON.parse(init.body)).toEqual({
      rooms: ["game:g1", "scores"],
      event: "game.update",
      payload: { gameId: "g1", homeScore: 10 },
    })
  })

  it("chunks a large user fan-out to stay under the sidecar's 50-room cap", async () => {
    const many = Array.from({ length: 120 }, (_, i) => rooms.user(`u${i}`))
    await publishRealtime({ rooms: many, event: "notify", payload: { type: "team_chat" } })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const sizes = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).rooms.length)
    expect(sizes).toEqual([50, 50, 20])
  })

  it("no-ops without SIDECAR_URL and with zero rooms", async () => {
    delete process.env.SIDECAR_URL
    await publishRealtime({ rooms: ["scores"], event: "x", payload: {} })
    process.env.SIDECAR_URL = "http://sidecar.test"
    await publishRealtime({ rooms: [], event: "x", payload: {} })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("never throws when the sidecar is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"))
    await expect(
      publishRealtime({ rooms: ["scores"], event: "x", payload: {} })
    ).resolves.toBeUndefined()
  })
})
