import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { audit, auditSafe } from "@/lib/audit"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

async function requireAdmin() {
  // Impersonation-aware: returns the REAL admin account id (audit-correct
  // even while the admin is impersonating another user).
  const session = await getSessionUserId()
  if (!session?.isPlatformAdmin) return null
  return session.realUserId
}

const updateClubSchema = z.object({
  action: z.enum(["suspend", "reactivate", "changePlan", "transferOwnership", "setFeatured"]),
  plan: z.enum(["FREE", "BASIC", "PRO", "ENTERPRISE"]).optional(),
  newOwnerEmail: z.string().email().optional(),
  featured: z.boolean().optional(),
})

/**
 * PATCH /api/admin/clubs/[id] — Admin actions on a club
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const adminId = await requireAdmin()
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const data = updateClubSchema.parse(body)
    const clubId = params.id

    switch (data.action) {
      case "suspend": {
        await prisma.tenant.update({
          where: { id: clubId },
          data: { status: "SUSPENDED" },
        })
        await auditSafe({
          actorId: adminId,
          actorRole: "PlatformAdmin",
          action: "CLUB_SUSPEND",
          resource: "Tenant",
          resourceId: clubId,
          tenantId: clubId,
          request,
        })
        return NextResponse.json({ success: true, message: "Club suspended" })
      }

      case "reactivate": {
        await prisma.tenant.update({
          where: { id: clubId },
          data: { status: "ACTIVE" },
        })
        await auditSafe({
          actorId: adminId,
          actorRole: "PlatformAdmin",
          action: "CLUB_REACTIVATE",
          resource: "Tenant",
          resourceId: clubId,
          tenantId: clubId,
          request,
        })
        return NextResponse.json({ success: true, message: "Club reactivated" })
      }

      case "changePlan": {
        if (!data.plan) {
          return NextResponse.json({ error: "plan is required" }, { status: 400 })
        }
        await prisma.tenant.update({
          where: { id: clubId },
          data: { plan: data.plan },
        })
        await auditSafe({
          actorId: adminId,
          actorRole: "PlatformAdmin",
          action: "CLUB_PLAN_CHANGE",
          resource: "Tenant",
          resourceId: clubId,
          tenantId: clubId,
          changes: { plan: data.plan },
          request,
        })
        return NextResponse.json({ success: true, message: `Plan changed to ${data.plan}` })
      }

      case "setFeatured": {
        if (typeof data.featured !== "boolean") {
          return NextResponse.json({ error: "featured is required" }, { status: 400 })
        }
        await prisma.tenant.update({
          where: { id: clubId },
          data: { isFeatured: data.featured },
        })
        await auditSafe({
          actorId: adminId,
          actorRole: "PlatformAdmin",
          action: data.featured ? "CLUB_FEATURE" : "CLUB_UNFEATURE",
          resource: "Tenant",
          resourceId: clubId,
          tenantId: clubId,
          request,
        })
        return NextResponse.json({
          success: true,
          message: data.featured ? "Club is now featured" : "Club removed from featured",
        })
      }

      case "transferOwnership": {
        if (!data.newOwnerEmail) {
          return NextResponse.json({ error: "newOwnerEmail is required" }, { status: 400 })
        }

        const newOwner = await prisma.user.findUnique({
          where: { email: data.newOwnerEmail },
          select: { id: true },
        })
        if (!newOwner) {
          return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        await prisma.$transaction(async (tx: any) => {
          // Remove old owner role
          await tx.userRole.deleteMany({
            where: { tenantId: clubId, role: "ClubOwner" },
          })
          // Assign new owner
          await tx.userRole.create({
            data: {
              userId: newOwner.id,
              role: "ClubOwner",
              tenantId: clubId,
            },
          })

          await audit(tx, {
            actorId: adminId,
            actorRole: "PlatformAdmin",
            action: "CLUB_OWNERSHIP_TRANSFER",
            resource: "Tenant",
            resourceId: clubId,
            tenantId: clubId,
            changes: { newOwnerId: newOwner.id, newOwnerEmail: data.newOwnerEmail },
            request,
          })
        })
        return NextResponse.json({ success: true, message: "Ownership transferred" })
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    console.error("Admin club action error:", error)
    return NextResponse.json({ error: "Failed to perform action" }, { status: 500 })
  }
}
