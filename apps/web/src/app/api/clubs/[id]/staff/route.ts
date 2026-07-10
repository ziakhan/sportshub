import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { sendStaffInviteEmail, appBaseUrl } from "@/lib/email"
import { normalizedEmailSchema } from "@/lib/validations/email"
import { notify } from "@/lib/notifications"

export const dynamic = "force-dynamic"

const inviteSchema = z.object({
  email: normalizedEmailSchema("Enter a valid email"),
  role: z.enum(["ClubManager", "Staff", "TeamManager"]),
  teamId: z.string().uuid().optional(),
  message: z.string().max(500).optional(),
})

const patchSchema = z
  .object({
    roleId: z.string().min(1),
    designation: z.enum(["HeadCoach", "AssistantCoach"]).nullable().optional(),
    role: z.enum(["Staff", "ClubManager"]).optional(),
  })
  .refine((d) => (d.designation !== undefined) !== (d.role !== undefined), {
    message: "Provide exactly one of designation or role",
  })

const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

async function verifyClubAccess(userId: string, tenantId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      roles: {
        where: {
          OR: [{ tenantId, role: { in: ["ClubOwner", "ClubManager"] } }, { role: "PlatformAdmin" }],
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
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const user = await verifyClubAccess(userId, params.id)
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Lazy expiry: stale PENDING invites flip to EXPIRED here (no cron), so the
  // pending list stays truthful and stops blocking re-invites.
  await prisma.staffInvitation.updateMany({
    where: { tenantId: params.id, status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  })

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
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
    const normalizedEmail = data.email

    // Check for existing pending invitation
    const existingInvite = await prisma.staffInvitation.findFirst({
      where: {
        tenantId: params.id,
        invitedEmail: normalizedEmail,
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
    const invitedUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
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
        return NextResponse.json({ error: "This user is already a staff member" }, { status: 409 })
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
        invitedEmail: normalizedEmail,
        role: data.role,
        teamId: data.teamId || null,
        message: data.message || null,
        type: "INVITE",
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    })

    // Send invitation email — unified public landing page handles both
    // signed-in and signed-out invitees (Gap 0.1.2 fix).
    const appUrl = appBaseUrl()
    const inviteLink = `${appUrl}/invitations/${invitation.id}/accept`
    try {
      await sendStaffInviteEmail({
        to: normalizedEmail,
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
      await notify(prisma, {
        userId: invitedUser.id,
        type: "staff_invite",
        title: "Staff Invitation",
        message: `${tenant?.name || "A club"} has invited you to join as ${data.role}.`,
        link: `/notifications`,
        referenceId: invitation.id,
        referenceType: "StaffInvitation",
      })
    }

    return NextResponse.json(invitation, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    console.error("Staff invite error:", error)
    return NextResponse.json({ error: "Failed to send invitation" }, { status: 500 })
  }
}

/**
 * Change a staff member's designation or club role IN PLACE — previously a
 * promotion (Assistant → Head Coach, Staff → Club Manager) required removing
 * and re-adding the person (editability audit §2c).
 * PATCH /api/clubs/[id]/staff  body: { roleId, designation? } | { roleId, role? }
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await verifyClubAccess(session.user.id, params.id)
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const data = patchSchema.parse(body)

    // The role row must belong to this tenant (directly, or via one of its teams).
    const roleRow = await prisma.userRole.findFirst({
      where: {
        id: data.roleId,
        OR: [{ tenantId: params.id }, { team: { tenantId: params.id } }],
      },
      select: { id: true, role: true, teamId: true, tenantId: true },
    })
    if (!roleRow) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    if (data.designation !== undefined) {
      // Designation applies to team-scoped coaching (Staff) rows only.
      if (!roleRow.teamId || roleRow.role !== "Staff") {
        return NextResponse.json(
          { error: "Designation applies to team coaching roles only" },
          { status: 400 }
        )
      }
      // One head coach per team (same rule POST /api/teams enforces).
      if (data.designation === "HeadCoach") {
        const existingHead = await prisma.userRole.findFirst({
          where: {
            teamId: roleRow.teamId,
            designation: "HeadCoach",
            id: { not: roleRow.id },
          },
        })
        if (existingHead) {
          return NextResponse.json(
            { error: "This team already has a head coach" },
            { status: 409 }
          )
        }
      }
      const updated = await prisma.userRole.update({
        where: { id: roleRow.id },
        data: { designation: data.designation },
      })
      return NextResponse.json({ success: true, role: updated })
    }

    // Club-level role change (Staff ↔ ClubManager) on tenant-scoped rows.
    if (!roleRow.tenantId || roleRow.teamId) {
      return NextResponse.json(
        { error: "Role change applies to club-level roles only" },
        { status: 400 }
      )
    }
    const updated = await prisma.userRole.update({
      where: { id: roleRow.id },
      data: { role: data.role },
    })
    return NextResponse.json({ success: true, role: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 })
    }
    console.error("Staff patch error:", error)
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 })
  }
}

/**
 * Remove a staff member
 * DELETE /api/clubs/[id]/staff?roleId=xxx          — remove one role row
 * DELETE /api/clubs/[id]/staff?userId=xxx&all=1     — remove ALL of a user's
 *   roles at this club and its teams (fixes the multi-role partial remove).
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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
            OR: [{ tenantId: params.id, role: "ClubOwner" }, { role: "PlatformAdmin" }],
          },
        },
      },
    })

    if (!user || user.roles.length === 0) {
      return NextResponse.json({ error: "Only club owners can remove staff" }, { status: 403 })
    }

    const roleId = request.nextUrl.searchParams.get("roleId")
    const targetUserId = request.nextUrl.searchParams.get("userId")
    const removeAll = request.nextUrl.searchParams.get("all") === "1"

    // Atomic full removal: every role this user holds at the club or its
    // teams. The old single-roleId path deleted only roles[0] of a multi-role
    // member, silently leaving the rest (editability audit §2c).
    if (removeAll && targetUserId) {
      if (targetUserId === user.id) {
        return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 })
      }
      const result = await prisma.userRole.deleteMany({
        where: {
          userId: targetUserId,
          role: { in: ["ClubOwner", "ClubManager", "Staff", "TeamManager"] },
          OR: [{ tenantId: params.id }, { team: { tenantId: params.id } }],
        },
      })
      if (result.count === 0) {
        return NextResponse.json({ error: "No roles found for this user" }, { status: 404 })
      }
      return NextResponse.json({ success: true, removed: result.count })
    }

    if (!roleId) {
      return NextResponse.json({ error: "roleId is required" }, { status: 400 })
    }

    const role = await prisma.userRole.findFirst({
      where: { id: roleId, tenantId: params.id },
    })

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    // Cannot remove yourself
    if (role.userId === user.id) {
      return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 })
    }

    await prisma.userRole.delete({ where: { id: roleId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Remove staff error:", error)
    return NextResponse.json({ error: "Failed to remove staff member" }, { status: 500 })
  }
}
