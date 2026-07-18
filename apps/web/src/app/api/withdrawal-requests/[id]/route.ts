import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { decideWithdrawalRequest } from "@/lib/withdrawals/requests"

export const dynamic = "force-dynamic"

const decideSchema = z.object({
  action: z.enum(["approve", "decline", "cancel"]),
  note: z.string().trim().max(500).optional(),
})

/**
 * PATCH /api/withdrawal-requests/[id] { action, note? }
 * approve/decline — the OTHER party (league side for club withdrawals, club
 * side for player releases). Approval executes the withdrawal atomically.
 * cancel — the requester taking their request back while PENDING.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = decideSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: "action must be approve, decline or cancel" },
        { status: 400 }
      )
    }

    const result = await decideWithdrawalRequest({
      requestId: params.id,
      userId: auth.userId,
      isPlatformAdmin: auth.isPlatformAdmin,
      action: parsed.data.action,
      note: parsed.data.note,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    }
    return NextResponse.json({ success: true, status: result.status, cancelledGames: result.cancelledGames })
  } catch (error) {
    console.error("Decide withdrawal request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
