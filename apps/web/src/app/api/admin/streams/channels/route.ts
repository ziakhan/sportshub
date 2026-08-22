import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { withAuth, requirePlatformAdmin, apiError } from "@/lib/api/handler"
import { auditSafe } from "@/lib/audit"
import { getProvider, StreamProviderError } from "@/lib/streaming/providers"

export const dynamic = "force-dynamic"

/**
 * Stream channel CRUD — the operator's view of the camera rigs
 * (docs/roadmap/live-streaming-plan.md, phase 1).
 *
 * A channel is set up ONCE per rig and then never changes: a name matching the
 * sticker on the tripod, the fixed HLS playback URL, and — when there is one —
 * the fixed RTMP ingest pair. Everything dynamic (where it is sitting, what it
 * is showing) lives in lib/streaming/placement.ts.
 *
 * A channel gets made one of two ways:
 *
 *   mode "provision"  we call the provider (Cloudflare), it makes a live input,
 *                     and the row is built from what came back. The operator
 *                     types a name and nothing else.
 *   mode "manual"     the operator pastes what they already have. This is how
 *                     every existing channel was made and is still the default
 *                     when `mode` is absent, so old callers are untouched.
 *
 * PLAYBACK URL IS THE ONLY REQUIRED ADDRESS (owner, 2026-08-21). It is what
 * viewers play and what the signal probe reads; the ingest pair is convenience
 * for whoever sets the rig up and may be absent entirely.
 *
 * PlatformAdmin only, and deliberately so: this is the ONE place ingestUrl and
 * streamKey are served. Holding that pair means being able to push any picture
 * onto a youth game's page, so no other surface — not the scorekeeper strip,
 * not the game page, not the native app — ever reads them. The viewer path
 * (lib/queries/game-stream.ts) selects playbackUrl and nothing else.
 */

const OPERATOR_SELECT = {
  id: true,
  name: true,
  status: true,
  // Operator-only secrets. See the note above before copying this select.
  ingestUrl: true,
  streamKey: true,
  playbackUrl: true,
  provider: true,
  externalId: true,
  notes: true,
  lastSeenLiveAt: true,
  placedAt: true,
  placedById: true,
  currentCourtId: true,
  currentVenueId: true,
  currentCourt: { select: { id: true, name: true, venue: { select: { id: true, name: true } } } },
  currentVenue: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} as const

export const GET = withAuth<NextRequest>(async (_request, _ctx, session) => {
  requirePlatformAdmin(session)
  const channels = await prisma.streamChannel.findMany({
    select: OPERATOR_SELECT,
    orderBy: [{ name: "asc" }],
  })
  return NextResponse.json({ channels })
})

/** An empty optional string means "not given", not "set it to empty". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined))

const manualSchema = z.object({
  mode: z.literal("manual").optional(),
  name: z.string().trim().min(1).max(80),
  // The one address a channel cannot work without.
  playbackUrl: z.string().trim().url().max(500),
  // Convenience for whoever sets the rig up. Optional by owner ruling.
  ingestUrl: optionalText(500),
  streamKey: optionalText(500),
  provider: optionalText(80),
  notes: optionalText(2000),
})

const provisionSchema = z.object({
  mode: z.literal("provision"),
  provider: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  /** Off by default: recordings are stored and billed until deleted. */
  recording: z.enum(["off", "automatic"]).optional(),
  notes: optionalText(2000),
})

export const POST = withAuth<NextRequest>(async (request, _ctx, session) => {
  requirePlatformAdmin(session)
  const body = await request.json()

  const provisioning = (body as { mode?: string } | null)?.mode === "provision"

  let data: {
    name: string
    ingestUrl: string | null
    streamKey: string | null
    playbackUrl: string
    provider: string | null
    externalId: string | null
    notes: string | null
  }

  if (provisioning) {
    const input = provisionSchema.parse(body)
    const provider = getProvider(input.provider)

    if (!provider || !provider.canProvision) {
      return apiError(
        400,
        `${input.provider} cannot create cameras for you. Add this one by pasting its addresses instead.`,
        "PROVIDER_UNKNOWN"
      )
    }
    if (!provider.isConfigured()) {
      return apiError(
        400,
        provider.missingConfig() ?? `${provider.label} is not configured on this server.`,
        "PROVIDER_NOT_CONFIGURED"
      )
    }

    // THE ORDER MATTERS: the vendor call happens before any write, so a
    // refusal leaves no half-made camera behind for someone to wonder about.
    let created
    try {
      created = await provider.createChannel(input.name, { recording: input.recording ?? "off" })
    } catch (error) {
      if (error instanceof StreamProviderError) {
        return apiError(error.status, error.message, error.code)
      }
      // Never surface a raw vendor exception: it can carry a request URL.
      return apiError(
        502,
        `${provider.label} could not create the camera. Nothing was saved.`,
        "PROVIDER_ERROR"
      )
    }

    data = {
      name: input.name,
      ingestUrl: created.ingestUrl,
      streamKey: created.streamKey,
      playbackUrl: created.playbackUrl,
      provider: provider.id,
      externalId: created.externalId,
      notes: input.notes ?? null,
    }
  } else {
    const input = manualSchema.parse(body)
    data = {
      name: input.name,
      ingestUrl: input.ingestUrl ?? null,
      streamKey: input.streamKey ?? null,
      playbackUrl: input.playbackUrl,
      provider: input.provider ?? null,
      externalId: null,
      notes: input.notes ?? null,
    }
  }

  const channel = await prisma.streamChannel.create({
    data,
    select: OPERATOR_SELECT,
  })

  await auditSafe({
    actorId: session.realUserId,
    actorRole: "PlatformAdmin",
    action: "STREAM_CHANNEL_CREATE",
    resource: "StreamChannel",
    resourceId: channel.id,
    // The key itself never goes in the trail — the trail is read by more
    // people than the console is. `externalId` is not a secret: it is the
    // vendor-side id, and having it in the trail is how a camera here gets
    // matched to a live input there.
    metadata: {
      name: channel.name,
      provider: channel.provider,
      provisioned: provisioning,
      ...(channel.externalId ? { externalId: channel.externalId } : {}),
    },
    request,
  })

  return NextResponse.json({ success: true, channel, provisioned: provisioning }, { status: 201 })
})

/** Explicit null CLEARS the field; absent leaves it alone; "" means absent. */
const clearableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value))

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  ingestUrl: clearableText(500),
  streamKey: clearableText(500),
  playbackUrl: z.string().trim().url().max(500).optional(),
  provider: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  /** DISABLED takes the channel dark everywhere at once — the kill switch. */
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
})

export const PATCH = withAuth<NextRequest>(async (request, _ctx, session) => {
  requirePlatformAdmin(session)
  const { id, ...fields } = updateSchema.parse(await request.json())

  const before = await prisma.streamChannel.findUnique({
    where: { id },
    select: { id: true, name: true, status: true },
  })
  if (!before) return apiError(404, "Camera not found", "NOT_FOUND")

  const data = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined))
  if (Object.keys(data).length === 0) return apiError(400, "No fields to update", "NO_CHANGES")

  const channel = await prisma.streamChannel.update({
    where: { id },
    data: data as any,
    select: OPERATOR_SELECT,
  })

  await auditSafe({
    actorId: session.realUserId,
    actorRole: "PlatformAdmin",
    action: "STREAM_CHANNEL_UPDATE",
    resource: "StreamChannel",
    resourceId: id,
    // Which fields moved, never their values: two of them are secrets.
    changes: { fields: Object.keys(data), status: { from: before.status, to: channel.status } },
    request,
  })

  return NextResponse.json({ success: true, channel })
})
