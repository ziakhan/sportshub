import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { ObligationError, recordOfflinePayment } from "@/lib/payments/obligations"
import { merchantAccess } from "@/lib/payments/authz"

export const dynamic = "force-dynamic"

const recordSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "ETRANSFER", "CHEQUE", "OTHER"]),
  note: z.string().max(500).optional(),
})

/**
 * Record an offline payment against an obligation — "they paid at the door".
 * POST /api/obligations/[id]/payments  { amount, method, note? }
 * Merchant-side only (payee club roles / platform admin).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = sessionInfo.userId

    const obligation = await prisma.paymentObligation.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        payeeTenantId: true,
        payeeLeagueId: true,
        payeeLeague: { select: { ownerId: true } },
      },
    })
    if (!obligation) return NextResponse.json({ error: "Obligation not found" }, { status: 404 })

    if (!(await merchantAccess(userId, obligation))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const data = recordSchema.parse(await request.json())

    const payment = await prisma.$transaction((tx: any) =>
      recordOfflinePayment(tx, {
        obligationId: params.id,
        amount: data.amount,
        method: data.method,
        recordedById: userId,
        note: data.note,
      })
    )

    return NextResponse.json(
      { success: true, id: payment.id, status: payment.status },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    if (error instanceof ObligationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    console.error("Record offline payment error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
