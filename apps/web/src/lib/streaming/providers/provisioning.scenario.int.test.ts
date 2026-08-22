import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { buildWorld, destroyWorld, type BuiltWorld } from "@youthbasketballhub/test-worlds"
import { actAs, jsonRequest } from "@/test/integration-harness"
import { POST as channelsPost } from "@/app/api/admin/streams/channels/route"
import { GET as providersGet } from "@/app/api/admin/streams/providers/route"
import { cloudflareStreamProvider } from "./cloudflare"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(), default: vi.fn() }))

/**
 * L2 — provider auto-provisioning (world seed 1154).
 * docs/roadmap/live-streaming-plan.md + the owner's ask, 2026-08-21:
 * "when you create a new channel, I want you to create it for me and allow me
 * to copy-paste that on the camera".
 *
 * THE REAL CLOUDFLARE API IS NEVER CALLED. The fake lives at the `fetch`
 * boundary rather than at the provider interface, deliberately: that way the
 * genuine provider code runs — the request body we send, the customer-code
 * derivation out of `webRTCPlayback.url`, the playback URL we build, and the
 * mapping of Cloudflare's own `errors[].message` onto something an operator
 * can act on. Mocking `getProvider` instead would have tested the mock.
 *
 * What is pinned down here:
 *   • provisioning stores exactly what came back, and nothing else
 *   • the customer code comes from the RESPONSE, so its env var is a fallback
 *   • a refusal writes NO row and repeats Cloudflare's own words
 *   • manual mode is untouched, and now needs only a playback URL
 *   • the token never reaches the database, the response, or the audit trail
 */

let world: BuiltWorld
let adminId: string
let outsiderId: string
let namePrefix: string

const ACCOUNT_ID = "test-account-id-0000"
const TOKEN = "cf-token-must-never-be-stored-or-logged"
const UID = "f256e6ea9341d51eea64c9454659e576"
const CUSTOMER_CODE = "d8x7testcode"
const RTMPS_URL = "rtmps://live.cloudflare.com:443/live/"
const RTMPS_KEY = "MTQ0MTcjM3MjI1NDE3ODIyNTI1MjYyMjE4NTI2ODI1NDcxMzUyMzc"

/** The shape verified against Cloudflare's docs + their TS SDK, 2026-08-21. */
function liveInputResponse(overrides: Record<string, unknown> = {}) {
  return {
    result: {
      uid: UID,
      rtmps: { url: RTMPS_URL, streamKey: RTMPS_KEY },
      rtmpsPlayback: { url: RTMPS_URL, streamKey: "playback-key" },
      srt: { url: "srt://live.cloudflare.com:778", streamId: UID, passphrase: "x" },
      webRTC: { url: `https://customer-${CUSTOMER_CODE}.cloudflarestream.com/SECRET/webRTC/publish` },
      webRTCPlayback: {
        url: `https://customer-${CUSTOMER_CODE}.cloudflarestream.com/${UID}/webRTC/play`,
      },
      created: "2026-08-21T05:05:53.451415Z",
      modified: "2026-08-21T05:05:53.451415Z",
      meta: { name: "test stream" },
      status: null,
      enabled: true,
      recording: { mode: "off", requireSignedURLs: false, allowedOrigins: null },
      deleteRecordingAfterDays: null,
      ...overrides,
    },
    success: true,
    errors: [],
    messages: [],
  }
}

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

/** Stands in for api.cloudflare.com. Returns the calls it received. */
function fakeCloudflare(responder: () => Response) {
  const calls: Array<{ url: string; method: string; body: any; auth: string | null }> = []
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation((async (
    input: any,
    init: any
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.url
    if (!url.includes("api.cloudflare.com")) {
      throw new Error(`Unexpected outbound request in test: ${url}`)
    }
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(init.body as string) : null,
      auth: new Headers(init?.headers ?? {}).get("authorization"),
    })
    return responder()
  }) as any)
  return { calls, spy }
}

const channelsFor = () =>
  prisma.streamChannel.findMany({ where: { name: { startsWith: namePrefix } } })

