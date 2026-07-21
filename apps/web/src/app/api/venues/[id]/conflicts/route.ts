import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { isClubAdmin } from "@/lib/authz/team-scope"
import { findVenueConflicts } from "@/lib/venues/conflicts"

export const dynamic = "force-dynamic"

/**
 * GET /api/venues/[id]/conflicts?start=<ISO>&duration=<min>&tenantId=<id>&excludeTryoutId=<id>
 *
 * Soft, non-blocking booking-overlap advisory for the venue pickers. Returns a
 * GENERIC other-org count (privacy: never names another org's booking) plus
 * same-org specifics ONLY when the caller is an admin of the tenant they
 * passed (prevents probing another club's calendar). Never blocks a save.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionUserId()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startRaw = searchParams.get("start")
    if (!startRaw) {
      return NextResponse.json({ error: "start is required" }, { status: 400 })
    }
    const startAt = new Date(startRaw)
    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json({ error: "invalid start" }, { status: 400 })
    }
    const durationMinutes = Number(searchParams.get("duration")) || 90
    const tenantId = searchParams.get("tenantId") || undefined
    const excludeTryoutId = searchParams.get("excludeTryoutId") || undefined

    const result = await findVenueConflicts({
      venueId: params.id,
      startAt,
      durationMinutes,
      tenantId,
      excludeTryoutId,
    })

    // Only echo same-org specifics if the caller actually administers that org.
    let sameOrg = result.sameOrg
    if (!tenantId || !(await isClubAdmin(session.userId, tenantId))) {
      // Demote same-org matches to the generic count so nothing leaks.
      const demoted = sameOrg.length
      sameOrg = []
      return NextResponse.json({
        sameOrg,
        otherOrgCount: result.otherOrgCount + demoted,
        hasAny: result.hasAny,
      })
    }

    return NextResponse.json({
      sameOrg,
      otherOrgCount: result.otherOrgCount,
      hasAny: result.hasAny,
    })
  } catch (error) {
    console.error("Venue conflict check error:", error)
    // Advisory only — never break the form on a check failure.
    return NextResponse.json({ sameOrg: [], otherOrgCount: 0, hasAny: false })
  }
}
