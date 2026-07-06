import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
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
      select: { id: true, status: true, tryout: { select: { tenantId: true } } },
    })
    if (!signup) {
      return NextResponse.json({ error: "Signup not found" }, { status: 404 })
    }

    // Anyone running the tryout for this club can take roll call
    if (!auth.isPlatformAdmin) {
      const role = await prisma.userRole.findFirst({
        where: {
          userId: auth.userId,
          tenantId: signup.tryout.tenantId,
          role: { in: ["ClubOwner", "ClubManager", "Staff", "TeamManager"] },
        },
        select: { id: true },
      })
      if (!role) {
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
