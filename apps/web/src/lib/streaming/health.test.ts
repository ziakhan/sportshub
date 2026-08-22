import { afterEach, describe, expect, it, vi } from "vitest"

// The probe itself never touches the database — only probeChannels does — so
// the client is mocked away rather than dragged into a unit run.
vi.mock("@youthbasketballhub/db", () => ({ prisma: {} }))

import { isSignalFresh, probeChannel, SIGNAL_FRESH_MS } from "./health"

/**
 * L1 — what the health probe SAYS, per HTTP status.
 * (docs/roadmap/live-streaming-plan.md, phase 2; owner defect 2026-08-21.)
 *
 * This suite exists because of one wrong sentence. Cloudflare answers a live
 * input with no broadcast arriving with HTTP 204, and the probe called that
 * "That URL answered, but it is not an HLS manifest" — so the owner went
 * hunting for a broken URL when the camera was simply not switched on. Every
 * case below pins the exact words an operator reads, because the words are the
 * feature: this page's whole job is telling somebody in a gym what to go and
 * touch.
 */

const CHANNEL = {
  id: "channel-1",
  name: "Camera A",
  playbackUrl: "https://cdn.stream-test.local/a/index.m3u8",
}

const LIVE_MANIFEST = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\nseg-1.ts\n"
const CLOSED_MANIFEST = `${LIVE_MANIFEST}#EXT-X-ENDLIST\n`

const IDLE_DETAIL = "No broadcast arriving. Start the camera pointed at this stream key."

interface Reply {
  status: number
  body?: string
}

/**
 * Script one reply per method. Returns the list of methods actually called,
 * which is how the "a HEAD is enough" cases prove they never spent a GET.
 */
function serve(byMethod: { HEAD?: Reply | Error; GET?: Reply | Error }): string[] {
  const calls: string[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init?: { method?: string }) => {
      const method = (init?.method ?? "GET").toUpperCase()
      calls.push(method)
      const reply = byMethod[method as "HEAD" | "GET"]
      if (!reply) throw new Error(`the probe made an unscripted ${method}`)
      if (reply instanceof Error) throw reply
      // 204 and HEAD both carry no body, and Response refuses to build one.
      const bodiless = reply.status === 204 || method === "HEAD"
      return new Response(bodiless ? null : (reply.body ?? ""), { status: reply.status })
    })
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("probeChannel: a running manifest", () => {
  it("reads a playlist with no ENDLIST as live, and says nothing further", async () => {
    serve({ HEAD: { status: 200 }, GET: { status: 206, body: LIVE_MANIFEST } })
    await expect(probeChannel(CHANNEL)).resolves.toEqual({ state: "live", detail: null })
  })

  it("reads a closed playlist as idle, because the rig HAD been pushing", async () => {
    serve({ HEAD: { status: 200 }, GET: { status: 200, body: CLOSED_MANIFEST } })
    await expect(probeChannel(CHANNEL)).resolves.toEqual({
      state: "idle",
      detail: "The last broadcast ended, so nothing is arriving on this address now.",
    })
  })
})

describe("probeChannel: 204 is idle, not a broken URL", () => {
  it("answers the defect: a 204 says no broadcast is arriving, and names the fix", async () => {
    const calls = serve({ HEAD: { status: 204 } })
    await expect(probeChannel(CHANNEL)).resolves.toEqual({ state: "idle", detail: IDLE_DETAIL })
    // A HEAD settled it. An idle rig costs one request, not two.
    expect(calls).toEqual(["HEAD"])
  })

  it("says the same thing when the 204 only shows up on the GET", async () => {
    const calls = serve({ HEAD: { status: 200 }, GET: { status: 204 } })
    await expect(probeChannel(CHANNEL)).resolves.toEqual({ state: "idle", detail: IDLE_DETAIL })
    expect(calls).toEqual(["HEAD", "GET"])
  })

  it("treats any 2xx with an empty body as the same statement", async () => {
    serve({ HEAD: { status: 200 }, GET: { status: 200, body: "   \n" } })
    await expect(probeChannel(CHANNEL)).resolves.toEqual({ state: "idle", detail: IDLE_DETAIL })
  })
})

