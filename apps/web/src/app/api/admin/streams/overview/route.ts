import { NextRequest, NextResponse } from "next/server"
import { withAuth, requirePlatformAdmin } from "@/lib/api/handler"
import { getStreamOpsOverview } from "@/lib/streaming/ops"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/streams/overview — the Streams ops dashboard's context read.
 *
 * The channel rows themselves (including the ingest secrets) come from
 * GET /api/admin/streams/channels, which stays the single door to those. This
 * route adds everything AROUND a channel: what each rig is showing now and
 * next, where a rig can be sent, and who moved what recently.
 *
 * Split on purpose. The secrets endpoint is small and audited; this one is a
 * schedule read that will grow, and growing it must never be a way to widen
 * what the secrets endpoint returns.
 *
 * Shapes live in lib/streaming/ops.ts (StreamOpsOverview). PlatformAdmin only.
 */
export const GET = withAuth<NextRequest>(async (_request, _ctx, session) => {
  requirePlatformAdmin(session)
  return NextResponse.json(await getStreamOpsOverview())
})
