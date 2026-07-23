import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { canActForPlayer } from "@/lib/authz/player-scope"
import { isCoppaMinor } from "@/lib/coppa"
import { notifySafe } from "@/lib/notifications"
import { sendEmail, appBaseUrl, escapeHtml, transactionalFooter } from "@/lib/email"
import { normalizedEmailSchema } from "@/lib/validations/email"

export const dynamic = "force-dynamic"

const INVITE_TTL_DAYS = 14

const createSchema = z.object({
  type: z.enum(["CHILD_LOGIN", "GUARDIAN"]),
  playerId: z.string(),
  email: normalizedEmailSchema("Enter a valid email address"),
})

/**
 * POST /api/family-invitations — the parent↔child linking layer
 * (family-accounts plan 2026-07-23).
 *
 *  CHILD_LOGIN — guardian invites their 13+ kid's email; on accept, the
 *  kid's new/existing account becomes Player.userId (own login, same Player
 *  row). Under-13 is refused: COPPA keeps them parent-managed.
 *
 *  GUARDIAN — a self-registered 13+ player invites a parent; on accept the
 *  parent becomes Player.parentId (guardian AND payer of record for future
 *  fees). The player keeps their own login via Player.userId.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUserId()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const data = createSchema.parse(await request.json())

    if (!(await canActForPlayer(session.userId, data.playerId))) {
      return NextResponse.json({ error: "Not your player" }, { status: 403 })
    }

    const player = await (prisma as any).player.findUnique({
      where: { id: data.playerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        parentId: true,
        userId: true,
        parent: { select: { email: true } },
      },
    })
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 })

    if (data.type === "CHILD_LOGIN") {
      if (isCoppaMinor(new Date(player.dateOfBirth))) {
        return NextResponse.json(
          { error: "Players under 13 can't have their own login — you manage everything from your account until they turn 13." },
          { status: 400 }
        )
      }
      if (player.userId) {
        return NextResponse.json({ error: "This player already has their own login" }, { status: 409 })
      }
      if (player.parent?.email?.toLowerCase() === data.email.toLowerCase()) {
        return NextResponse.json({ error: "That's your own email — use your child's" }, { status: 400 })
      }
    }

    if (data.type === "GUARDIAN") {
      // Only meaningful while the player is their own guardian (self-registered).
      if (player.parentId !== player.userId || player.userId == null) {
        return NextResponse.json({ error: "This player already has a parent or guardian attached" }, { status: 409 })
      }
    }

    const existing = await (prisma as any).familyInvitation.findFirst({
      where: { playerId: data.playerId, type: data.type, status: "PENDING", expiresAt: { gt: new Date() } },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ error: "There's already a pending invitation — cancel it first or wait for a response" }, { status: 409 })
    }

    const invitedUser = await prisma.user.findFirst({
      where: { email: { equals: data.email, mode: "insensitive" } },
      select: { id: true },
    })

    const invite = await (prisma as any).familyInvitation.create({
      data: {
        type: data.type,
        playerId: data.playerId,
        invitedEmail: data.email,
        invitedUserId: invitedUser?.id ?? null,
        invitedByUserId: session.userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 3600 * 1000),
      },
    })

    const playerName = `${player.firstName} ${player.lastName}`
    const acceptUrl = `${appBaseUrl()}/family/accept/${invite.token}`

    if (invitedUser) {
      await notifySafe({
        userId: invitedUser.id,
        type: "family_invite",
        title: data.type === "CHILD_LOGIN" ? "Your player login is waiting" : "Guardian invitation",
        message:
          data.type === "CHILD_LOGIN"
            ? `You've been invited to take over ${playerName}'s player profile.`
            : `${playerName} asked you to become their parent/guardian.`,
        link: `/family/accept/${invite.token}`,
        referenceId: invite.id,
        referenceType: "FamilyInvitation",
      })
    }

    try {
      await sendEmail({
        to: data.email,
        subject:
          data.type === "CHILD_LOGIN"
            ? `Your SportsHub player login for ${playerName}`
            : `${playerName} invited you as their parent/guardian on SportsHub`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>${data.type === "CHILD_LOGIN" ? "Your player profile is ready for you" : "Guardian invitation"}</h2>
            <p>
              ${
                data.type === "CHILD_LOGIN"
                  ? `A parent set up <strong>${escapeHtml(playerName)}</strong>'s player profile on SportsHub and invited you to take it over with your own login. You'll see your stats, games, and schedule — payments stay with your parent.`
                  : `<strong>${escapeHtml(playerName)}</strong> plays basketball on SportsHub and asked you to be their parent/guardian. Accepting links their profile to your account: you approve followers, handle registrations, and payments for their programs go to you.`
              }
            </p>
            <p>
              <a href="${acceptUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
                Accept invitation
              </a>
            </p>
            <p style="color: #666; font-size: 13px;">If you don't have an account yet, sign up with this email address and the invitation will be waiting. The link expires in ${INVITE_TTL_DAYS} days.</p>
            ${transactionalFooter("SportsHub One")}
          </div>
        `,
      })
    } catch (emailErr) {
      console.error("Family invite email failed:", emailErr)
    }

    return NextResponse.json({ success: true, id: invite.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error("Family invitation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** GET /api/family-invitations — pending invites for/by me (badge + cards). */
export async function GET() {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } })
  const invitations = await (prisma as any).familyInvitation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { gt: new Date() },
      OR: [
        { invitedUserId: session.userId },
        me?.email ? { invitedEmail: { equals: me.email, mode: "insensitive" } } : { id: "-" },
        { invitedByUserId: session.userId },
      ],
    },
    select: {
      id: true,
      type: true,
      token: true,
      invitedEmail: true,
      invitedByUserId: true,
      createdAt: true,
      player: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ invitations })
}
