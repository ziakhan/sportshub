import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { audit } from "@/lib/audit"
import { notify } from "@/lib/notifications"
import { withAuth, requirePlatformAdmin, apiError } from "@/lib/api/handler"

export const dynamic = "force-dynamic"

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
})

/**
 * Admin: approve or reject a club claim
 * PATCH /api/admin/claims/[id]
 *
 * Exemplar for the withAuth wrapper pattern: session resolution, zod-error
 * and error-envelope handling live in the wrapper; the handler only holds
 * business logic + explicit scope checks.
 */
export const PATCH = withAuth<NextRequest, { params: { id: string } }>(
  async (request, { params }, session) => {
    requirePlatformAdmin(session)

    const claim = await prisma.clubClaim.findUnique({
      where: { id: params.id },
      include: {
        tenant: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    })

    if (!claim) {
      return apiError(404, "Claim not found", "NOT_FOUND")
    }

    if (claim.status === "APPROVED" || claim.status === "REJECTED") {
      return apiError(400, "This claim has already been reviewed", "ALREADY_REVIEWED")
    }

    const body = await request.json()
    const data = reviewSchema.parse(body)

    if (data.action === "approve") {
      await prisma.$transaction(async (tx: any) => {
        await tx.clubClaim.update({
          where: { id: params.id },
          data: {
            status: "APPROVED",
            reviewedById: session.realUserId,
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

        await audit(tx, {
          actorId: session.realUserId,
          actorRole: "PlatformAdmin",
          action: "CLAIM_APPROVE",
          resource: "ClubClaim",
          resourceId: claim.id,
          tenantId: claim.tenantId,
          changes: { status: "APPROVED", grantedRole: "ClubOwner", grantedTo: claim.userId },
          metadata: { note: data.note || null },
          request,
        })

        // Notify the user
        await notify(tx, {
          userId: claim.userId,
          type: "claim_approved",
          title: "Club Claim Approved",
          message: `Your claim for "${claim.tenant.name}" has been approved. You are now the owner!`,
          link: `/clubs/${claim.tenantId}`,
          referenceId: claim.id,
          referenceType: "ClubClaim",
        })
      })
    } else {
      await prisma.$transaction(async (tx: any) => {
        await tx.clubClaim.update({
          where: { id: params.id },
          data: {
            status: "REJECTED",
            reviewedById: session.realUserId,
            reviewNote: data.note || "Rejected by admin",
            reviewedAt: new Date(),
          },
        })

        await audit(tx, {
          actorId: session.realUserId,
          actorRole: "PlatformAdmin",
          action: "CLAIM_REJECT",
          resource: "ClubClaim",
          resourceId: claim.id,
          tenantId: claim.tenantId,
          metadata: { note: data.note || null },
          request,
        })

        await notify(tx, {
          userId: claim.userId,
          type: "claim_rejected",
          title: "Club Claim Rejected",
          message: `Your claim for "${claim.tenant.name}" was not approved.${data.note ? ` Reason: ${data.note}` : ""}`,
          link: `/clubs/find`,
          referenceId: claim.id,
          referenceType: "ClubClaim",
        })
      })
    }

    return NextResponse.json({
      success: true,
      action: data.action,
    })
  }
)
