import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

const requestSchema = z.object({
  role: z.enum(["ClubManager", "Staff"]),
  message: z.string().max(500).optional(),
})

/**
 * User requests to join a club as staff
 * POST /api/clubs/[id]/staff/requests
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = requestSchema.parse(body)

    // Check already staff
    const existingRole = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        tenantId: params.id,
        role: { in: ["ClubOwner", "ClubManager", "Staff"] },
      },
    })

    if (existingRole) {
      return NextResponse.json(
        { error: "You are already a staff member of this club" },
        { status: 409 }
      )
    }

    // Check existing pending request
    const existingRequest = await prisma.staffInvitation.findFirst({
      where: {
        tenantId: params.id,
        invitedUserId: user.id,
        type: "REQUEST",
        status: "PENDING",
      },
    })

    if (existingRequest) {
      return NextResponse.json(
        { error: "You already have a pending request for this club" },
        { status: 409 }
      )
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: params.id },
      select: { name: true },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 })
    }

    // Create request
    const invitation = await prisma.staffInvitation.create({
      data: {
        tenantId: params.id,
        invitedById: user.id,
        invitedUserId: user.id,
        invitedEmail: user.email,
        role: data.role,
        message: data.message || null,
        type: "REQUEST",
      },
    })

    // Notify all club owners
    const clubOwners = await prisma.userRole.findMany({
      where: { tenantId: params.id, role: "ClubOwner" },
      select: { userId: true },
    })

    const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email

    await prisma.notification.createMany({
      data: clubOwners.map((owner) => ({
        userId: owner.userId,
        type: "staff_request",
        title: "Staff Request",
        message: `${userName} has requested to join ${tenant.name} as ${data.role}.`,
        link: `/clubs/${params.id}/staff`,
        referenceId: invitation.id,
        referenceType: "StaffInvitation",
      })),
    })

    return NextResponse.json(invitation, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Staff request error:", error)
    return NextResponse.json(
      { error: "Failed to send request" },
      { status: 500 }
    )
  }
}
