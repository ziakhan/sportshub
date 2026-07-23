import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { notifySafe } from "@/lib/notifications"

export const dynamic = "force-dynamic"

/**
 * Family invitation by token (family-accounts plan 2026-07-23).
 * GET — the invite details for the accept page.
 * PATCH {action: accept|decline} — apply the link:
 *   CHILD_LOGIN: Player.userId = accepting user (kid's own login; guardian
 *   and payer stay the parent).
 *   GUARDIAN: Player.parentId = accepting user (guardian + payer of record
 *   for future fees; the player keeps their own login via userId).
 */

async function loadInvite(token: string) {
  return (prisma as any).familyInvitation.findUnique({
    where: { token },
    include: {
      player: { select: { id: true, firstName: true, lastName: true, parentId: true, userId: true } },
      invitedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  })
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const invite = await loadInvite(params.token)
  if (!invite) return NextResponse.json({ error: "Invitation not found" }, { status: 404 })

  const expired = invite.status === "PENDING" && new Date(invite.expiresAt) < new Date()
  return NextResponse.json({
    invitation: {
      id: invite.id,
      type: invite.type,
      status: expired ? "EXPIRED" : invite.status,
      playerName: `${invite.player.firstName} ${invite.player.lastName}`,
      invitedBy:
        [invite.invitedBy.firstName, invite.invitedBy.lastName].filter(Boolean).join(" ") ||
        invite.invitedBy.email,
      invitedEmail: invite.invitedEmail,
    },
  })
}

export async function PATCH(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const session = await getSessionUserId()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { action } = await request.json()
    if (!["accept", "decline"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const invite = await loadInvite(params.token)
    if (!invite) return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
    if (invite.status !== "PENDING") {
      return NextResponse.json({ error: "This invitation was already responded to" }, { status: 409 })
    }
    if (new Date(invite.expiresAt) < new Date()) {
      await (prisma as any).familyInvitation.update({
        where: { id: invite.id },
        data: { status: "EXPIRED" },
      })
      return NextResponse.json({ error: "This invitation has expired — ask for a new one" }, { status: 410 })
    }

    // The signed-in user must be the invitee (matched by id or email).
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    })
    const isInvitee =
      invite.invitedUserId === session.userId ||
      (me?.email && me.email.toLowerCase() === invite.invitedEmail.toLowerCase())
    if (!isInvitee) {
      return NextResponse.json({ error: "This invitation was sent to a different account" }, { status: 403 })
    }

    if (action === "decline") {
      await (prisma as any).familyInvitation.update({
        where: { id: invite.id },
        data: { status: "DECLINED", respondedAt: new Date(), invitedUserId: session.userId },
      })
      return NextResponse.json({ success: true, status: "DECLINED" })
    }

    await prisma.$transaction(async (tx: any) => {
      if (invite.type === "CHILD_LOGIN") {
        if (invite.player.userId) throw new Error("ALREADY_LINKED")
        // The kid can't be their own guardian-payer target: accepting with
        // the guardian's account makes no sense.
        if (invite.player.parentId === session.userId) throw new Error("GUARDIAN_IS_INVITEE")
        await tx.player.update({
          where: { id: invite.player.id },
          data: { userId: session.userId, canLogin: true },
        })
      }
      if (invite.type === "GUARDIAN") {
        // parentId becomes the accepting parent: guardian + payer of record
        // for everything from here on. Existing obligations keep their payer.
        await tx.player.update({
          where: { id: invite.player.id },
          data: { parentId: session.userId },
        })
        const hasParentRole = await tx.userRole.findFirst({
          where: { userId: session.userId, role: "Parent", tenantId: null, teamId: null },
          select: { id: true },
        })
        if (!hasParentRole) {
          await tx.userRole.create({ data: { userId: session.userId, role: "Parent" } })
        }
      }
      await tx.familyInvitation.update({
        where: { id: invite.id },
        data: { status: "ACCEPTED", respondedAt: new Date(), invitedUserId: session.userId },
      })
    })

    if (invite.type === "CHILD_LOGIN") {
      // Player role for the kid's account (outside the placeholder above).
      const hasPlayerRole = await prisma.userRole.findFirst({
        where: { userId: session.userId, role: "Player" as any, tenantId: null, teamId: null },
        select: { id: true },
      })
      if (!hasPlayerRole) {
        await prisma.userRole.create({ data: { userId: session.userId, role: "Player" as any } })
      }
    }

    // Tell the sender it happened.
    const meName = [me?.firstName, me?.lastName].filter(Boolean).join(" ") || invite.invitedEmail
    await notifySafe({
      userId: invite.invitedByUserId,
      type: "family_invite",
      title: invite.type === "CHILD_LOGIN" ? "Player login claimed" : "Guardian attached",
      message:
        invite.type === "CHILD_LOGIN"
          ? `${invite.player.firstName} now has their own login (${meName} accepted).`
          : `${meName} is now ${invite.player.firstName}'s parent/guardian and payer.`,
      link: `/players/${invite.player.id}/edit`,
      referenceId: invite.id,
      referenceType: "FamilyInvitation",
    })

    return NextResponse.json({ success: true, status: "ACCEPTED", playerId: invite.player.id })
  } catch (error: any) {
    if (error?.message === "ALREADY_LINKED") {
      return NextResponse.json({ error: "This player already has their own login" }, { status: 409 })
    }
    if (error?.message === "GUARDIAN_IS_INVITEE") {
      return NextResponse.json({ error: "You're the guardian of this player — the invite is for the player's own email" }, { status: 400 })
    }
    console.error("Family invitation respond error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
