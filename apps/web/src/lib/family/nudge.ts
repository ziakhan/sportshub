import { prisma } from "@youthbasketballhub/db"
import { getFamilyAccountContext } from "./account-context"

/**
 * The standing link-your-parent nudge (owner ruling 2026-08-12).
 *
 * Quiet but persistent: any 13-17 self-owned account with no guardian
 * attached sees it on the dashboard, every session, until a parent is
 * actually linked. Under-13 accounts do not exist and 18+ never sees it.
 */
export interface LinkParentNudge {
  playerId: string
  firstName: string
  /** A request is already out to this address; waiting on their answer. */
  pendingEmail: string | null
}

export async function getLinkParentNudge(userId: string): Promise<LinkParentNudge | null> {
  const ctx = await getFamilyAccountContext(userId)
  if (!ctx.player || ctx.hasLinkedParent || !ctx.isNudgeAge) return null

  const pending = await (prisma as any).familyInvitation.findFirst({
    where: {
      playerId: ctx.player.id,
      type: { in: ["GUARDIAN", "CHILD_CLAIM"] },
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    select: { invitedEmail: true },
    orderBy: { createdAt: "desc" },
  })

  return {
    playerId: ctx.player.id,
    firstName: ctx.player.firstName,
    pendingEmail: pending?.invitedEmail ?? null,
  }
}
