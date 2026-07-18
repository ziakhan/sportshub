import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { createWithdrawalRequest, listWithdrawalRequests } from "@/lib/withdrawals/requests"

export const dynamic = "force-dynamic"

const createSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("CLUB_FROM_LEAGUE"),
    submissionId: z.string().min(1),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    type: z.literal("PLAYER_FROM_TEAM"),
    playerId: z.string().min(1),
    teamId: z.string().min(1),
    reason: z.string().trim().min(3).max(500),
  }),
])

/**
 * POST /api/withdrawal-requests — a club asks out of a league season, or a
 * parent asks a child's release from a roster. The other party approves.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    const result = await createWithdrawalRequest({ userId: auth.userId, ...parsed.data })
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    }
    return NextResponse.json({ success: true, requestId: result.requestId }, { status: 201 })
  } catch (error) {
    console.error("Create withdrawal request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** GET /api/withdrawal-requests — { made, toDecide } for the caller. */
export async function GET() {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const data = await listWithdrawalRequests(auth.userId, auth.isPlatformAdmin)
    return NextResponse.json(data)
  } catch (error) {
    console.error("List withdrawal requests error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
