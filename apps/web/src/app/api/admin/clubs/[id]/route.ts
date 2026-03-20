import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const role = await prisma.userRole.findFirst({
    where: { userId: session.user.id, role: "PlatformAdmin" },
  })
  return role ? session.user.id : null
}

const updateClubSchema = z.object({
  action: z.enum(["suspend", "reactivate", "changePlan", "transferOwnership"]),
  plan: z.enum(["FREE", "BASIC", "PRO", "ENTERPRISE"]).optional(),
  newOwnerEmail: z.string().email().optional(),
})

/**
 * PATCH /api/admin/clubs/[id] — Admin actions on a club
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
    const data = updateClubSchema.parse(body)
    const clubId = params.id

    switch (data.action) {
      case "suspend": {
        await prisma.tenant.update({
          where: { id: clubId },
          data: { status: "SUSPENDED" },
        })
        return NextResponse.json({ success: true, message: "Club suspended" })
      }

      case "reactivate": {
        await prisma.tenant.update({
          where: { id: clubId },
          data: { status: "ACTIVE" },
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
        return NextResponse.json({ success: true, message: `Plan changed to ${data.plan}` })
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