beforeAll(async () => {
  world = await buildWorld({ seed: 1154 })
  namePrefix = `[${world.ctx.runId}]`

  // Channels are global rows with no runId FK — a crashed earlier run would
  // leave them behind, so sweep the namespace first.
  await prisma.streamChannel.deleteMany({ where: { name: { startsWith: namePrefix } } })

  const admin = await prisma.user.create({
    data: {
      email: world.ctx.email("provision-admin"),
      passwordHash: "x",
      firstName: "Ops",
      lastName: "Admin",
      status: "ACTIVE",
      onboardedAt: new Date(),
    },
  })
  adminId = admin.id
  await prisma.userRole.create({ data: { userId: adminId, role: "PlatformAdmin" } })

  const outsider = await prisma.user.create({
    data: {
      email: world.ctx.email("provision-outsider"),
      passwordHash: "x",
      firstName: "Passing",
      lastName: "Stranger",
      status: "ACTIVE",
      onboardedAt: new Date(),
    },
  })
  outsiderId = outsider.id
})

afterAll(async () => {
  if (!world) return
  await prisma.streamChannel.deleteMany({ where: { name: { startsWith: namePrefix } } })
  await destroyWorld(world.ctx)
})

beforeEach(() => {
  // Credentials are env-only (never the database, never a file in the repo),
  // so the test sets them the same way production does.
  process.env.CLOUDFLARE_ACCOUNT_ID = ACCOUNT_ID
  process.env.CLOUDFLARE_STREAM_TOKEN = TOKEN
  delete process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.CLOUDFLARE_ACCOUNT_ID
  delete process.env.CLOUDFLARE_STREAM_TOKEN
  delete process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE
})

