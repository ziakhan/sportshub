import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

const respondSchema = z.object({
  action: z.enum(["accept", "decline"]),
  role: z.enum(["ClubManager", "Staff", "TeamManager"]).optional(),
})

/**
 * Accept or decline an invitation/request
 * PATCH /api/invitations/[id]
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
    const userId = session.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = respondSchema.parse(body)

    const invitation = await prisma.staffInvitation.findUnique({
      where: { id: params.id },
      include: {
        tenant: { select: { name: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
        invitedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      )
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "This invitation has already been responded to" },
        { status: 400 }
      )
    }

    // Verify the user has permission to respond
    if (invitation.type === "INVITE") {
      // Only the invited user can accept/decline
      if (invitation.invitedUserId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else {
      // REQUEST — only club owner/manager or PlatformAdmin can accept/decline
      const hasAccess = await prisma.userRole.findFirst({
        where: {
          userId: user.id,
          OR: [
            { tenantId: invitation.tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
            { role: "PlatformAdmin" },
          ],
        },
      })

      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    if (data.action === "accept") {
      const roleToAssign = invitation.type === "REQUEST" && data.role
        ? data.role
        : invitation.role

      const targetUserId = invitation.type === "INVITE"
        ? user.id
        : invitation.invitedUserId

      if (!targetUserId) {
        return NextResponse.json(
          { error: "Cannot accept: user account not found" },
          { status: 400 }
        )
      }

      // If this is a team-scoped invitation, ensure the user also has
      // a tenant-level role so they appear as club staff and can be
      // assigned to additional teams later.
      if (invitation.teamId) {
        const existingTenantRole = await prisma.userRole.findFirst({
          where: {
            userId: targetUserId,
            tenantId: invitation.tenantId,
            role: roleToAssign as any,
            teamId: null,
          },
        })

        if (!existingTenantRole) {
          await prisma.userRole.create({
            data: {
              userId: targetUserId,
              role: roleToAssign,
              tenantId: invitation.tenantId,
              teamId: null,
              designation: null,
            },
          })
        }
      }

      // Create the (possibly team-scoped) UserRole
      await prisma.userRole.create({
        data: {
          userId: targetUserId,
          role: roleToAssign,
          tenantId: invitation.tenantId,
          teamId: invitation.teamId || null,
          designation: invitation.designation || null,
        },
      })

      // Update invitation
      await prisma.staffInvitation.update({
        where: { id: params.id },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      })

      // Notify the other party
      const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email

      if (invitation.type === "INVITE") {
        // Notify the club owner who sent the invite
        await prisma.notification.create({
          data: {
            userId: invitation.invitedById,
            type: "invite_accepted",
            title: "Invitation Accepted",
            message: `${userName} has accepted your invitation to join ${invitation.tenant.name} as ${roleToAssign}.`,
            link: `/clubs/${invitation.tenantId}/staff`,
            referenceId: invitation.id,
            referenceType: "StaffInvitation",
          },
        })
      } else {
        // Notify the user whose request was accepted
        await prisma.notification.create({
          data: {
            userId: targetUserId,
            type: "request_accepted",
            title: "Request Accepted",
            message: `Your request to join ${invitation.tenant.name} has been accepted! You've been assigned the ${roleToAssign} role.`,
            link: `/dashboard`,
            referenceId: invitation.id,
            referenceType: "StaffInvitation",
          },
        })
      }

      return NextResponse.json({ status: "accepted" })
    } else {
      // Decline
      await prisma.staffInvitation.update({
        where: { id: params.id },
        data: { status: "DECLINED", respondedAt: new Date() },
      })

      const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email

      if (invitation.type === "INVITE") {
        // Notify club owner
        await prisma.notification.create({
          data: {
            userId: invitation.invitedById,
            type: "invite_declined",
            title: "Invitation Declined",
            message: `${userName} has declined your invitation to join ${invitation.tenant.name}.`,
            link: `/clubs/${invitation.tenantId}/staff`,
            referenceId: invitation.id,
            referenceType: "StaffInvitation",
          },
        })
      } else {
        // Notify the requesting user
        if (invitation.invitedUserId) {
          await prisma.notification.create({
            data: {
              userId: invitation.invitedUserId,
              type: "request_declined",
              title: "Request Declined",
              message: `Your request to join ${invitation.tenant.name} has been declined.`,
              referenceId: invitation.id,
              referenceType: "StaffInvitation",
            },
          })
        }
      }

      return NextResponse.json({ status: "declined" })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Invitation response error:", error)
    return NextResponse.json(
      { error: "Failed to process response" },
      { status: 500 }
    )
  }
}
