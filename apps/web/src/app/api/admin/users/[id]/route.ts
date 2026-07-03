import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { auditSafe } from "@/lib/audit"
import bcrypt from "bcryptjs"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

async function requireAdmin() {
  // Impersonation-aware: returns the REAL admin account id (audit-correct
  // even while the admin is impersonating another user).
  const session = await getSessionUserId()
  if (!session?.isPlatformAdmin) return null
  return session.realUserId
}

const updateUserSchema = z.object({
  action: z.enum(["suspend", "reactivate", "resetPassword", "addRole", "removeRole"]),
  // For addRole
  role: z.string().optional(),
  tenantId: z.string().uuid().optional(),
  // For removeRole
  roleId: z.string().uuid().optional(),
})

/**
 * PATCH /api/admin/users/[id] — Admin actions on a user
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const adminId = await requireAdmin()
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const data = updateUserSchema.parse(body)
    const userId = params.id

    // Prevent self-suspension
    if (data.action === "suspend" && userId === adminId) {
      return NextResponse.json({ error: "Cannot suspend yourself" }, { status: 400 })
    }

    switch (data.action) {
      case "suspend": {
        await prisma.user.update({
          where: { id: userId },
          data: { status: "SUSPENDED" },
        })
        await auditSafe({
          actorId: adminId,
          actorRole: "PlatformAdmin",
          action: "USER_STATUS_CHANGE",
          resource: "User",
          resourceId: userId,
          changes: { status: "SUSPENDED" },
          request,
        })
        return NextResponse.json({ success: true, message: "User suspended" })
      }

      case "reactivate": {
        await prisma.user.update({
          where: { id: userId },
          data: { status: "ACTIVE" },
        })
        await auditSafe({
          actorId: adminId,
          actorRole: "PlatformAdmin",
          action: "USER_STATUS_CHANGE",
          resource: "User",
          resourceId: userId,
          changes: { status: "ACTIVE" },
          request,
        })
        return NextResponse.json({ success: true, message: "User reactivated" })
      }

      case "resetPassword": {
        const tempPassword = "TempPass123!"
        const hash = await bcrypt.hash(tempPassword, 12)
        await prisma.user.update({
          where: { id: userId },
          data: { passwordHash: hash },
        })
        await auditSafe({
          actorId: adminId,
          actorRole: "PlatformAdmin",
          action: "USER_UPDATE",
          resource: "User",
          resourceId: userId,
          changes: { field: "passwordHash" },
          request,
        })
        return NextResponse.json({
          success: true,
          message: "Password reset",
          tempPassword,
        })
      }

      case "addRole": {
        if (!data.role) {
          return NextResponse.json({ error: "role is required" }, { status: 400 })
        }
        await prisma.userRole.create({
          data: {
            userId,
            role: data.role as any,
            tenantId: data.tenantId || null,
          },
        })
        await auditSafe({
          actorId: adminId,
          actorRole: "PlatformAdmin",
          action: "ROLE_GRANT",
          resource: "User",
          resourceId: userId,
          changes: { role: data.role, tenantId: data.tenantId || null },
          request,
        })
        return NextResponse.json({ success: true, message: "Role added" })
      }

      case "removeRole": {
        if (!data.roleId) {
          return NextResponse.json({ error: "roleId is required" }, { status: 400 })
        }
        await prisma.userRole.delete({ where: { id: data.roleId } })
        await auditSafe({
          actorId: adminId,
          actorRole: "PlatformAdmin",
          action: "ROLE_REVOKE",
          resource: "User",
          resourceId: userId,
          changes: { roleId: data.roleId },
          request,
        })
        return NextResponse.json({ success: true, message: "Role removed" })
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    console.error("Admin user action error:", error)
    return NextResponse.json({ error: "Failed to perform action" }, { status: 500 })
  }
}
