import { NextRequest, NextResponse } from "next/server"
import { withAuth, requirePlatformAdmin } from "@/lib/api/handler"
import { describeProviders } from "@/lib/streaming/providers"

export const dynamic = "force-dynamic"

/**
 * Which streaming providers this server can actually use.
 *
 * The Add-a-camera form asks before it draws itself, so it can offer
 * "Create it for me on Cloudflare" only when that will really work, and can
 * say WHICH env vars are missing when it will not. An operator looking at a
 * disabled option with no explanation has no way forward; one who is told
 * "set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_TOKEN" does.
 *
 * `missing` names env VARS and never their values, so this route reveals
 * only whether a thing is set — which is the same thing the disabled button
 * reveals. PlatformAdmin only regardless, matching the rest of admin/streams.
 */
export const GET = withAuth<NextRequest>(async (_request, _ctx, session) => {
  requirePlatformAdmin(session)
  return NextResponse.json({ providers: describeProviders() })
})
