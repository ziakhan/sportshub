import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { normalizedEmailSchema } from "@/lib/validations/email"
import { notify } from "@/lib/notifications"

export const dynamic = "force-dynamic"

// How long a fresh invitation stays open when the club doesn't pick a date.
const INVITATION_EXPIRY_DAYS = 14

const createInvitationSchema = z.object({
  teamId: z.string(),
  email: normalizedEmailSchema("Invalid email address"),
  playerName: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  templateId: z.string().optional(),
  seasonFee: z.number().min(0).optional(),
  expiresAt: z.string().datetime().optional(),
})

/**
 * Invite a player by email (Gap G3).
 * POST /api/player-invitations
 *
 * The invitation is addressed to an email: if an account already exists it
 * attaches immediately (F8); otherwise the signup route auto-attaches it when
 * the recipient registers (F6/F7). Accepting converts it into an Offer.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const body = await request.json()
    const data = createInvitationSchema.parse(body)

    const team = await prisma.team.findUnique({
      where: { id: data.teamId },
      select: { id: true, tenantId: true, name: true, tenant: { select: { name: true } } },
    })
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Same club roles that may send offers
    const inviter = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        roles: {
          where: {
            OR: [
              { tenantId: team.tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
              { role: "PlatformAdmin" },
            ],
          },
          select: { id: true },
        },
      },
    })
    if (!inviter || inviter.roles.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (data.templateId) {
      const template = await prisma.offerTemplate.findFirst({
        where: { id: data.templateId, tenantId: team.tenantId, isActive: true },
        select: { id: true },
      })
      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 })
      }
    }

    const duplicate = await prisma.playerInvitation.findFirst({
      where: {
        teamId: data.teamId,
        invitedEmail: { equals: data.email, mode: "insensitive" },
        status: "PENDING",
      },
      select: { id: true },
    })
    if (duplicate) {
      return NextResponse.json(
        { error: "A pending invitation already exists for this email on this team" },
        { status: 409 }
      )
    }

    // F8: attach immediately when the email already has an account
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: data.email, mode: "insensitive" } },
      select: { id: true },
    })

    const expiresAt = data.expiresAt
      ? new Date(data.expiresAt)
      : new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

    const invitation = await prisma.$transaction(async (tx: any) => {
      const created = await tx.playerInvitation.create({
        data: {
          tenantId: team.tenantId,
          teamId: team.id,
          invitedById: userId,
          invitedUserId: existingUser?.id ?? null,
          invitedEmail: data.email,
          playerName: data.playerName || null,
          message: data.message || null,
          templateId: data.templateId || null,
          seasonFee: data.seasonFee ?? null,
          expiresAt,
        },
      })

      if (existingUser) {
        await notify(tx, {
          userId: existingUser.id,
          type: "player_invite",
          title: "Player Invitation",
          message: `${team.tenant.name} has invited ${data.playerName || "a player in your family"} to join ${team.name}.`,
          link: `/player-invitations/${created.id}/accept`,
          referenceId: created.id,
          referenceType: "PlayerInvitation",
        })
      }

      return created
    })

    // Send the email invite (don't fail the request if email fails)
    try {
      const { sendPlayerInviteEmail } = await import("@/lib/email")
      const inviterName =
        [inviter.firstName, inviter.lastName].filter(Boolean).join(" ") || inviter.email
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
      // Always land on the invite's accept page. A brand-new recipient goes
      // through sign-up first, carrying the accept page as callbackUrl so signup
      // → onboarding threads them straight back here (invitation continuity).
      const acceptPath = `/player-invitations/${invitation.id}/accept`
      const inviteLink = existingUser
        ? `${baseUrl}${acceptPath}`
        : `${baseUrl}/sign-up?callbackUrl=${encodeURIComponent(acceptPath)}`
      await sendPlayerInviteEmail({
        to: data.email,
        clubName: team.tenant.name,
        teamName: team.name,
        playerName: data.playerName,
        inviterName,
        inviteLink,
        message: data.message,
      })
    } catch (emailError) {
      console.error("Failed to send player invitation email:", emailError)
    }

    return NextResponse.json(
      { success: true, id: invitation.id, attached: !!existingUser },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    // Partial unique (teamId, lower(invitedEmail)) WHERE PENDING — concurrent duplicate
    if ((error as any)?.code === "P2002") {
      return NextResponse.json(
        { error: "A pending invitation already exists for this email on this team" },
        { status: 409 }
      )
    }
    console.error("Create player invitation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * List player invitations.
 * GET /api/player-invitations?mine=true   (invitee: invitations addressed to me)
 * GET /api/player-invitations?tenantId=x  (club: invitations the club has sent)
 */
export async function GET(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const searchParams = request.nextUrl.searchParams
    const mine = searchParams.get("mine") === "true"
    const tenantId = searchParams.get("tenantId")

    if (mine) {
      await expirePending({ invitedUserId: userId })
      const invitations = await prisma.playerInvitation.findMany({
        where: { invitedUserId: userId },
        include: {
          team: { select: { id: true, name: true, ageGroup: true, gender: true } },
          tenant: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({ invitations: invitations.map(simplify) })
    }

    if (tenantId) {
      const hasAccess = await prisma.userRole.findFirst({
        where: {
          userId,
          OR: [
            { tenantId, role: { in: ["ClubOwner", "ClubManager", "Staff"] } },
            { role: "PlatformAdmin" },
          ],
        },
      })
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      await expirePending({ tenantId })
      const invitations = await prisma.playerInvitation.findMany({
        where: { tenantId },
        include: {
          team: { select: { id: true, name: true, ageGroup: true, gender: true } },
          invitedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({ invitations: invitations.map(simplify) })
    }

    return NextResponse.json(
      { error: "Either mine=true or tenantId parameter is required" },
      { status: 400 }
    )
  } catch (error) {
    console.error("List player invitations error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** Lazily flip past-expiry PENDING invitations, scoped to what's being listed. */
async function expirePending(scope: { invitedUserId?: string; tenantId?: string }) {
  await prisma.playerInvitation.updateMany({
    where: { ...scope, status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  })
}

// Decimal → number for JSON (Vercel serialization gotcha)
function simplify(invitation: any) {
  return {
    ...invitation,
    seasonFee: invitation.seasonFee === null ? null : Number(invitation.seasonFee),
  }
}
