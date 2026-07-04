import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { normalizedEmailSchema } from "@/lib/validations/email"
import { notifyBatch } from "@/lib/notifications"

const signupSchema = z.object({
  email: normalizedEmailSchema("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = signupSchema.parse(body)
    const normalizedEmail = data.email

    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(data.password, 12)

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        status: "ACTIVE",
      },
    })

    // Attach any pending StaffInvitations sent to this email so the new user
    // can find and accept them. Without this, invitations to fresh emails
    // sit with invitedUserId=null and the accept PATCH rejects with 403.
    const pendingInvites = await prisma.staffInvitation.findMany({
      where: {
        invitedEmail: { equals: normalizedEmail, mode: "insensitive" },
        invitedUserId: null,
        status: "PENDING",
      },
      select: { id: true, tenantId: true, role: true },
    })

    if (pendingInvites.length > 0) {
      await prisma.staffInvitation.updateMany({
        where: { id: { in: pendingInvites.map((i) => i.id) } },
        data: { invitedUserId: user.id },
      })
      // Surface them via the standard notification bell so the user sees
      // them on first dashboard load.
      const tenants = await prisma.tenant.findMany({
        where: { id: { in: pendingInvites.map((i) => i.tenantId) } },
        select: { id: true, name: true },
      })
      const tenantNameById = new Map(tenants.map((t) => [t.id, t.name]))
      await notifyBatch(
        prisma,
        pendingInvites.map((inv) => ({
          userId: user.id,
          type: "staff_invite" as const,
          title: "Staff Invitation",
          message: `${tenantNameById.get(inv.tenantId) || "A club"} has invited you to join as ${inv.role}.`,
          link: "/notifications",
          referenceId: inv.id,
          referenceType: "StaffInvitation",
        }))
      )
    }

    // Same auto-attach for PlayerInvitations (Gap G3): a club invited this
    // email before the account existed; attach so the new user (parent or
    // 13+ player) can accept and receive the offer.
    const pendingPlayerInvites = await prisma.playerInvitation.findMany({
      where: {
        invitedEmail: { equals: normalizedEmail, mode: "insensitive" },
        invitedUserId: null,
        status: "PENDING",
      },
      select: {
        id: true,
        playerName: true,
        tenant: { select: { name: true } },
        team: { select: { name: true } },
      },
    })

    if (pendingPlayerInvites.length > 0) {
      await prisma.playerInvitation.updateMany({
        where: { id: { in: pendingPlayerInvites.map((i) => i.id) } },
        data: { invitedUserId: user.id },
      })
      await notifyBatch(
        prisma,
        pendingPlayerInvites.map((inv) => ({
          userId: user.id,
          type: "player_invite" as const,
          title: "Player Invitation",
          message: `${inv.tenant.name} has invited ${inv.playerName || "a player in your family"} to join ${inv.team.name}.`,
          link: "/notifications",
          referenceId: inv.id,
          referenceType: "PlayerInvitation",
        }))
      )
    }

    return NextResponse.json({
      success: true,
      pendingInvitations: pendingInvites.length,
      pendingPlayerInvitations: pendingPlayerInvites.length,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error("Signup error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
