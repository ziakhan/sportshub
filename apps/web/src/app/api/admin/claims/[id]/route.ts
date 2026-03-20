import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
})

/**
 * Admin: approve or reject a club claim
 * PATCH /api/admin/claims/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdmin = await prisma.userRole.findFirst({
      where: { userId: session.user.id, role: "PlatformAdmin" },
    })
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const claim = await prisma.clubClaim.findUnique({
      where: { id: params.id },
      include: {
        tenant: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    })

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    if (claim.status === "APPROVED" || claim.status === "REJECTED") {
      return NextResponse.json({ error: "This claim has already been reviewed" }, { status: 400 })
    }

    const body = await request.json()
    const data = reviewSchema.parse(body)

    if (data.action === "approve") {
      await prisma.$transaction(async (tx: any) => {
        await tx.clubClaim.update({
          where: { id: params.id },
          data: {
            status: "APPROVED",
            reviewedById: session.user!.id,
            reviewNote: data.note || "Approved by admin",
            reviewedAt: new Date(),
          },
        })

        await tx.tenant.update({
          where: { id: claim.tenantId },
          data: { status: "ACTIVE" },
        })

        // Create ClubOwner role (skip if already exists)
        const existing = await tx.userRole.findFirst({
          where: { userId: claim.userId, role: "ClubOwner", tenantId: claim.tenantId },
        })
        if (!existing) {
          await tx.userRole.create({
            data: {
              userId: claim.userId,
              role: "ClubOwner",
              tenantId: claim.tenantId,
            },
          })
        }

        // Notify the user
        await tx.notification.create({
          data: {
            userId: claim.userId,
            type: "claim_approved",
            title: "Club Claim Approved",
            message: `Your claim for "${claim.tenant.name}" has been approved. You are now the owner!`,
            link: `/clubs/${claim.tenantId}`,
            referenceId: claim.id,
            referenceType: "ClubClaim",
          },
        })
      })
    } else {
      await prisma.$transaction(async (tx: any) => {
        await tx.clubClaim.update({
          where: { id: params.id },
          data: {
            status: "REJECTED",
            reviewedById: session.user!.id,
            reviewNote: data.note || "Rejected by admin",
            reviewedAt: new Date(),
          },
        })

        await tx.notification.create({
          data: {
            userId: claim.userId,
            type: "claim_rejected",
            title: "Club Claim Rejected",
            message: `Your claim for "${claim.tenant.name}" was not approved.${data.note ? ` Reason: ${data.note}` : ""}`,
            link: `/clubs/find`,
            referenceId: claim.id,
            referenceType: "ClubClaim",
          },
        })
      })
    }

    return NextResponse.json({
      success: true,
      action: data.action,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Review claim error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
