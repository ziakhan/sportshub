import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { audit } from "@/lib/audit"
import { notify } from "@/lib/notifications"
import { withAuth, requirePlatformAdmin, apiError } from "@/lib/api/handler"
import { sendEmail, appBaseUrl, escapeHtml, transactionalFooter } from "@/lib/email"

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

    // v2 paper-proof claims have no user yet (owner 2026-07-18: anonymous
    // claim, account-at-end). Approving one issues the completion token to
    // the claimer's email — ownership binds when they register/sign in.
    if (data.action === "approve" && !claim.userId) {
      if (!claim.claimantEmail) {
        return apiError(409, "This claim has no claimer email to notify", "NO_CLAIMANT")
      }
      const { issueCompletionToken } = await import("@/lib/claims/claim-v2")
      const { token } = await issueCompletionToken(claim.id)
      await prisma.clubClaim.update({
        where: { id: claim.id },
        data: {
          reviewedById: session.realUserId,
          reviewNote: data.note || "Proof approved by admin",
          reviewedAt: new Date(),
        },
      })
      const link = `${appBaseUrl()}/claim/complete?token=${token}`
      try {
        await sendEmail({
          to: claim.claimantEmail,
          subject: `Your claim for ${claim.tenant.name} was approved — take ownership`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Proof accepted</h2>
              <p>An admin reviewed your proof for <strong>${escapeHtml(claim.tenant.name)}</strong> and approved the claim.</p>
              <p>Create an account or sign in and the club binds to your account:</p>
              <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Take ownership of ${escapeHtml(claim.tenant.name)}</a></p>
              <p>This link reserves the club for 14 days.</p>
              ${transactionalFooter()}
            </div>
          `,
          text: `Your claim for ${claim.tenant.name} was approved. Take ownership (reserved 14 days): ${link}`,
        })
      } catch (emailError) {
        console.error("Failed to send proof-approved email:", emailError)
      }
      await audit(prisma, {
        actorId: session.realUserId,
        actorRole: "PlatformAdmin",
        action: "CLAIM_APPROVE",
        resource: "ClubClaim",
        resourceId: claim.id,
        tenantId: claim.tenantId,
        changes: { status: "VERIFIED_UNBOUND", method: "PROOF" },
        metadata: { note: data.note || null },
        request,
      })
      return NextResponse.json({
        success: true,
        status: "VERIFIED_UNBOUND",
        message: "Proof approved — the claimer was emailed a link to take ownership.",
      })
    }

    if (data.action === "approve") {
      // narrowed: the unbound (userId null) case returned above
      const boundUserId = claim.userId
      const boundUser = claim.user
      if (!boundUserId || !boundUser) {
        return apiError(409, "Claim has no bound user", "NO_USER")
      }
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
          where: { userId: boundUserId, role: "ClubOwner", tenantId: claim.tenantId },
        })
        if (!existing) {
          await tx.userRole.create({
            data: {
              userId: boundUserId,
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
          changes: { status: "APPROVED", grantedRole: "ClubOwner", grantedTo: boundUserId },
          metadata: { note: data.note || null },
          request,
        })

        // Notify the user
        await notify(tx, {
          userId: boundUserId,
          type: "claim_approved",
          title: "Club Claim Approved",
          message: `Your claim for "${claim.tenant.name}" has been approved. You are now the owner!`,
          link: `/clubs/${claim.tenantId}`,
          referenceId: claim.id,
          referenceType: "ClubClaim",
        })
      })

      // Email the claimant too — claim review can take days and the bell only
      // shows on next visit. Best-effort: approval never fails on email trouble.
      try {
        const clubLink = `${appBaseUrl()}/clubs/${claim.tenantId}`
        await sendEmail({
          to: boundUser.email,
          subject: `Your claim for ${claim.tenant.name} was approved`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Claim approved</h2>
              <p>Hi ${escapeHtml(boundUser.firstName || "there")},</p>
              <p>Your claim for <strong>${escapeHtml(claim.tenant.name)}</strong> has been approved — you now manage ${escapeHtml(claim.tenant.name)} on SportsHub.</p>
              <p>
                <a href="${clubLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
                  Go to your club dashboard
                </a>
              </p>
              ${transactionalFooter()}
            </div>
          `,
        })
      } catch (emailError) {
        console.error("Failed to send claim-approved email:", emailError)
      }
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

        // Anonymous (paper-proof) claims have no account to bell — email below.
        if (claim.userId) {
          await notify(tx, {
            userId: claim.userId,
            type: "claim_rejected",
            title: "Club Claim Rejected",
            message: `Your claim for "${claim.tenant.name}" was not approved.${data.note ? ` Reason: ${data.note}` : ""}`,
            link: `/clubs/find`,
            referenceId: claim.id,
            referenceType: "ClubClaim",
          })
        }
      })
      if (!claim.userId && claim.claimantEmail) {
        try {
          await sendEmail({
            to: claim.claimantEmail,
            subject: `Your claim for ${claim.tenant.name} was not approved`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <p>An admin reviewed your proof for <strong>${escapeHtml(claim.tenant.name)}</strong> and could not approve the claim.${data.note ? ` Reason: ${escapeHtml(data.note)}` : ""}</p>
                <p>If you believe this is a mistake, reply with additional documentation.</p>
                ${transactionalFooter()}
              </div>
            `,
            text: `Your claim for ${claim.tenant.name} was not approved.${data.note ? ` Reason: ${data.note}` : ""}`,
          })
        } catch (emailError) {
          console.error("Failed to send proof-rejected email:", emailError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      action: data.action,
    })
  }
)
