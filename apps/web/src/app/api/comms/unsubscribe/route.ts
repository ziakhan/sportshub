import { NextRequest, NextResponse } from "next/server"
import { verifyUnsubscribeToken } from "@/lib/comms/unsubscribe"
import { withdrawConsent } from "@/lib/comms/consent"

export const dynamic = "force-dynamic"

/**
 * GET /api/comms/unsubscribe?token=... — one-click, no-login opt-out from a
 * marketing-email footer (CASL). Withdraws the org-scoped consent the token
 * was minted for and redirects to a friendly confirmation.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  const payload = token ? verifyUnsubscribeToken(token) : null
  if (!payload) {
    return NextResponse.redirect(new URL("/unsubscribed?status=invalid", request.url))
  }
  try {
    await withdrawConsent(payload.userId, payload.scope, payload.orgId, "unsubscribe-link")
  } catch (error) {
    console.error("Unsubscribe error:", error)
    return NextResponse.redirect(new URL("/unsubscribed?status=error", request.url))
  }
  return NextResponse.redirect(new URL("/unsubscribed?status=ok", request.url))
}
