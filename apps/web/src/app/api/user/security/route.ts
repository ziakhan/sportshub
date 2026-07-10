// Account security actions for the signed-in user: change password, change
// email, delete account (soft delete). Every action re-verifies the CURRENT
// password — a stolen session alone can't take over or destroy the account.

import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import { normalizedEmailSchema } from "@/lib/validations/email"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { z } from "zod"

export const dynamic = "force-dynamic"

const securitySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("changePassword"),
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
  }),
  z.object({
    action: z.literal("changeEmail"),
    currentPassword: z.string().min(1, "Current password is required"),
    newEmail: normalizedEmailSchema("Invalid email address"),
  }),
  z.object({
    action: z.literal("deleteAccount"),
    currentPassword: z.string().min(1, "Current password is required"),
  }),
])

export async function PATCH(req: Request) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const body = await req.json()
    const data = securitySchema.parse(body)

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Every security action requires the current password.
    const passwordValid = await bcrypt.compare(data.currentPassword, user.passwordHash)
    if (!passwordValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 })
    }

    if (data.action === "changePassword") {
      const passwordHash = await bcrypt.hash(data.newPassword, 12)
      await prisma.user.update({ where: { id: userId }, data: { passwordHash } })
      return NextResponse.json({ success: true })
    }

    if (data.action === "changeEmail") {
      const newEmail = data.newEmail

      const existing = await prisma.user.findFirst({
        where: {
          email: { equals: newEmail, mode: "insensitive" },
          id: { not: userId },
        },
        select: { id: true },
      })
      if (existing) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        )
      }

      await prisma.user.update({ where: { id: userId }, data: { email: newEmail } })
      return NextResponse.json({
        success: true,
        email: newEmail,
        message: "Email updated. Use your new email address the next time you sign in.",
      })
    }

    // action === "deleteAccount"
    // Guard 1: any of their players still ACTIVE on a team roster.
    const activeRosterSpot = await prisma.teamPlayer.findFirst({
      where: {
        status: "ACTIVE",
        player: { parentId: userId, deletedAt: null },
      },
      select: { id: true },
    })
    if (activeRosterSpot) {
      return NextResponse.json(
        {
          error:
            "One of your players is still active on a team roster. Ask the club to release them first.",
        },
        { status: 409 }
      )
    }

    // Guard 2: sole ClubOwner of an ACTIVE tenant — the club would be orphaned.
    const ownerRoles = await prisma.userRole.findMany({
      where: { userId, role: "ClubOwner", tenant: { status: "ACTIVE" } },
      select: { tenantId: true },
    })
    const ownedTenantIds = [
      ...new Set(ownerRoles.map((r) => r.tenantId).filter((t): t is string => !!t)),
    ]
    if (ownedTenantIds.length > 0) {
      const coOwners = await prisma.userRole.findMany({
        where: {
          tenantId: { in: ownedTenantIds },
          role: "ClubOwner",
          userId: { not: userId },
          user: { status: "ACTIVE" },
        },
        select: { tenantId: true },
      })
      const covered = new Set(coOwners.map((r) => r.tenantId))
      if (ownedTenantIds.some((t) => !covered.has(t))) {
        return NextResponse.json(
          {
            error:
              "You are the sole owner of an active club. Transfer ownership first, then delete your account.",
          },
          { status: 409 }
        )
      }
    }

    // Guard 3: open payment obligations as payer.
    const openObligation = await prisma.paymentObligation.findFirst({
      where: { payerUserId: userId, status: { in: ["PENDING", "PARTIALLY_PAID"] } },
      select: { id: true },
    })
    if (openObligation) {
      return NextResponse.json(
        {
          error:
            "You have outstanding payments. Settle or resolve them with the club before deleting your account.",
        },
        { status: 409 }
      )
    }

    // Soft delete (owner decision): keep name + history visible in past
    // rosters/box scores. Scramble the email so the address is freed for
    // re-registration, and replace the password hash with a random one so the
    // account can never authenticate again (login also rejects non-ACTIVE).
    const unusableHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12)
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: "DELETED",
        deletedAt: new Date(),
        email: `deleted-${userId}@removed.invalid`,
        passwordHash: unusableHash,
      },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    // Never log the request body here — it contains passwords.
    console.error("Security action error:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
