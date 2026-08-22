import { NextRequest, NextResponse } from "next/server"
import { withAuth, requirePlatformAdmin } from "@/lib/api/handler"
import { probeChannels, SIGNAL_FRESH_MS } from "@/lib/streaming/health"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/streams/health — "which rigs are actually pushing a picture?"
 * (docs/roadmap/live-streaming-plan.md, phase 2: health probe.)
 *
 * Probes every ACTIVE channel's HLS manifest and stamps `lastSeenLiveAt` on the
 * ones that answered. Called by the Streams ops dashboard on load and behind
 * its "Check signal" button; `?channelId=` probes one rig, which is what a
 * single card's re-check uses.
 *
 * Response:
 *   {
 *     checkedAt: string,          // ISO, when this sweep ran
 *     freshMs: number,            // how long a stamp stays green
 *     channels: [{
 *       id: string,
 *       name: string,
 *       live: boolean,            // this probe saw a running manifest
 *       state: "live"|"idle"|"fault",  // idle = the address answered, nobody
 *                                 // is broadcasting on it. A normal state,
 *                                 // and NOT the same as a fault.
 *       checkedAt: string,
 *       lastSeenLiveAt: string|null,
 *       detail: string|null       // why not live, in operator words
 *     }]
 *   }
 *
 * PlatformAdmin only. Not because the answer is a secret — it is a boolean per
 * camera — but because the probe makes the server fetch an arbitrary stored URL
 * N times, and that is not a button to leave lying around.
 *
 * Deliberately not on a schedule yet: cron wiring is deploy-time work and this
 * lane is local only. The route to add later is
 * `apps/web/src/app/api/cron/stream-health/route.ts`, calling probeChannels()
 * behind isAuthorizedCron, on roughly a 60s cadence during game hours.
 */
export const GET = withAuth<NextRequest>(async (request, _ctx, session) => {
  requirePlatformAdmin(session)

  const channelId = new URL(request.url).searchParams.get("channelId")
  const channels = await probeChannels({ channelIds: channelId ? [channelId] : undefined })

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    freshMs: SIGNAL_FRESH_MS,
    channels,
  })
})
