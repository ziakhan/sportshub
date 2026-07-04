import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { ObligationError, waiveObligation } from "@/lib/payments/obligations"

export const dynamic = "force-dynamic"

const actionSchema = z.object({
  action: z.literal("waive"),
  reason: z.string().max(500).optional(),
})

/**
 * Merchant actions on an obligation.
 * PATCH /api/obligations/[id]  { action: "waive", reason? }
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = sessionInfo.userId

    const obligation = await prisma.paymentObligation.findUnique({
      where: { id: params.id },
      select: { id: true, payeeTenantId: true },
    })
    if (!obligation) return NextResponse.json({ error: "Obligation not found" }, { status: 404 })

    const hasAccess = await prisma.userRole.findFirst({
      where: {
        userId,
        OR: [
          ...(obligation.payeeTenantId
            ? [
                {
                  tenantId: obligation.payeeTenantId,
                  role: { in: ["ClubOwner", "ClubManager"] as any },
                },
              ]
            : []),
          { role: "PlatformAdmin" as any },
        ],
      },
    })
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const data = actionSchema.parse(await request.json())

    const updated = await waiveObligation(prisma, {
      obligationId: params.id,
      reason: data.reason,
    })
    return NextResponse.json({ status: updated.status })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    if (error instanceof ObligationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    console.error("Obligation action error:", error)
    return NextResponse.json({ error: "Failed to update obligation" }, { status: 500 })
  }
}
