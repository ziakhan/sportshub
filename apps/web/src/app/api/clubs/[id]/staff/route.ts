import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { sendStaffInviteEmail } from "@/lib/email"

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(["ClubManager", "Staff", "TeamManager"]),
  teamId: z.string().uuid().optional(),
  message: z.string().max(500).optional(),
})

async function verifyClubAccess(userId: string, tenantId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      roles: {
        where: {
          OR: [
            { tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
            { role: "PlatformAdmin" },
          ],
        },
      },
    },
  })

  if (!user || user.roles.length === 0) return null
  return user
}

/**
 * List club staff + pending invitations
 * GET /api/clubs/[id]/staff
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const user = await verifyClubAccess(userId, params.id)
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [staff, invitations] = await Promise.all([
    prisma.userRole.findMany({
      where: {
        tenantId: params.id,
        role: { in: ["ClubOwner", "ClubManager", "Staff", "TeamManager"] },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        team: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.staffInvitation.findMany({
      where: {
        tenantId: params.id,
        status: "PENDING",
      },
      include: {
        invitedUser: {
          select: { firstName: true, lastName: true, email: true },
        },
        invitedBy: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return NextResponse.json({ staff, invitations })
}

/**
 * Invite a user to join club as staff
 * POST /api/clubs/[id]/staff
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

    const user = await verifyClubAccess(userId, params.id)
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const data = inviteSchema.parse(body)

    // Check for existing pending invitation
    const existingInvite = await prisma.staffInvitation.findFirst({
      where: {
        tenantId: params.id,
        invitedEmail: data.email,
        status: "PENDING",
      },
    })

    if (existingInvite) {
      return NextResponse.json(
        { error: "An invitation is already pending for this email" },
        { status: 409 }
      )
    }

    // Look up user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true, firstName: true, lastName: true },
    })

    // Check if already staff
    if (invitedUser) {
      const existingRole = await prisma.userRole.findFirst({
        where: {
          userId: invitedUser.id,
          tenantId: params.id,
          role: { in: ["ClubOwner", "ClubManager", "Staff", "TeamManager"] },
        },
      })

      if (existingRole) {
        return NextResponse.json(
          { error: "This user is already a staff member" },
          { status: 409 }
        )
      }
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: params.id },
      select: { name: true },
    })

    // Create invitation
    const invitation = await prisma.staffInvitation.create({
      data: {
        tenantId: params.id,
        invitedById: user.id,
        invitedUserId: invitedUser?.id || null,
        invitedEmail: data.email,
        role: data.role,
        teamId: data.teamId || null,
        message: data.message || null,
        type: "INVITE",
      },
    })

    // Send invitation email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const inviteLink = invitedUser
      ? `${appUrl}/notifications`
      : `${appUrl}/auth/signup?invite=${invitation.id}`
    try {
      await sendStaffInviteEmail({
        to: data.email,
        clubName: tenant?.name || "A club",
        role: data.role,
        inviterName: `${user.firstName} ${user.lastName}`.trim(),
        inviteLink,
        message: data.message,
      })
    } catch (emailError) {
      console.error("Failed to send invite email:", emailError)
    }

    // Create notification for the invited user (if they exist)
    if (invitedUser) {
      await prisma.notification.create({
        data: {
          userId: invitedUser.id,
          type: "staff_invite",
          title: "Staff Invitation",
          message: `${tenant?.name || "A club"} has invited you to join as ${data.role}.`,
          link: `/notifications`,
          referenceId: invitation.id,
          referenceType: "StaffInvitation",
        },
      })
    }

    return NextResponse.json(invitation, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Staff invite error:", error)
    return NextResponse.json(
      { error: "Failed to send invitation" },
      { status: 500 }
    )
  }
}

/**
 * Remove a staff member
 * DELETE /api/clubs/[id]/staff?roleId=xxx
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    // Only ClubOwner or PlatformAdmin can remove staff
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        roles: {
          where: {
            OR: [
              { tenantId: params.id, role: "ClubOwner" },
              { role: "PlatformAdmin" },
            ],
          },
        },
      },
    })

    if (!user || user.roles.length === 0) {
      return NextResponse.json(
        { error: "Only club owners can remove staff" },
        { status: 403 }
      )
    }

    const roleId = request.nextUrl.searchParams.get("roleId")
    if (!roleId) {
      return NextResponse.json(
        { error: "roleId is required" },
        { status: 400 }
      )
    }

    const role = await prisma.userRole.findFirst({
      where: { id: roleId, tenantId: params.id },
    })

    if (!role) {
      return NextResponse.json(
        { error: "Role not found" },
        { status: 404 }
      )
    }

    // Cannot remove yourself
    if (role.userId === user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself" },
        { status: 400 }
      )
    }

    await prisma.userRole.delete({ where: { id: roleId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Remove staff error:", error)
    return NextResponse.json(
      { error: "Failed to remove staff member" },
      { status: 500 }
    )
  }
}
