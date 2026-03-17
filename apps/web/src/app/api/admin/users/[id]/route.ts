import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import bcrypt from "bcryptjs"

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const role = await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: "PlatformAdmin" },
  })
  return role ? session.user.id : null
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
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
        return NextResponse.json({ success: true, message: "User suspended" })
      }

      case "reactivate": {
        await prisma.user.update({
          where: { id: userId },
          data: { status: "ACTIVE" },
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
        return NextResponse.json({ success: true, message: "Role added" })
      }

      case "removeRole": {
        if (!data.roleId) {
          return NextResponse.json({ error: "roleId is required" }, { status: 400 })
        }
        await prisma.userRole.delete({ where: { id: data.roleId } })
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
