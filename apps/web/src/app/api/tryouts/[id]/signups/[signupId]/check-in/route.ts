import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { isClubAdmin, canActOnTeam } from "@/lib/authz/team-scope"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * Tryout-day roll-call: mark a signup arrived (or clear a mis-tap).
 * POST /api/tryouts/[id]/signups/[signupId]/check-in  { checkedIn: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; signupId: string } }
) {
  try {
    const auth = await getSessionUserId()
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body.checkedIn !== "boolean") {
      return NextResponse.json({ error: "checkedIn (boolean) is required" }, { status: 400 })
    }

    const signup = await prisma.tryoutSignup.findFirst({
      where: { id: params.signupId, tryoutId: params.id },
      select: {
        id: true,
        status: true,
        tryout: { select: { tenantId: true, teamId: true } },
      },
    })
    if (!signup) {
      return NextResponse.json({ error: "Signup not found" }, { status: 404 })
    }

    // Roll call: club admins always; coaches only for THEIR team's tryout
    // (security fix 2026-07-20 — was any tenant Staff, club-wide). Club-wide
    // tryouts (no team) stay admin-run.
    if (!auth.isPlatformAdmin) {
      const allowed = signup.tryout.teamId
        ? await canActOnTeam(auth.userId, signup.tryout.tenantId, signup.tryout.teamId)
        : await isClubAdmin(auth.userId, signup.tryout.tenantId)
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    if (signup.status === "CANCELLED") {
      return NextResponse.json({ error: "Signup is cancelled" }, { status: 400 })
    }

    const updated = await prisma.tryoutSignup.update({
      where: { id: signup.id },
      data: { checkedInAt: body.checkedIn ? new Date() : null },
      select: { id: true, checkedInAt: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Tryout check-in error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