describe("stream channel provisioning (integration)", () => {
  it("creates the live input at Cloudflare and stores exactly what came back", async () => {
    const { calls } = fakeCloudflare(() => okResponse(liveInputResponse()))
    const name = world.ctx.name("Camera Provisioned")

    actAs(adminId)
    const res = await channelsPost(
      jsonRequest("/api/admin/streams/channels", {
        mode: "provision",
        provider: "cloudflare",
        name,
      }) as any,
      {}
    )
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.provisioned).toBe(true)

    // What we asked Cloudflare for.
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe("POST")
    expect(calls[0].url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/live_inputs`
    )
    expect(calls[0].body).toEqual({
      meta: { name },
      // Recording is what makes a Cloudflare live input playable at all, and
      // the retention ceiling goes on at creation so storage cannot run away.
      recording: { mode: "automatic" },
      deleteRecordingAfterDays: 30,
    })
    expect(calls[0].auth).toBe(`Bearer ${TOKEN}`)

    // What we kept. The playback URL is BUILT — Cloudflare returns no .m3u8
    // anywhere in the create response.
    const stored = await prisma.streamChannel.findUniqueOrThrow({ where: { id: json.channel.id } })
    expect(stored.externalId).toBe(UID)
    expect(stored.provider).toBe("cloudflare")
    expect(stored.ingestUrl).toBe(RTMPS_URL)
    expect(stored.streamKey).toBe(RTMPS_KEY)
    expect(stored.playbackUrl).toBe(
      `https://customer-${CUSTOMER_CODE}.cloudflarestream.com/${UID}/manifest/video.m3u8`
    )

    // The operator gets the pair back to paste into the camera app…
    expect(json.channel.ingestUrl).toBe(RTMPS_URL)
    expect(json.channel.streamKey).toBe(RTMPS_KEY)
    // …but our Cloudflare token is not part of any of it.
    expect(JSON.stringify(json)).not.toContain(TOKEN)

    const trail = await prisma.auditLog.findFirst({
      where: { action: "STREAM_CHANNEL_CREATE", resourceId: json.channel.id },
      select: { metadata: true },
    })
    expect((trail?.metadata as any)?.externalId).toBe(UID)
    expect((trail?.metadata as any)?.provisioned).toBe(true)
    // The trail is read by more people than the console is.
    expect(JSON.stringify(trail?.metadata)).not.toContain(RTMPS_KEY)
    expect(JSON.stringify(trail?.metadata)).not.toContain(TOKEN)
  })

  it("derives the customer code from the response, so its env var is only a fallback", async () => {
    // No CLOUDFLARE_STREAM_CUSTOMER_CODE is set here (beforeEach deletes it)
    // and the previous test still built a correct playback URL. Now prove the
    // fallback path: an account whose response carries no WebRTC block.
    const withoutWebRtc = liveInputResponse()
    delete (withoutWebRtc.result as any).webRTC
    delete (withoutWebRtc.result as any).webRTCPlayback

    process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE = "envfallbackcode"
    const { spy } = fakeCloudflare(() => okResponse(withoutWebRtc))

    actAs(adminId)
    const res = await channelsPost(
      jsonRequest("/api/admin/streams/channels", {
        mode: "provision",
        provider: "cloudflare",
        name: world.ctx.name("Camera EnvCode"),
      }) as any,
      {}
    )
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.channel.playbackUrl).toBe(
      `https://customer-envfallbackcode.cloudflarestream.com/${UID}/manifest/video.m3u8`
    )
    expect(spy).toHaveBeenCalledTimes(1)

    // And with neither, it refuses by NAME rather than saving a broken URL.
    delete process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE
    const before = (await channelsFor()).length
    const refused = await channelsPost(
      jsonRequest("/api/admin/streams/channels", {
        mode: "provision",
        provider: "cloudflare",
        name: world.ctx.name("Camera NoCode"),
      }) as any,
      {}
    )
    expect(refused.status).toBe(502)
    expect((await refused.json()).error).toContain("CLOUDFLARE_STREAM_CUSTOMER_CODE")
    expect((await channelsFor()).length).toBe(before)
  })

  it("defaults recording ON, because a Cloudflare channel with it off never shows a picture", async () => {
    const { calls } = fakeCloudflare(() => okResponse(liveInputResponse()))
    actAs(adminId)

    // No choice made. Cloudflare serves live playback out of the recording
    // pipeline, so "off" here would create a camera that connects and never
    // produces a manifest — a dead channel by default.
    await channelsPost(
      jsonRequest("/api/admin/streams/channels", {
        mode: "provision",
        provider: "cloudflare",
        name: world.ctx.name("Camera Default"),
      }) as any,
      {}
    )
    expect(calls[0].body.recording).toEqual({ mode: "automatic" })

    // Off is still a choice a person can make deliberately.
    await channelsPost(
      jsonRequest("/api/admin/streams/channels", {
        mode: "provision",
        provider: "cloudflare",
        name: world.ctx.name("Camera Unrecorded"),
        recording: "off",
      }) as any,
      {}
    )
    expect(calls[1].body.recording).toEqual({ mode: "off" })
  })

  it("caps retention at creation, at Cloudflare's own minimum", async () => {
    // Storage is billed until something deletes it, and the thing that deletes
    // it must not be a cron nobody wrote. 30 is their floor: 1 and 7 are
    // refused, 30 to 1096 accepted (tested against a real account 2026-08-22).
    const { calls } = fakeCloudflare(() => okResponse(liveInputResponse()))
    actAs(adminId)

    await channelsPost(
      jsonRequest("/api/admin/streams/channels", {
        mode: "provision",
        provider: "cloudflare",
        name: world.ctx.name("Camera Retention"),
      }) as any,
      {}
    )
    expect(calls[0].body.deleteRecordingAfterDays).toBe(30)

    // Even a caller asking for something the vendor would refuse lands inside
    // the accepted range rather than losing the ceiling altogether.
    const { calls: direct } = fakeCloudflare(() => okResponse(liveInputResponse()))
    await cloudflareStreamProvider.createChannel("Camera Floor", {
      deleteRecordingAfterDays: 1,
    })
    expect(direct[0].body.deleteRecordingAfterDays).toBe(30)

    const { calls: ceiling } = fakeCloudflare(() => okResponse(liveInputResponse()))
    await cloudflareStreamProvider.createChannel("Camera Ceiling", {
      deleteRecordingAfterDays: 5000,
    })
    expect(ceiling[0].body.deleteRecordingAfterDays).toBe(1096)
  })

  it("creates NOTHING when the provider refuses, and repeats Cloudflare's own words", async () => {
    const before = (await channelsFor()).length
    fakeCloudflare(() =>
      okResponse(
        {
          result: null,
          success: false,
          errors: [{ code: 10000, message: "Authentication error" }],
          messages: [],
        },
        403
      )
    )

    actAs(adminId)
    const res = await channelsPost(
      jsonRequest("/api/admin/streams/channels", {
        mode: "provision",
        provider: "cloudflare",
        name: world.ctx.name("Camera Refused"),
      }) as any,
      {}
    )

    expect(res.status).toBe(502)
    const json = await res.json()
    // Cloudflare's sentence, plus the one thing it never says: what to do.
    expect(json.error).toContain("Authentication error")
    expect(json.error).toContain("Stream:Edit")
    expect(json.error).not.toContain(TOKEN)

    // The whole point of calling the vendor before writing anything.
    expect((await channelsFor()).length).toBe(before)
  })

  it("refuses before calling anyone when Cloudflare is not configured", async () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID
    delete process.env.CLOUDFLARE_STREAM_TOKEN
    const { spy } = fakeCloudflare(() => okResponse(liveInputResponse()))

    actAs(adminId)
    const res = await channelsPost(
      jsonRequest("/api/admin/streams/channels", {
        mode: "provision",
        provider: "cloudflare",
        name: world.ctx.name("Camera Unconfigured"),
      }) as any,
      {}
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe("PROVIDER_NOT_CONFIGURED")
    expect(json.error).toContain("CLOUDFLARE_ACCOUNT_ID")
    expect(json.error).toContain("CLOUDFLARE_STREAM_TOKEN")
    expect(spy).not.toHaveBeenCalled()
  })

  it("still adds a hand-entered camera exactly the way it always did", async () => {
    const { spy } = fakeCloudflare(() => okResponse(liveInputResponse()))
    const name = world.ctx.name("Camera Manual")

    actAs(adminId)
    const res = await channelsPost(
      jsonRequest("/api/admin/streams/channels", {
        name,
        ingestUrl: "rtmp://ingest.stream-test.local/live",
        streamKey: "sk-manual-camera",
        playbackUrl: "https://cdn.stream-test.local/manual/index.m3u8",
        provider: "MediaMTX",
      }) as any,
      {}
    )
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.provisioned).toBe(false)
    expect(json.channel.ingestUrl).toBe("rtmp://ingest.stream-test.local/live")
    expect(json.channel.streamKey).toBe("sk-manual-camera")
    expect(json.channel.provider).toBe("MediaMTX")
    expect(json.channel.externalId).toBeNull()
    // No `mode` in the body and no vendor was contacted.
    expect(spy).not.toHaveBeenCalled()
  })

  it("accepts a custom camera that has nothing but a playback URL", async () => {
    actAs(adminId)
    const res = await channelsPost(
      jsonRequest("/api/admin/streams/channels", {
        mode: "manual",
        name: world.ctx.name("Camera PlaybackOnly"),
        playbackUrl: "https://cdn.stream-test.local/playback-only/index.m3u8",
      }) as any,
      {}
    )
    expect(res.status).toBe(201)
    const json = await res.json()
    // The owner's ruling: playback is the only address that is required.
    expect(json.channel.ingestUrl).toBeNull()
    expect(json.channel.streamKey).toBeNull()

    // A camera with no playback URL is still refused — it could never work.
    const refused = await channelsPost(
      jsonRequest("/api/admin/streams/channels", {
        mode: "manual",
        name: world.ctx.name("Camera Nothing"),
      }) as any,
      {}
    )
    expect(refused.status).toBe(400)
  })

  it("tells the form which providers this server can actually use", async () => {
    actAs(adminId)
    const configured = await providersGet(
      new NextRequest("http://localhost:3000/api/admin/streams/providers"),
      {}
    )
    expect(configured.status).toBe(200)
    const list = (await configured.json()).providers as any[]

    const cloudflare = list.find((p) => p.id === "cloudflare")
    expect(cloudflare).toMatchObject({ configured: true, canProvision: true, missing: null })

    // Custom is always there, whatever any vendor's env looks like.
    const manual = list.find((p) => p.id === "manual")
    expect(manual).toMatchObject({ configured: true, canProvision: false })

    // Unset the env and the same route says what is missing, by name.
    delete process.env.CLOUDFLARE_ACCOUNT_ID
    delete process.env.CLOUDFLARE_STREAM_TOKEN
    const unconfigured = await providersGet(
      new NextRequest("http://localhost:3000/api/admin/streams/providers"),
      {}
    )
    const after = (await unconfigured.json()).providers as any[]
    const offline = after.find((p) => p.id === "cloudflare")
    expect(offline.configured).toBe(false)
    expect(offline.missing).toContain("CLOUDFLARE_ACCOUNT_ID")
    expect(offline.missing).toContain("CLOUDFLARE_STREAM_TOKEN")
    // Never the values, only the names.
    expect(JSON.stringify(after)).not.toContain(TOKEN)
    expect(after.find((p) => p.id === "manual").configured).toBe(true)
  })

  it("lets nobody but a platform admin create or even ask", async () => {
    const before = (await channelsFor()).length
    const { spy } = fakeCloudflare(() => okResponse(liveInputResponse()))

    actAs(outsiderId)
    const post = await channelsPost(
      jsonRequest("/api/admin/streams/channels", {
        mode: "provision",
        provider: "cloudflare",
        name: world.ctx.name("Camera Forbidden"),
      }) as any,
      {}
    )
    expect(post.status).toBe(403)

    const providers = await providersGet(
      new NextRequest("http://localhost:3000/api/admin/streams/providers"),
      {}
    )
    expect(providers.status).toBe(403)

    expect(spy).not.toHaveBeenCalled()
    expect((await channelsFor()).length).toBe(before)
  })
})