describe("probeChannel: the genuinely broken shapes", () => {
  it("calls a body that is not a playlist a misconfiguration, in its own words", async () => {
    serve({
      HEAD: { status: 200 },
      GET: { status: 200, body: "<!doctype html><title>Dashboard</title>" },
    })
    await expect(probeChannel(CHANNEL)).resolves.toEqual({
      state: "fault",
      detail:
        "That address answered with something that is not an HLS manifest, so the playback URL is pointing at the wrong thing.",
    })
  })

  it("carries both readings of a 404 rather than picking one", async () => {
    const calls = serve({ HEAD: { status: 404 } })
    await expect(probeChannel(CHANNEL)).resolves.toEqual({
      state: "fault",
      detail:
        "Nothing is published at that address. Either the camera has never gone live on it, or the playback URL is wrong.",
    })
    expect(calls).toEqual(["HEAD"])
  })

  it("reports a refusal only when the GET refuses too, and names the status", async () => {
    const calls = serve({ HEAD: { status: 403 }, GET: { status: 403 } })
    await expect(probeChannel(CHANNEL)).resolves.toEqual({
      state: "fault",
      detail:
        "The stream host refused the request (403). That address may need a signed token, or the camera may not have gone live on it yet.",
    })
    expect(calls).toEqual(["HEAD", "GET"])
  })

  it("believes the GET over a HEAD-only 403, because origins refuse HEAD and serve GET", async () => {
    serve({ HEAD: { status: 403 }, GET: { status: 200, body: LIVE_MANIFEST } })
    await expect(probeChannel(CHANNEL)).resolves.toEqual({ state: "live", detail: null })
  })

  it("names 401 as 401", async () => {
    serve({ HEAD: { status: 401 }, GET: { status: 401 } })
    await expect(probeChannel(CHANNEL)).resolves.toMatchObject({
      state: "fault",
      detail: expect.stringContaining("(401)"),
    })
  })

  it("passes an unexpected status straight through", async () => {
    serve({ HEAD: { status: 500 } })
    await expect(probeChannel(CHANNEL)).resolves.toEqual({
      state: "fault",
      detail: "The playback URL answered 500",
    })
  })

  it("falls through a HEAD the origin does not implement", async () => {
    const calls = serve({ HEAD: { status: 405 }, GET: { status: 200, body: LIVE_MANIFEST } })
    await expect(probeChannel(CHANNEL)).resolves.toEqual({ state: "live", detail: null })
    expect(calls).toEqual(["HEAD", "GET"])
  })
})

describe("probeChannel: nothing to probe", () => {
  it("refuses an address that is not a URL, without dialling anything", async () => {
    const calls = serve({})
    await expect(probeChannel({ ...CHANNEL, playbackUrl: "camera one" })).resolves.toEqual({
      state: "fault",
      detail: "The playback URL is not a valid address",
    })
    expect(calls).toEqual([])
  })

  it("refuses an ingest scheme, which is the wrong address entirely", async () => {
    serve({})
    await expect(
      probeChannel({ ...CHANNEL, playbackUrl: "rtmps://live.cloudflare.com:443/live/" })
    ).resolves.toEqual({ state: "fault", detail: "The playback URL is not http or https" })
  })

  it("separates a timeout from an unreachable host", async () => {
    const timeout = new Error("timed out")
    timeout.name = "TimeoutError"
    serve({ HEAD: timeout })
    await expect(probeChannel(CHANNEL)).resolves.toEqual({
      state: "fault",
      detail: "The playback URL did not answer in time",
    })

    vi.unstubAllGlobals()
    const refused = new TypeError("fetch failed")
    serve({ HEAD: refused })
    await expect(probeChannel(CHANNEL)).resolves.toEqual({
      state: "fault",
      detail: "Could not reach the playback URL",
    })
  })
})

describe("isSignalFresh: the stamp is read, never a stored flag", () => {
  const now = new Date("2026-08-21T20:00:00Z")

  it("is green inside the window and red past it", () => {
    expect(isSignalFresh(new Date(now.getTime() - 1_000), now)).toBe(true)
    expect(isSignalFresh(new Date(now.getTime() - SIGNAL_FRESH_MS), now)).toBe(true)
    expect(isSignalFresh(new Date(now.getTime() - SIGNAL_FRESH_MS - 1), now)).toBe(false)
  })

  it("reads an ISO string the same as a Date, and never trusts junk", () => {
    expect(isSignalFresh(new Date(now.getTime() - 30_000).toISOString(), now)).toBe(true)
    expect(isSignalFresh("not a date", now)).toBe(false)
    expect(isSignalFresh(null, now)).toBe(false)
  })
})
