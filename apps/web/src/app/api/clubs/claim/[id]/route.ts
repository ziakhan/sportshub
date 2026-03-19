import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const claimSchema = z.object({
  message: z.string().max(500).optional(),
})

const verifySchema = z.object({
  code: z.string().length(6),
})

/**
 * Request to claim an unclaimed club
 * POST /api/clubs/claim/[id]
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const tenant = await prisma.tenant.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, status: true, contactEmail: true },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 })
    }

    if (tenant.status !== "UNCLAIMED") {
      return NextResponse.json({ error: "This club has already been claimed" }, { status: 400 })
    }

    // Check for existing claim
    const existing = await prisma.clubClaim.findUnique({
      where: { tenantId_userId: { tenantId: params.id, userId } },
    })

    if (existing) {
      return NextResponse.json(
        { error: "You already have a claim on this club", claimStatus: existing.status },
        { status: 409 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const data = claimSchema.parse(body)

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    const claim = await prisma.clubClaim.create({
      data: {
        tenantId: params.id,
        userId,
        message: data.message || null,
        verificationCode,
        status: tenant.contactEmail ? "EMAIL_SENT" : "PENDING",
      },
    })

    // If club has an email, send verification code
    if (tenant.contactEmail) {
      try {
        const { sendEmail } = await import("@/lib/email")
        await sendEmail({
          to: tenant.contactEmail,
          subject: `Club Claim Verification - ${tenant.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Club Ownership Verification</h2>
              <p>Someone is requesting to claim <strong>${tenant.name}</strong> on Youth Basketball Hub.</p>
              <p>If you are the owner, use this verification code:</p>
              <div style="text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; background: #f5f5f5; padding: 12px 24px; border-radius: 8px;">${verificationCode}</span>
              </div>
              <p>If you did not request this, you can ignore this email.</p>
            </div>
          `,
        })

        await prisma.clubClaim.update({
          where: { id: claim.id },
          data: { verificationSentAt: new Date() },
        })
      } catch (emailErr) {
        console.error("Failed to send claim verification email:", emailErr)
        // Fall back to pending (admin approval)
        await prisma.clubClaim.update({
          where: { id: claim.id },
          data: { status: "PENDING" },
        })
      }
    }

    // Notify admins
    const admins = await prisma.userRole.findMany({
      where: { role: "PlatformAdmin" },
      select: { userId: true },
    })
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.userId,
          type: "club_claim",
          title: "New Club Claim Request",
          message: `A user has requested to claim "${tenant.name}".`,
          link: "/dashboard/admin/claims",
          referenceId: claim.id,
          referenceType: "ClubClaim",
        },
      })
    }

    return NextResponse.json({
      success: true,
      claimId: claim.id,
      status: claim.status,
      hasEmail: !!tenant.contactEmail,
      message: tenant.contactEmail
        ? "A verification code has been sent to the club's email address."
        : "Your claim has been submitted for admin review.",
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Claim club error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Verify claim with email code
 * PATCH /api/clubs/claim/[id]
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

    const body = await request.json()
    const { code } = verifySchema.parse(body)

    const claim = await prisma.clubClaim.findUnique({
      where: { tenantId_userId: { tenantId: params.id, userId: session.user.id } },
    })

    if (!claim) {
      return NextResponse.json({ error: "No claim found" }, { status: 404 })
    }

    if (claim.status !== "EMAIL_SENT") {
      return NextResponse.json({ error: "This claim is not awaiting email verification" }, { status: 400 })
    }

    if (claim.verificationCode !== code) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 })
    }

    // Verification successful — approve the claim and activate the club
    await prisma.$transaction(async (tx) => {
      await tx.clubClaim.update({
        where: { id: claim.id },
        data: {
          status: "APPROVED",
          verifiedAt: new Date(),
          reviewedAt: new Date(),
          reviewNote: "Auto-approved via email verification",
        },
      })

      await tx.tenant.update({
        where: { id: params.id },
        data: { status: "ACTIVE" },
      })

      await tx.userRole.create({
        data: {
          userId: session.user!.id,
          role: "ClubOwner",
          tenantId: params.id,
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: "Club claimed successfully! You are now the owner.",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Verify claim error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
