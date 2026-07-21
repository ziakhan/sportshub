import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { isClubAdmin, canActOnTeam } from "@/lib/authz/team-scope"
import { z } from "zod"
import { notify } from "@/lib/notifications"
import {
  createOfferForPlayer,
  resolveOfferTerms,
  OfferCreationError,
} from "@/lib/offers/create-offer"

export const dynamic = "force-dynamic"

// The offer minted on acceptance stays open this long.
const OFFER_EXPIRY_DAYS = 14

const respondSchema = z.object({
  action: z.enum(["accept", "decline"]),
  // Required for accept: the child (or the invitee's own 13+ player record)
  playerId: z.string().optional(),
})

/**
 * Respond to a player invitation (Gap G3).
 * PATCH /api/player-invitations/[id]  { action: "accept", playerId } | { action: "decline" }
 *
 * Accepting converts the invitation into a real Offer for the chosen player;
 * the family then completes the normal offer flow (sizes, jersey prefs).
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true },
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await request.json()
    const data = respondSchema.parse(body)

    const invitation = await prisma.playerInvitation.findUnique({
      where: { id: params.id },
      include: {
        team: { select: { id: true, name: true, tenantId: true } },
        tenant: { select: { name: true } },
      },
    })
    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
    }

    // Only the addressee may respond. Normally invitedUserId was attached at
    // creation (existing account) or by the signup route; the email fallback
    // covers accounts whose email matched but were never attached.
    if (invitation.invitedUserId) {
      if (invitation.invitedUserId !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else {
      if (invitation.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      await prisma.playerInvitation.update({
        where: { id: invitation.id },
        data: { invitedUserId: userId },
      })
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "This invitation is no longer open" },
        { status: 400 }
      )
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.playerInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      })
      return NextResponse.json(
        { error: "This invitation has expired", code: "INVITATION_EXPIRED" },
        { status: 410 }
      )
    }

    const responderName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email

    if (data.action === "decline") {
      await prisma.$transaction(async (tx: any) => {
        await tx.playerInvitation.update({
          where: { id: invitation.id },
          data: { status: "DECLINED", respondedAt: new Date() },
        })
        await notify(tx, {
          userId: invitation.invitedById,
          type: "player_invite_declined",
          title: "Player Invitation Declined",
          message: `${responderName} has declined the invitation to join ${invitation.team.name}.`,
          link: `/clubs/${invitation.tenantId}/offers`,
          referenceId: invitation.id,
          referenceType: "PlayerInvitation",
        })
      })
      return NextResponse.json({ status: "declined" })
    }

    // Accept
    if (!data.playerId) {
      return NextResponse.json(
        { error: "playerId is required to accept", code: "PLAYER_REQUIRED" },
        { status: 400 }
      )
    }

    // The player must be the responder's own child — or their own self-
    // registered record (13+), where parentId is the user themself.
    const player = await prisma.player.findFirst({
      where: { id: data.playerId, parentId: userId, deletedAt: null },
      select: { id: true, parentId: true, firstName: true, lastName: true },
    })
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    // Template may have been deactivated since the invite — fall back to the
    // invitation's stored terms instead of dead-ending the acceptance.
    const { terms, templateId } = await resolveOfferTerms(prisma, {
      tenantId: invitation.tenantId,
      templateId: invitation.templateId,
      overrides: {
        seasonFee: invitation.seasonFee === null ? undefined : Number(invitation.seasonFee),
      },
      onMissingTemplate: "ignore",
    })

    const offer = await prisma.$transaction(async (tx: any) => {
      const created = await createOfferForPlayer(tx, {
        teamId: invitation.teamId,
        playerId: player.id,
        templateId,
        terms,
        message: invitation.message,
        expiresAt: new Date(Date.now() + OFFER_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        player,
        clubName: invitation.tenant.name,
        teamName: invitation.team.name,
      })

      await tx.playerInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", respondedAt: new Date(), offerId: created.id },
      })

      await notify(tx, {
        userId: invitation.invitedById,
        type: "player_invite_accepted",
        title: "Player Invitation Accepted",
        message: `${responderName} has accepted the invitation for ${player.firstName} ${player.lastName} to join ${invitation.team.name}. An offer has been sent.`,
        link: `/clubs/${invitation.tenantId}/offers`,
        referenceId: invitation.id,
        referenceType: "PlayerInvitation",
      })

      return created
    })

    return NextResponse.json({ status: "accepted", offerId: offer.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    if (error instanceof OfferCreationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 })
    }
    console.error("Player invitation response error:", error)
    return NextResponse.json({ error: "Failed to process response" }, { status: 500 })
  }
}

/**
 * Revoke a pending invitation (club side).
 * DELETE /api/player-invitations/[id]
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const invitation = await prisma.playerInvitation.findUnique({
      where: { id: params.id },
      include: { team: { select: { name: true } }, tenant: { select: { name: true } } },
    })
    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
    }

    // Security fix 2026-07-20: revoking is team-scoped for Staff, club-wide
    // only for admins.
    const hasAccess = invitation.teamId
      ? await canActOnTeam(userId, invitation.tenantId, invitation.teamId)
      : await isClubAdmin(userId, invitation.tenantId)
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending invitations can be revoked" },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.playerInvitation.update({
        where: { id: invitation.id },
        data: { status: "CANCELLED" },
      })
      if (invitation.invitedUserId) {
        await notify(tx, {
          userId: invitation.invitedUserId,
          type: "player_invite_cancelled",
          title: "Invitation Withdrawn",
          message: `${invitation.tenant.name} has withdrawn the invitation to join ${invitation.team.name}.`,
          referenceId: invitation.id,
          referenceType: "PlayerInvitation",
        })
      }
    })

    return NextResponse.json({ status: "cancelled" })
  } catch (error) {
    console.error("Revoke player invitation error:", error)
    return NextResponse.json({ error: "Failed to revoke invitation" }, { status: 500 })
  }
}
