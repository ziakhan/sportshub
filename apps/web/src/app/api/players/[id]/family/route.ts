import { NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { isCoppaMinor } from "@/lib/coppa"

export const dynamic = "force-dynamic"

/**
 * GET /api/players/[id]/family — everything the FamilyCard needs to offer
 * the right action (family-accounts plan 2026-07-23): give a 13+ kid their
 * own login, or attach a real guardian to a self-registered player.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionUserId()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const player = await (prisma as any).player.findUnique({
    where: { id: params.id },
    select: { id: true, firstName: true, dateOfBirth: true, parentId: true, userId: true },
  })
  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const viewerIsGuardian = player.parentId === session.userId
  const viewerIsPlayer = player.userId === session.userId
  if (!viewerIsGuardian && !viewerIsPlayer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const pending = await (prisma as any).familyInvitation.findFirst({
    where: { playerId: player.id, status: "PENDING", expiresAt: { gt: new Date() } },
    select: { id: true, type: true, invitedEmail: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    firstName: player.firstName,
    isUnder13: isCoppaMinor(new Date(player.dateOfBirth)),
    hasOwnLogin: !!player.userId,
    // Self-registered = the player is still their own guardian (and payer).
    isSelfGuardian: player.userId != null && player.userId === player.parentId,
    viewerIsGuardian,
    viewerIsPlayer,
    pendingInvite: pending,
  })
}
