import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { completeClaim } from "@/lib/claims/claim-v2"

export const dynamic = "force-dynamic"

const schema = z.object({ token: z.string().min(10) })

/**
 * POST /api/clubs/claim-complete { token } — AUTHENTICATED. Redeeming the
 * completion token binds the verified claim to THIS user: club → ACTIVE,
 * ClubOwner role granted, claim-time corrections applied (owner 2026-07-18:
 * ownership is user-bound, never contact-bound; any email works).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "token required" }, { status: 400 })

    const result = await completeClaim({ token: parsed.data.token, userId: auth.userId })
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    }
    return NextResponse.json({
      success: true,
      tenantId: result.tenantId,
      tenantName: result.tenantName,
    })
  } catch (error) {
    console.error("Complete claim error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
