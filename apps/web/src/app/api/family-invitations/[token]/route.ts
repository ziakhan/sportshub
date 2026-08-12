import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { notifySafe } from "@/lib/notifications"
import { absorbDuplicatePlayer, type AbsorbResult } from "@/lib/family/merge-players"
import { findMergeCandidates } from "@/lib/family/claim-target"

export const dynamic = "force-dynamic"

/**
 * Family invitation by token (family-accounts plan 2026-07-23, extended by
 * the parent-child linking arc 2026-08-12).
 * GET — the invite details for the accept page, plus any merge candidate.
 * PATCH {action: accept|decline, mergeIntoPlayerId?} — apply the link:
 *   CHILD_LOGIN: Player.userId = accepting user (kid's own login; guardian
 *   and payer stay the parent).
 *   GUARDIAN: Player.parentId = accepting user (guardian + payer of record
 *   for future fees; the player keeps their own login via userId). If the
 *   parent already has a row for the same kid they can merge instead, which
 *   runs the CHILD_CLAIM path below.
 *   CHILD_CLAIM: the kid asked to sign in to the profile their parent
 *   already built. On approval their login attaches to THAT row and their
 *   own duplicate is absorbed.
 */

async function loadInvite(token: string) {
  return (prisma as any).familyInvitation.findUnique({
    where: { token },
    include: {
      player: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          parentId: true,
          userId: true,
        },
      },
      targetPlayer: { select: { id: true, firstName: true, lastName: true, parentId: true, userId: true } },
      invitedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const invite = await loadInvite(params.token)
  if (!invite) return NextResponse.json({ error: "Invitation not found" }, { status: 404 })

  const expired = invite.status === "PENDING" && new Date(invite.expiresAt) < new Date()
  const mergeCandidates =
    invite.type === "GUARDIAN" && !expired && invite.status === "PENDING"
      ? await findMergeCandidates(session.userId, invite.player)
      : []

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
      targetPlayerName: invite.targetPlayer
        ? `${invite.targetPlayer.firstName} ${invite.targetPlayer.lastName}`
        : null,
      mergeCandidates: mergeCandidates.map((c: any) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
      })),
    },
  })
}

export async function PATCH(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const session = await getSessionUserId()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const action = body?.action
    const mergeIntoPlayerId: string | null = body?.mergeIntoPlayerId ?? null
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

    // Which row survives, when two of the same kid exist. CHILD_CLAIM carries
    // its target from the request; a GUARDIAN accept can opt into the same
    // merge by naming one of the candidates the GET offered.
    let survivorId: string | null = null
    if (invite.type === "CHILD_CLAIM") {
      survivorId = invite.targetPlayerId ?? null
      if (!survivorId) throw new Error("CLAIM_TARGET_GONE")
    } else if (invite.type === "GUARDIAN" && mergeIntoPlayerId) {
      const candidates = await findMergeCandidates(session.userId, invite.player)
      if (!candidates.some((c: any) => c.id === mergeIntoPlayerId)) {
        return NextResponse.json(
          { error: "That profile no longer matches — accept without merging and we'll keep them separate" },
          { status: 409 }
        )
      }
      survivorId = mergeIntoPlayerId
    }

    let absorbed: AbsorbResult | null = null
    await prisma.$transaction(async (tx: any) => {
      if (survivorId) {
        // The parent's row survives; the kid's self-registered duplicate is
        // absorbed and their login moves across.
        const target = await tx.player.findUnique({
          where: { id: survivorId },
          select: { id: true, parentId: true, userId: true, deletedAt: true },
        })
        if (!target || target.deletedAt) throw new Error("CLAIM_TARGET_GONE")
        if (target.parentId !== session.userId) throw new Error("CLAIM_TARGET_NOT_YOURS")
        if (target.userId && target.userId !== invite.player.userId) throw new Error("CLAIM_TARGET_TAKEN")

        const kidUserId = invite.player.userId ?? invite.invitedByUserId
        absorbed = await absorbDuplicatePlayer(tx, {
          sourceId: invite.player.id,
          targetId: target.id,
        })
        await tx.player.update({
          where: { id: target.id },
          data: { userId: kidUserId, canLogin: true },
        })
      } else if (invite.type === "CHILD_LOGIN") {
        if (invite.player.userId) throw new Error("ALREADY_LINKED")
        // The kid can't be their own guardian-payer target: accepting with
        // the guardian's account makes no sense.
        if (invite.player.parentId === session.userId) throw new Error("GUARDIAN_IS_INVITEE")
        await tx.player.update({
          where: { id: invite.player.id },
          data: { userId: session.userId, canLogin: true },
        })
      } else {
        // GUARDIAN, no merge: parentId becomes the accepting parent —
        // guardian + payer of record for everything from here on. Existing
        // obligations keep their payer.
        await tx.player.update({
          where: { id: invite.player.id },
          data: { parentId: session.userId },
        })
      }

      if (invite.type !== "CHILD_LOGIN") {
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

    // Tell the sender it happened. For a kid who invited a parent this is the
    // whole point of the journey, so it reads like the win it is.
    const meName = [me?.firstName, me?.lastName].filter(Boolean).join(" ") || invite.invitedEmail
    const linkedPlayerId = survivorId ?? invite.player.id
    await notifySafe({
      userId: invite.invitedByUserId,
      type: invite.type === "CHILD_LOGIN" ? "family_invite" : "family_linked",
      title:
        invite.type === "CHILD_LOGIN"
          ? "Player login claimed"
          : `${meName} is now linked to your account`,
      message:
        invite.type === "CHILD_LOGIN"
          ? `${invite.player.firstName} now has their own login (${meName} accepted).`
          : survivorId
            ? `${meName} approved the link. You're signed in to the profile they set up for you, and anything paid goes to them.`
            : `${meName} is now your parent or guardian on SportsHub. They approve and pay for anything that costs money.`,
      link: invite.type === "CHILD_LOGIN" ? `/players/${invite.player.id}/edit` : "/dashboard",
      referenceId: invite.id,
      referenceType: "FamilyInvitation",
    })

    return NextResponse.json({
      success: true,
      status: "ACCEPTED",
      playerId: linkedPlayerId,
      merged: !!survivorId,
      absorbed,
    })
  } catch (error: any) {
    if (error?.message === "ALREADY_LINKED") {
      return NextResponse.json({ error: "This player already has their own login" }, { status: 409 })
    }
    if (error?.message === "GUARDIAN_IS_INVITEE") {
      return NextResponse.json({ error: "You're the guardian of this player — the invite is for the player's own email" }, { status: 400 })
    }
    if (error?.message === "CLAIM_TARGET_GONE") {
      return NextResponse.json(
        { error: "That profile is no longer there — ask them to send a fresh invite" },
        { status: 409 }
      )
    }
    if (error?.message === "CLAIM_TARGET_NOT_YOURS") {
      return NextResponse.json(
        { error: "That profile belongs to a different account" },
        { status: 403 }
      )
    }
    if (error?.message === "CLAIM_TARGET_TAKEN") {
      return NextResponse.json(
        { error: "Someone already signs in to that profile" },
        { status: 409 }
      )
    }
    console.error("Family invitation respond error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
