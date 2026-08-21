import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { withAuth, requirePlatformAdmin, apiError } from "@/lib/api/handler"
import { auditSafe } from "@/lib/audit"

export const dynamic = "force-dynamic"

/**
 * Stream channel CRUD — the operator's view of the camera rigs
 * (docs/roadmap/live-streaming-plan.md, phase 1).
 *
 * A channel is set up ONCE per rig and then never changes: a name matching the
 * sticker on the tripod, the vendor's fixed RTMP ingest pair, and the fixed
 * HLS playback URL. Everything dynamic (where it is sitting, what it is
 * showing) lives in lib/streaming/placement.ts.
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

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  ingestUrl: z.string().trim().min(1).max(500),
  streamKey: z.string().trim().min(1).max(500),
  playbackUrl: z.string().trim().url().max(500),
  provider: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
})

export const POST = withAuth<NextRequest>(async (request, _ctx, session) => {
  requirePlatformAdmin(session)
  const data = createSchema.parse(await request.json())

  const channel = await prisma.streamChannel.create({
    data: {
      name: data.name,
      ingestUrl: data.ingestUrl,
      streamKey: data.streamKey,
      playbackUrl: data.playbackUrl,
      provider: data.provider ?? null,
      notes: data.notes ?? null,
    },
    select: OPERATOR_SELECT,
  })

  await auditSafe({
    actorId: session.realUserId,
    actorRole: "PlatformAdmin",
    action: "STREAM_CHANNEL_CREATE",
    resource: "StreamChannel",
    resourceId: channel.id,
    // The key itself never goes in the trail — the trail is read by more
    // people than the console is.
    metadata: { name: channel.name, provider: channel.provider },
    request,
  })

  return NextResponse.json({ success: true, channel }, { status: 201 })
})

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  ingestUrl: z.string().trim().min(1).max(500).optional(),
  streamKey: z.string().trim().min(1).max(500).optional(),
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
